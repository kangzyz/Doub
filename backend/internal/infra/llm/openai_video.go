package llm

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	defaultOpenAIVideoSize        = "720x1280"
	defaultOpenAIVideoSeconds     = 4
	defaultOpenAIVideoTimeout     = 10 * time.Minute
	openAIVideoPollInterval       = 2 * time.Second
	maxOpenAIVideoDownloadBytes   = 512 * 1024 * 1024
	openAIVideoReferenceFileName  = "input-reference.png"
	openAIVideoReferenceVideoName = "input-reference.mp4"
)

type xAIVideoOperation string

const (
	xAIVideoOperationGenerate xAIVideoOperation = "generate"
	xAIVideoOperationExtend   xAIVideoOperation = "extend"
)

type xAIVideoRequestAttempt struct {
	URL                    string
	ApplyProxyFallbackBody bool
}

// openAIVideoGenerationsAdapter 负责 OpenAI Videos API 的视频生成端点。
type openAIVideoGenerationsAdapter struct {
	client *Client
}

func (a *openAIVideoGenerationsAdapter) Name() string { return AdapterOpenAIVideoGenerations }

// Generate 调用 OpenAI 视频生成接口，返回结构化视频结果。
func (a *openAIVideoGenerationsAdapter) Generate(ctx context.Context, route RouteConfig, input GenerateInput) (*GenerateOutput, error) {
	route.Endpoint = EndpointVideoGenerations
	return a.client.generateOpenAIVideoGenerations(ctx, route, input)
}

// GenerateStream 不支持真实视频流式。Videos API 是异步任务，应用层通过 media_status 反馈进度。
func (a *openAIVideoGenerationsAdapter) GenerateStream(
	ctx context.Context,
	route RouteConfig,
	input GenerateInput,
	onEvent func(GenerateStreamEvent) error,
) (*GenerateOutput, error) {
	return nil, fmt.Errorf("%w: %s", ErrUnsupportedStream, AdapterOpenAIVideoGenerations)
}

// ListModels 复用 OpenAI 兼容 models 目录，供渠道校验和展示使用。
func (a *openAIVideoGenerationsAdapter) ListModels(ctx context.Context, route RouteConfig) ([]ModelItem, error) {
	return a.client.listModelsOpenAICompatible(ctx, route)
}

type openAIVideoJob struct {
	ID           string
	Status       string
	Progress     float64
	ErrorMessage string
	VideoURL     string
	RawJSON      string
}

