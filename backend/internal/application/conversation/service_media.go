package conversation

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"image/png"
	"math"
	"path/filepath"
	"strings"

	_ "golang.org/x/image/webp"
	_ "image/gif" // 注册 GIF 解码器。
)

const maxMediaImageEditInputPixels = 64 * 1024 * 1024
const maxMediaVideoReferencePixels = 64 * 1024 * 1024

// resizeImageIfNeeded 在图片尺寸超过 maxDim 时进行缩放并重新编码。
// 若解码/编码失败则返回原始字节，不报错，保证降级可用。
// 使用最近邻插值以降低 CPU 开销，缩略图语义信息仍足够供 LLM 识别。
func resizeImageIfNeeded(data []byte, mimeType string, maxDim int) []byte {
	if maxDim <= 0 || len(data) == 0 {
		return data
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data // 无法解码时返回原始数据，由上游模型按原图处理。
	}

	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= maxDim && h <= maxDim {
		return data
	}

	var scale float64
	if w >= h {
		scale = float64(maxDim) / float64(w)
	} else {
		scale = float64(maxDim) / float64(h)
	}
	newW := int(math.Round(float64(w) * scale))
	newH := int(math.Round(float64(h) * scale))
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	// 最近邻缩放
	dst := image.NewNRGBA(image.Rect(0, 0, newW, newH))
	for dy := 0; dy < newH; dy++ {
		for dx := 0; dx < newW; dx++ {
			sx := int(float64(dx)/scale) + bounds.Min.X
			sy := int(float64(dy)/scale) + bounds.Min.Y
			if sx >= bounds.Max.X {
				sx = bounds.Max.X - 1
			}
			if sy >= bounds.Max.Y {
				sy = bounds.Max.Y - 1
			}
			dst.Set(dx, dy, src.At(sx, sy))
		}
	}

	var buf bytes.Buffer
	mime := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.Contains(mime, "png"):
		if encErr := png.Encode(&buf, dst); encErr != nil {
			return data
		}
	default: // jpeg 及其他格式统一使用 JPEG 输出
		if encErr := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 85}); encErr != nil {
			return data
		}
	}
	return buf.Bytes()
}

// resolveImageMimeType 规范化图片 MIME 类型，未知时默认为 image/jpeg。
func resolveImageMimeType(mimeType string) string {
	normalized := strings.ToLower(strings.TrimSpace(mimeType))
	switch normalized {
	case "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp":
		return normalized
	default:
		return "image/jpeg"
	}
}

// normalizeMediaImageEditInput 将用户上传的编辑输入图规整为静态 PNG。
// 手机拍摄图片常带有上游不稳定支持的编码、色彩模式或容器元数据；图片编辑协议统一接收这里输出的 8-bit RGBA PNG。
func normalizeMediaImageEditInput(data []byte, declaredMIME string) ([]byte, string, error) {
	detected := detectGeneratedImageMIME(data)
	if detected == "" {
		return nil, strings.TrimSpace(declaredMIME), fmt.Errorf("image edit input is not a supported image")
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, detected, err
	}
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return nil, detected, fmt.Errorf("image edit input has invalid dimensions")
	}
	if int64(width)*int64(height) > maxMediaImageEditInputPixels {
		return nil, detected, fmt.Errorf("image edit input dimensions exceed limit")
	}

	dst := image.NewNRGBA(image.Rect(0, 0, width, height))
	draw.Draw(dst, dst.Bounds(), src, bounds.Min, draw.Src)

	var buf bytes.Buffer
	if err := png.Encode(&buf, dst); err != nil {
		return nil, detected, err
	}
	return buf.Bytes(), "image/png", nil
}

func mediaImageEditInputFileName(fileName string, mimeType string) string {
	normalizedName := strings.TrimSpace(fileName)
	ext := filepath.Ext(normalizedName)
	base := strings.TrimSuffix(normalizedName, ext)
	if strings.TrimSpace(base) == "" {
		base = "image-edit-input"
	}
	return base + imageFileExtension(mimeType)
}

func normalizeMediaVideoReferenceInput(data []byte, declaredMIME string, targetSize string) ([]byte, string, error) {
	detected := detectGeneratedImageMIME(data)
	switch detected {
	case "image/jpeg", "image/png", "image/webp":
	default:
		if detected == "" {
			detected = strings.TrimSpace(declaredMIME)
		}
		return nil, detected, fmt.Errorf("video reference input is not a supported image")
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, detected, err
	}
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return nil, detected, fmt.Errorf("video reference input has invalid dimensions")
	}
	if int64(width)*int64(height) > maxMediaVideoReferencePixels {
		return nil, detected, fmt.Errorf("video reference input dimensions exceed limit")
	}
	targetWidth, targetHeight, err := parseMediaVideoTargetSize(targetSize)
	if err != nil {
		return nil, detected, err
	}

	dst := image.NewNRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	scale := math.Max(float64(targetWidth)/float64(width), float64(targetHeight)/float64(height))
	centerX := float64(bounds.Min.X) + float64(width)/2
	centerY := float64(bounds.Min.Y) + float64(height)/2
	for dy := 0; dy < targetHeight; dy++ {
		sy := int(math.Floor(centerY + (float64(dy)+0.5-float64(targetHeight)/2)/scale))
		if sy < bounds.Min.Y {
			sy = bounds.Min.Y
		}
		if sy >= bounds.Max.Y {
			sy = bounds.Max.Y - 1
		}
		for dx := 0; dx < targetWidth; dx++ {
			sx := int(math.Floor(centerX + (float64(dx)+0.5-float64(targetWidth)/2)/scale))
			if sx < bounds.Min.X {
				sx = bounds.Min.X
			}
			if sx >= bounds.Max.X {
				sx = bounds.Max.X - 1
			}
			dst.Set(dx, dy, src.At(sx, sy))
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, dst); err != nil {
		return nil, detected, err
	}
	return buf.Bytes(), "image/png", nil
}

func normalizeMediaVideoReferenceVideoInput(data []byte, declaredMIME string) ([]byte, string, error) {
	if len(data) >= 12 && bytes.Equal(data[4:8], []byte("ftyp")) {
		return data, "video/mp4", nil
	}
	return nil, strings.TrimSpace(declaredMIME), fmt.Errorf("video reference input is not a supported mp4")
}

func parseMediaVideoTargetSize(value string) (int, int, error) {
	switch strings.TrimSpace(value) {
	case "720x1280":
		return 720, 1280, nil
	case "1280x720":
		return 1280, 720, nil
	case "1024x1792":
		return 1024, 1792, nil
	case "1792x1024":
		return 1792, 1024, nil
	default:
		return 0, 0, fmt.Errorf("unsupported video size: %s", strings.TrimSpace(value))
	}
}

func mediaVideoReferenceInputFileName(fileName string) string {
	normalizedName := strings.TrimSpace(fileName)
	ext := filepath.Ext(normalizedName)
	base := strings.TrimSuffix(normalizedName, ext)
	if strings.TrimSpace(base) == "" {
		base = "video-reference-input"
	}
	return base + ".png"
}

func mediaVideoReferenceVideoFileName(fileName string) string {
	normalizedName := strings.TrimSpace(fileName)
	ext := filepath.Ext(normalizedName)
	base := strings.TrimSuffix(normalizedName, ext)
	if strings.TrimSpace(base) == "" {
		base = "video-reference-input"
	}
	return base + ".mp4"
}