func (c *Client) generateOpenAIVideoGenerations(ctx context.Context, route RouteConfig, input GenerateInput) (*GenerateOutput, error) {
	if isXAIVideoRoute(route) {
		return c.generateXAIVideoGenerations(ctx, route, input)
	}

	createURL, requestBody, contentType, debugBody, err := buildOpenAIVideoRequest(route, input)
	if err != nil {
		return nil, err
	}
	if createURL == "" {
		return nil, fmt.Errorf("invalid base url")
	}

	videoCtx, cancel := context.WithTimeout(ctx, resolveOpenAIVideoTimeout(route.ReadTimeoutMS))
	defer cancel()

	req, err := http.NewRequestWithContext(videoCtx, http.MethodPost, createURL, bytes.NewReader(requestBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)
	if apiKey := strings.TrimSpace(route.APIKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	setOpenRouterAttributionHeaders(req, route)
	setAdditionalHeaders(req, route.HeadersJSON)

	resp, err := c.httpClientForRoute(route).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close() //nolint:errcheck

	body, err := readUpstreamBody(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, parseUpstreamError(resp.StatusCode, body, upstreamDebugSnapshot(req, debugBody, resp, body))
	}

	job, err := parseOpenAIVideoJob(body)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(job.ID) == "" {
		return nil, fmt.Errorf("video generation response missing id")
	}
	job, err = c.pollOpenAIVideoJob(videoCtx, route, job)
	if err != nil {
		return nil, err
	}

	data, mimeType, err := c.downloadOpenAIVideoContent(videoCtx, route, job.ID)
	if err != nil {
		return nil, err
	}
	return &GenerateOutput{
		ResponseID: job.ID,
		GeneratedVideos: []GeneratedVideo{{
			ID:       job.ID,
			Data:     data,
			MIMEType: mimeType,
		}},
		RawJSON: job.RawJSON,
	}, nil
}

func (c *Client) generateXAIVideoGenerations(ctx context.Context, route RouteConfig, input GenerateInput) (*GenerateOutput, error) {
	requestBody, debugBody, operation, err := buildXAIVideoRequest(route.UpstreamModel, input)
	if err != nil {
		return nil, err
	}
	attempts := buildXAIVideoRequestAttempts(route, operation)
	if len(attempts) == 0 || strings.TrimSpace(attempts[0].URL) == "" {
		return nil, fmt.Errorf("invalid base url")
	}

	videoCtx, cancel := context.WithTimeout(ctx, resolveOpenAIVideoTimeout(route.ReadTimeoutMS))
	defer cancel()

	var lastErr error
	for index, attempt := range attempts {
		attemptBody := cloneXAIVideoRequestPayload(requestBody)
		attemptDebugBody := debugBody
		if attempt.ApplyProxyFallbackBody {
			applyXAIVideoProxyFallbackBody(attemptBody, operation)
			attemptDebugBody = buildXAIVideoDebugBody(attemptBody, input.Messages, operation)
		}
		payload, err := json.Marshal(attemptBody)
		if err != nil {
			return nil, err
		}
		if len(attemptDebugBody) == 0 {
			attemptDebugBody = payload
		}

		req, err := http.NewRequestWithContext(videoCtx, http.MethodPost, attempt.URL, bytes.NewReader(payload))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		if apiKey := strings.TrimSpace(route.APIKey); apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}
		setOpenRouterAttributionHeaders(req, route)
		setAdditionalHeaders(req, route.HeadersJSON)

		resp, err := c.httpClientForRoute(route).Do(req)
		if err != nil {
			return nil, err
		}
		body, readErr := readUpstreamBody(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			return nil, readErr
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = parseUpstreamError(resp.StatusCode, body, upstreamDebugSnapshot(req, attemptDebugBody, resp, body))
			if shouldRetryXAIVideoRequestAttempt(resp.StatusCode, operation, index, attempts) {
				continue
			}
			return nil, lastErr
		}

		job, err := parseXAIVideoJob(body)
		if err != nil {
			return nil, err
		}
		if strings.TrimSpace(job.ID) == "" {
			return nil, fmt.Errorf("video generation response missing request id")
		}
		job, err = c.pollXAIVideoJob(videoCtx, route, job)
		if err != nil {
			return nil, err
		}
		var data []byte
		var mimeType string
		if strings.TrimSpace(job.VideoURL) != "" {
			data, mimeType, err = c.downloadXAIVideoContent(videoCtx, route, job.VideoURL)
			if err != nil {
				return nil, err
			}
		} else {
			data, mimeType, err = c.downloadOpenAIVideoContent(videoCtx, route, job.ID)
			if err != nil {
				return nil, err
			}
		}
		return &GenerateOutput{
			ResponseID: job.ID,
			GeneratedVideos: []GeneratedVideo{{
				ID:       job.ID,
				Data:     data,
				MIMEType: mimeType,
			}},
			RawJSON: job.RawJSON,
		}, nil
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("video generation request failed")
}

func buildOpenAIVideoRequest(route RouteConfig, input GenerateInput) (string, []byte, string, []byte, error) {
	videos := collectVideoInputParts(input.Messages)
	if len(videos) > 0 {
		body, contentType, debugBody, err := buildOpenAIVideoEditRequest(route.UpstreamModel, input)
		return buildOpenAIVideoEditsURL(route.BaseURL), body, contentType, debugBody, err
	}
	body, contentType, debugBody, err := buildOpenAIVideoCreateRequest(route.UpstreamModel, input)
	return buildOpenAIRequestURL(route.BaseURL, EndpointVideoGenerations), body, contentType, debugBody, err
}

func buildOpenAIVideoCreateRequest(model string, input GenerateInput) ([]byte, string, []byte, error) {
	prompt := buildOpenAIImageGenerationPrompt(input.Messages)
	if strings.TrimSpace(prompt) == "" {
		return nil, "", nil, fmt.Errorf("video generation prompt required")
	}
	size, err := normalizeOpenAIVideoSize(input.Options)
	if err != nil {
		return nil, "", nil, err
	}
	seconds, err := normalizeOpenAIVideoSeconds(input.Options)
	if err != nil {
		return nil, "", nil, err
	}
	images := collectImageInputParts(input.Messages)
	if len(images) > 1 {
		return nil, "", nil, fmt.Errorf("video generation accepts one input reference image")
	}
	if len(collectVideoInputParts(input.Messages)) > 0 {
		return nil, "", nil, fmt.Errorf("video generation create does not accept input reference video")
	}

	fields := map[string]string{
		"model":   strings.TrimSpace(model),
		"prompt":  prompt,
		"size":    size,
		"seconds": strconv.Itoa(seconds),
	}
	if len(images) == 0 {
		payload := map[string]interface{}{}
		for key, value := range fields {
			if strings.TrimSpace(value) == "" {
				continue
			}
			payload[key] = value
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, "", nil, err
		}
		return raw, "application/json", raw, nil
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		if strings.TrimSpace(value) == "" {
			continue
		}
		if err := writer.WriteField(key, value); err != nil {
			return nil, "", nil, err
		}
	}
	image := images[0]
	fileName := strings.TrimSpace(image.FileName)
	if fileName == "" {
		fileName = openAIVideoReferenceFileName
	}
	if err := writeOpenAIMultipartFile(writer, "input_reference", fileName, image.MimeType, image.Data); err != nil {
		return nil, "", nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, "", nil, err
	}

	debugBody := buildOpenAIVideoDebugBody(fields, true)
	return body.Bytes(), writer.FormDataContentType(), debugBody, nil
}

func buildOpenAIVideoEditRequest(model string, input GenerateInput) ([]byte, string, []byte, error) {
	prompt := buildOpenAIImageGenerationPrompt(input.Messages)
	if strings.TrimSpace(prompt) == "" {
		return nil, "", nil, fmt.Errorf("video edit prompt required")
	}
	size, err := normalizeOpenAIVideoSize(input.Options)
	if err != nil {
		return nil, "", nil, err
	}
	seconds, err := normalizeOpenAIVideoSeconds(input.Options)
	if err != nil {
		return nil, "", nil, err
	}
	images := collectImageInputParts(input.Messages)
	videos := collectVideoInputParts(input.Messages)
	if len(images) > 0 || len(videos) != 1 {
		return nil, "", nil, fmt.Errorf("video edit accepts one input reference video")
	}

	fields := map[string]string{
		"model":   strings.TrimSpace(model),
		"prompt":  prompt,
		"size":    size,
		"seconds": strconv.Itoa(seconds),
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		if strings.TrimSpace(value) == "" {
			continue
		}
		if err := writer.WriteField(key, value); err != nil {
			return nil, "", nil, err
		}
	}
	video := videos[0]
	fileName := strings.TrimSpace(video.FileName)
	if fileName == "" {
		fileName = openAIVideoReferenceVideoName
	}
	if err := writeOpenAIMultipartFile(writer, "video", fileName, video.MimeType, video.Data); err != nil {
		return nil, "", nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, "", nil, err
	}

	debugBody := buildOpenAIVideoEditDebugBody(fields, true)
	return body.Bytes(), writer.FormDataContentType(), debugBody, nil
}

func buildXAIVideoCreateRequest(model string, input GenerateInput) (map[string]interface{}, []byte, error) {
	payload, debugBody, _, err := buildXAIVideoRequest(model, input)
	return payload, debugBody, err
}

func buildXAIVideoRequest(model string, input GenerateInput) (map[string]interface{}, []byte, xAIVideoOperation, error) {
	prompt := buildOpenAIImageGenerationPrompt(input.Messages)
	if strings.TrimSpace(prompt) == "" {
		return nil, nil, "", fmt.Errorf("video generation prompt required")
	}
	images := collectImageInputParts(input.Messages)
	videos := collectVideoInputParts(input.Messages)
	if len(images)+len(videos) > 1 {
		return nil, nil, "", fmt.Errorf("video generation accepts one input reference image or video")
	}

	payload := map[string]interface{}{
		"model":  strings.TrimSpace(model),
		"prompt": prompt,
	}
	operation := xAIVideoOperationGenerate
	if len(images) == 1 {
		payload["image"] = xAIVideoImagePayload(images[0])
	}
	if len(videos) == 1 {
		payload["video"] = xAIVideoVideoPayload(videos[0])
		operation = xAIVideoOperationExtend
	}
	if err := applyXAIVideoParams(payload, input.Options, operation == xAIVideoOperationExtend); err != nil {
		return nil, nil, "", err
	}

	debugBody := buildXAIVideoDebugBody(payload, input.Messages, operation)
	return payload, debugBody, operation, nil
}

func buildXAIVideoDebugBody(payload map[string]interface{}, messages []Message, operation xAIVideoOperation) []byte {
	debug := map[string]interface{}{
		"model":       payload["model"],
		"prompt":      payload["prompt"],
		"image_count": len(collectImageInputParts(messages)),
		"video_count": len(collectVideoInputParts(messages)),
		"operation":   string(operation),
	}
	if duration, ok := payload["duration"]; ok {
		debug["duration"] = duration
	}
	if aspectRatio, ok := payload["aspect_ratio"]; ok {
		debug["aspect_ratio"] = aspectRatio
	}
	if resolution, ok := payload["resolution"]; ok {
		debug["resolution"] = resolution
	}
	if video := asMap(payload["video"]); strings.TrimSpace(getString(video["url"])) != "" {
		debug["video_reference"] = true
	}
	if mode := strings.TrimSpace(modelParamString(payload, "mode")); mode != "" {
		debug["mode"] = mode
	}
	if task := strings.TrimSpace(modelParamString(payload, "task")); task != "" {
		debug["task"] = task
	}
	if providerOptions := asMap(payload["providerOptions"]); len(asMap(providerOptions["xai"])) > 0 {
		debug["provider_options_xai"] = true
	}
	debugBody, _ := json.Marshal(debug)
	return debugBody
}

func cloneXAIVideoRequestPayload(src map[string]interface{}) map[string]interface{} {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]interface{}, len(src))
	for key, value := range src {
		if nested, ok := value.(map[string]interface{}); ok {
			cloned := make(map[string]interface{}, len(nested))
			for nestedKey, nestedValue := range nested {
				cloned[nestedKey] = nestedValue
			}
			dst[key] = cloned
			continue
		}
		dst[key] = value
	}
	return dst
}

func applyXAIVideoProxyFallbackBody(payload map[string]interface{}, operation xAIVideoOperation) {
	if payload == nil || operation != xAIVideoOperationExtend {
		return
	}
	payload["operation"] = string(operation)
	payload["mode"] = "extend-video"
	payload["task"] = "video_extension"
	if video, ok := payload["video"].(map[string]interface{}); ok {
		if videoURL, _ := video["url"].(string); strings.TrimSpace(videoURL) != "" {
			video["type"] = "video_url"
			payload["video_url"] = videoURL
			payload["videoUrl"] = videoURL
			payload["providerOptions"] = map[string]interface{}{
				"xai": map[string]interface{}{
					"mode":     "extend-video",
					"videoUrl": videoURL,
				},
			}
			payload["provider_options"] = map[string]interface{}{
				"xai": map[string]interface{}{
					"mode":      "extend-video",
					"video_url": videoURL,
					"videoUrl":  videoURL,
				},
			}
			payload["input_reference"] = map[string]interface{}{
				"type": "video_url",
				"url":  videoURL,
			}
			payload["input"] = []map[string]interface{}{
				{
					"type": "input_text",
					"text": strings.TrimSpace(modelParamString(payload, "prompt")),
				},
				{
					"type":      "input_video",
					"url":       videoURL,
					"video_url": videoURL,
					"videoUrl":  videoURL,
				},
			}
		}
	}
}

func shouldRetryXAIVideoRequestAttempt(statusCode int, operation xAIVideoOperation, attemptIndex int, attempts []xAIVideoRequestAttempt) bool {
	return operation == xAIVideoOperationExtend &&
		statusCode == http.StatusNotFound &&
		attemptIndex < len(attempts)-1
}

func normalizeOpenAIVideoSize(options map[string]interface{}) (string, error) {
	raw := strings.TrimSpace(modelParamString(options, "size"))
	if raw == "" {
		aspectRatio := strings.TrimSpace(firstNonEmptyString(modelParamString(options, "aspect_ratio"), modelParamString(options, "aspectRatio")))
		resolution := strings.TrimSpace(modelParamString(options, "resolution"))
		switch {
		case resolution == "1080p" && aspectRatio == "9:16":
			raw = "1024x1792"
		case resolution == "1080p" && aspectRatio == "16:9":
			raw = "1792x1024"
		case aspectRatio == "16:9":
			raw = "1280x720"
		case aspectRatio == "9:16":
			raw = "720x1280"
		default:
			raw = defaultOpenAIVideoSize
		}
	}
	switch raw {
	case "720x1280", "1280x720", "1024x1792", "1792x1024":
		return raw, nil
	default:
		return "", fmt.Errorf("unsupported video size: %s", raw)
	}
}

func normalizeOpenAIVideoSeconds(options map[string]interface{}) (int, error) {
	value, ok := modelParamIntValue(options, "seconds")
	if !ok {
		if raw := strings.TrimSpace(modelParamString(options, "seconds")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil {
				return 0, fmt.Errorf("unsupported video seconds: %s", raw)
			}
			value = parsed
			ok = true
		}
	}
	if !ok {
		value, ok = modelParamIntValue(options, "duration")
		if !ok {
			if raw := strings.TrimSpace(modelParamString(options, "duration")); raw != "" {
				parsed, err := strconv.Atoi(raw)
				if err != nil {
					return 0, fmt.Errorf("unsupported video duration: %s", raw)
				}
				value = parsed
				ok = true
			}
		}
	}
	if !ok {
		value = defaultOpenAIVideoSeconds
	}
	switch value {
	case 4, 8, 12:
		return value, nil
	default:
		return 0, fmt.Errorf("unsupported video seconds: %d", value)
	}
}

func applyXAIVideoParams(payload map[string]interface{}, options map[string]interface{}, extension bool) error {
	if payload == nil || len(options) == 0 {
		return nil
	}
	if duration, ok, err := normalizeXAIVideoDuration(options, extension); err != nil {
		return err
	} else if ok {
		payload["duration"] = duration
	}
	if extension {
		return nil
	}
	if aspectRatio, ok, err := normalizeXAIVideoAspectRatio(options); err != nil {
		return err
	} else if ok {
		payload["aspect_ratio"] = aspectRatio
	}
	if resolution, ok, err := normalizeXAIVideoResolution(options); err != nil {
		return err
	} else if ok {
		payload["resolution"] = resolution
	}
	return nil
}

func xAIVideoImagePayload(image ContentPart) map[string]interface{} {
	mimeType := strings.TrimSpace(image.MimeType)
	if mimeType == "" {
		mimeType = "image/jpeg"
	}
	return map[string]interface{}{
		"url": "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(image.Data),
	}
}

func xAIVideoVideoPayload(video ContentPart) map[string]interface{} {
	mimeType := strings.TrimSpace(video.MimeType)
	if mimeType == "" {
		mimeType = "video/mp4"
	}
	return map[string]interface{}{
		"url": "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(video.Data),
	}
}

func normalizeXAIVideoDuration(options map[string]interface{}, extension bool) (int, bool, error) {
	if value, ok, err := normalizedVideoIntegerOption(options, "duration"); ok || err != nil {
		if err != nil {
			return 0, false, err
		}
		if !validXAIVideoDuration(value, extension) {
			return 0, false, fmt.Errorf("unsupported xAI video duration: %d", value)
		}
		return value, true, nil
	}
	if value, ok, err := normalizedVideoIntegerOption(options, "seconds"); ok || err != nil {
		if err != nil {
			return 0, false, err
		}
		if validXAIVideoDuration(value, extension) {
			return value, true, nil
		}
	}
	return 0, false, nil
}

func validXAIVideoDuration(value int, extension bool) bool {
	if extension {
		return value >= 2 && value <= 10
	}
	return value >= 1 && value <= 15
}

func normalizedVideoIntegerOption(options map[string]interface{}, key string) (int, bool, error) {
	if value, ok := modelParamIntValue(options, key); ok {
		return value, true, nil
	}
	if raw := strings.TrimSpace(modelParamString(options, key)); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			return 0, false, fmt.Errorf("unsupported video %s: %s", key, raw)
		}
		return parsed, true, nil
	}
	return 0, false, nil
}

func normalizeXAIVideoAspectRatio(options map[string]interface{}) (string, bool, error) {
	raw := strings.TrimSpace(firstNonEmptyString(modelParamString(options, "aspect_ratio"), modelParamString(options, "aspectRatio")))
	if raw == "" {
		return "", false, nil
	}
	switch raw {
	case "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3":
		return raw, true, nil
	default:
		return "", false, fmt.Errorf("unsupported xAI video aspect_ratio: %s", raw)
	}
}

func normalizeXAIVideoResolution(options map[string]interface{}) (string, bool, error) {
	raw := strings.TrimSpace(modelParamString(options, "resolution"))
	if raw == "" {
		return "", false, nil
	}
	switch raw {
	case "480p", "720p", "1080p":
		return raw, true, nil
	default:
		return "", false, fmt.Errorf("unsupported xAI video resolution: %s", raw)
	}
}

func buildOpenAIVideoDebugBody(fields map[string]string, hasInputReference bool) []byte {
	payload := make(map[string]interface{}, len(fields)+2)
	for key, value := range fields {
		payload[key] = value
	}
	payload["input_reference"] = hasInputReference
	payload["multipart"] = hasInputReference
	raw, err := json.Marshal(payload)
	if err != nil {
		return []byte(`{"video_generation":true}`)
	}
	return raw
}

func buildOpenAIVideoEditDebugBody(fields map[string]string, hasVideo bool) []byte {
	payload := make(map[string]interface{}, len(fields)+2)
	for key, value := range fields {
		payload[key] = value
	}
	payload["video"] = hasVideo
	payload["multipart"] = true
	raw, err := json.Marshal(payload)
	if err != nil {
		return []byte(`{"video_edit":true}`)
	}
	return raw
}

func resolveOpenAIVideoTimeout(readTimeoutMS int) time.Duration {
	if readTimeoutMS <= 0 {
		return defaultOpenAIVideoTimeout
	}
	return time.Duration(readTimeoutMS) * time.Millisecond
}

func (c *Client) pollOpenAIVideoJob(ctx context.Context, route RouteConfig, initial openAIVideoJob) (openAIVideoJob, error) {
	job := initial
	for {
		switch normalizeOpenAIVideoStatus(job.Status) {
		case "completed":
			return job, nil
		case "failed", "cancelled", "expired":
			message := strings.TrimSpace(job.ErrorMessage)
			if message == "" {
				message = "video generation failed"
			}
			return job, &UpstreamError{StatusCode: http.StatusBadGateway, Message: message, Body: job.RawJSON}
		}

		timer := time.NewTimer(openAIVideoPollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return job, ctx.Err()
		case <-timer.C:
		}

		next, err := c.retrieveOpenAIVideoJob(ctx, route, job.ID)
		if err != nil {
			return job, err
		}
		job = next
	}
}

func (c *Client) pollXAIVideoJob(ctx context.Context, route RouteConfig, initial openAIVideoJob) (openAIVideoJob, error) {
	job := initial
	for {
		switch normalizeOpenAIVideoStatus(job.Status) {
		case "completed":
			return job, nil
		case "failed", "cancelled", "expired":
			message := strings.TrimSpace(job.ErrorMessage)
			if message == "" {
				message = "video generation failed"
			}
			return job, &UpstreamError{StatusCode: http.StatusBadGateway, Message: message, Body: job.RawJSON}
		}

		timer := time.NewTimer(openAIVideoPollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return job, ctx.Err()
		case <-timer.C:
		}

		next, err := c.retrieveXAIVideoJob(ctx, route, job.ID)
		if err != nil {
			return job, err
		}
		job = next
	}
}

func (c *Client) retrieveOpenAIVideoJob(ctx context.Context, route RouteConfig, videoID string) (openAIVideoJob, error) {
	requestURL := buildOpenAIVideoResourceURL(route.BaseURL, videoID, "")
	if requestURL == "" {
		return openAIVideoJob{}, fmt.Errorf("invalid video id")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return openAIVideoJob{}, err
	}
	if apiKey := strings.TrimSpace(route.APIKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	setOpenRouterAttributionHeaders(req, route)
	setAdditionalHeaders(req, route.HeadersJSON)

	resp, err := c.httpClientForRoute(route).Do(req)
	if err != nil {
		return openAIVideoJob{}, err
	}
	defer resp.Body.Close() //nolint:errcheck
	body, err := readUpstreamBody(resp.Body)
	if err != nil {
		return openAIVideoJob{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return openAIVideoJob{}, parseUpstreamError(resp.StatusCode, body, upstreamDebugSnapshot(req, nil, resp, body))
	}
	return parseOpenAIVideoJob(body)
}

func (c *Client) retrieveXAIVideoJob(ctx context.Context, route RouteConfig, videoID string) (openAIVideoJob, error) {
	requestURL := buildXAIVideoResourceURL(route.BaseURL, videoID)
	if requestURL == "" {
		return openAIVideoJob{}, fmt.Errorf("invalid video id")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return openAIVideoJob{}, err
	}
	if apiKey := strings.TrimSpace(route.APIKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	setOpenRouterAttributionHeaders(req, route)
	setAdditionalHeaders(req, route.HeadersJSON)

	resp, err := c.httpClientForRoute(route).Do(req)
	if err != nil {
		return openAIVideoJob{}, err
	}
	defer resp.Body.Close() //nolint:errcheck
	body, err := readUpstreamBody(resp.Body)
	if err != nil {
		return openAIVideoJob{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return openAIVideoJob{}, parseUpstreamError(resp.StatusCode, body, upstreamDebugSnapshot(req, nil, resp, body))
	}
	return parseXAIVideoJob(body)
}

func (c *Client) downloadOpenAIVideoContent(ctx context.Context, route RouteConfig, videoID string) ([]byte, string, error) {
	requestURL := buildOpenAIVideoResourceURL(route.BaseURL, videoID, "/content")
	if requestURL == "" {
		return nil, "", fmt.Errorf("invalid video id")
	}
	parsed, err := url.Parse(requestURL)
	if err != nil {
		return nil, "", err
	}
	query := parsed.Query()
	query.Set("variant", "video")
	parsed.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, "", err
	}
	if apiKey := strings.TrimSpace(route.APIKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	setOpenRouterAttributionHeaders(req, route)
	setAdditionalHeaders(req, route.HeadersJSON)

	resp, err := c.httpClientForRoute(route).Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close() //nolint:errcheck
	data, err := readOpenAIVideoContentBody(resp.Body)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", parseUpstreamError(resp.StatusCode, data, upstreamDebugSnapshot(req, nil, resp, data))
	}
	mimeType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if idx := strings.Index(mimeType, ";"); idx >= 0 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	if mimeType == "" || strings.EqualFold(mimeType, "application/octet-stream") {
		mimeType = "video/mp4"
	}
	return data, mimeType, nil
}

func (c *Client) downloadXAIVideoContent(ctx context.Context, route RouteConfig, videoURL string) ([]byte, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(videoURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, "", fmt.Errorf("invalid video url")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, "", err
	}

	resp, err := c.httpClientForRoute(route).Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close() //nolint:errcheck
	data, err := readOpenAIVideoContentBody(resp.Body)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", parseUpstreamError(resp.StatusCode, data, upstreamDebugSnapshot(req, nil, resp, data))
	}
	mimeType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if idx := strings.Index(mimeType, ";"); idx >= 0 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	if mimeType == "" || strings.EqualFold(mimeType, "application/octet-stream") {
		mimeType = "video/mp4"
	}
	return data, mimeType, nil
}

func buildXAIVideoGenerationURL(route RouteConfig) string {
	return buildXAIVideoRequestURL(route, xAIVideoOperationGenerate)
}

func buildXAIVideoRequestAttempts(route RouteConfig, operation xAIVideoOperation) []xAIVideoRequestAttempt {
	primaryURL := buildXAIVideoRequestURL(route, operation)
	if strings.TrimSpace(primaryURL) == "" {
		return nil
	}
	attempts := []xAIVideoRequestAttempt{{URL: primaryURL, ApplyProxyFallbackBody: operation == xAIVideoOperationExtend && useXAIVideoOpenAIPathProxy(route.BaseURL)}}
	if operation == xAIVideoOperationExtend && !useDirectXAIVideoEndpoint(route.BaseURL) && !useXAIVideoOpenAIPathProxy(route.BaseURL) {
		fallbackURL := buildOpenAIRequestURL(route.BaseURL, EndpointVideoGenerations)
		if strings.TrimSpace(fallbackURL) != "" && fallbackURL != primaryURL {
			attempts = append(attempts, xAIVideoRequestAttempt{
				URL:                    fallbackURL,
				ApplyProxyFallbackBody: true,
			})
		}
	}
	return attempts
}

func buildXAIVideoRequestURL(route RouteConfig, operation xAIVideoOperation) string {
	if useXAIVideoOpenAIPathProxy(route.BaseURL) {
		return buildOpenAIRequestURL(route.BaseURL, EndpointVideoGenerations)
	}
	if operation == xAIVideoOperationExtend {
		return buildVersionedEndpointURL(route.BaseURL, "v1", "/videos/extensions")
	}
	if useDirectXAIVideoEndpoint(route.BaseURL) {
		return buildVersionedEndpointURL(route.BaseURL, "v1", "/videos/generations")
	}
	return buildOpenAIRequestURL(route.BaseURL, EndpointVideoGenerations)
}

func buildOpenAIVideoEditsURL(baseURL string) string {
	return buildVersionedEndpointURL(baseURL, "v1", "/videos/edits")
}

func buildXAIVideoResourceURL(baseURL string, videoID string) string {
	id := strings.TrimSpace(videoID)
	if id == "" {
		return ""
	}
	return buildVersionedEndpointURL(baseURL, "v1", "/videos/"+url.PathEscape(id))
}

func buildOpenAIVideoResourceURL(baseURL string, videoID string, suffix string) string {
	id := strings.TrimSpace(videoID)
	if id == "" {
		return ""
	}
	return buildVersionedEndpointURL(baseURL, "v1", "/videos/"+url.PathEscape(id)+strings.TrimSpace(suffix))
}

func readOpenAIVideoContentBody(reader io.Reader) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, maxOpenAIVideoDownloadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxOpenAIVideoDownloadBytes {
		return nil, fmt.Errorf("upstream video response body exceeds %d bytes", maxOpenAIVideoDownloadBytes)
	}
	return body, nil
}

func parseOpenAIVideoJob(body []byte) (openAIVideoJob, error) {
	parsed := make(map[string]interface{})
	if err := json.Unmarshal(body, &parsed); err != nil {
		return openAIVideoJob{}, err
	}
	progress, _ := modelParamFloat(parsed, "progress")
	errorPayload := asMap(parsed["error"])
	message := strings.TrimSpace(getString(errorPayload["message"]))
	if message == "" {
		message = strings.TrimSpace(getString(parsed["error_message"]))
	}
	return openAIVideoJob{
		ID:           strings.TrimSpace(getString(parsed["id"])),
		Status:       strings.TrimSpace(getString(parsed["status"])),
		Progress:     progress,
		ErrorMessage: message,
		RawJSON:      string(body),
	}, nil
}

func parseXAIVideoJob(body []byte) (openAIVideoJob, error) {
	parsed := make(map[string]interface{})
	if err := json.Unmarshal(body, &parsed); err != nil {
		return openAIVideoJob{}, err
	}
	progress, _ := modelParamFloat(parsed, "progress")
	errorPayload := asMap(parsed["error"])
	message := strings.TrimSpace(getString(errorPayload["message"]))
	if message == "" {
		message = strings.TrimSpace(getString(parsed["error_message"]))
	}
	id := strings.TrimSpace(getString(parsed["request_id"]))
	if id == "" {
		id = strings.TrimSpace(getString(parsed["id"]))
	}
	return openAIVideoJob{
		ID:           id,
		Status:       strings.TrimSpace(getString(parsed["status"])),
		Progress:     progress,
		ErrorMessage: message,
		VideoURL:     xAIVideoURLFromPayload(parsed),
		RawJSON:      string(body),
	}, nil
}

func xAIVideoURLFromPayload(payload map[string]interface{}) string {
	if len(payload) == 0 {
		return ""
	}
	for _, key := range []string{"video_url", "videoUrl", "url"} {
		if value := strings.TrimSpace(getString(payload[key])); value != "" {
			return value
		}
	}
	if value := xAIVideoURLFromVideoObject(asMap(payload["video"])); value != "" {
		return value
	}
	if value := xAIVideoURLFromVideoObject(asMap(payload["output"])); value != "" {
		return value
	}
	if value := xAIVideoURLFromVideoObject(asMap(payload["result"])); value != "" {
		return value
	}
	if value := xAIVideoURLFromVideoObject(asMap(payload["response"])); value != "" {
		return value
	}
	for _, item := range asSlice(payload["data"]) {
		if value := xAIVideoURLFromVideoObject(asMap(item)); value != "" {
			return value
		}
	}
	return ""
}

func xAIVideoURLFromVideoObject(payload map[string]interface{}) string {
	if len(payload) == 0 {
		return ""
	}
	for _, key := range []string{"video_url", "videoUrl", "url"} {
		if value := strings.TrimSpace(getString(payload[key])); value != "" {
			return value
		}
	}
	return xAIVideoURLFromVideoObject(asMap(payload["video"]))
}

func normalizeOpenAIVideoStatus(status string) string {
	switch strings.TrimSpace(strings.ToLower(status)) {
	case "completed", "succeeded", "success", "done":
		return "completed"
	case "failed", "cancelled", "canceled", "expired":
		value := strings.TrimSpace(strings.ToLower(status))
		if value == "canceled" {
			return "cancelled"
		}
		return value
	default:
		return "in_progress"
	}
}

func isXAIVideoRoute(route RouteConfig) bool {
	for _, candidate := range []string{
		route.ModelVendor,
		route.UpstreamModelVendor,
		route.UpstreamModel,
		route.BaseURL,
	} {
		value := strings.ToLower(strings.TrimSpace(candidate))
		if value == "xai" || strings.Contains(value, "grok-imagine-video") || strings.Contains(value, "api.x.ai") {
			return true
		}
	}
	return false
}

func useDirectXAIVideoEndpoint(baseURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return false
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	return host == "api.x.ai" || strings.HasSuffix(host, ".api.x.ai")
}

func useXAIVideoOpenAIPathProxy(baseURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return false
	}
	for _, segment := range strings.Split(strings.ToLower(parsed.EscapedPath()), "/") {
		if segment == "openai" {
			return true
		}
	}
	return false
}
