package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildOpenAIVideoCreateJSONRequest(t *testing.T) {
	body, contentType, debugBody, err := buildOpenAIVideoCreateRequest("sora-2", GenerateInput{
		Messages: []Message{{Role: "user", Content: "A cinematic product shot with a slow dolly-in"}},
		Options: map[string]interface{}{
			"size":    "1280x720",
			"seconds": 8,
			"stream":  true,
			"quality": "high",
		},
	})
	if err != nil {
		t.Fatalf("build video request: %v", err)
	}
	if contentType != "application/json" {
		t.Fatalf("expected JSON content type, got %q", contentType)
	}
	var payload map[string]interface{}
	if err = json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("decode video JSON body: %v", err)
	}
	if payload["model"] != "sora-2" || payload["prompt"] != "A cinematic product shot with a slow dolly-in" {
		t.Fatalf("unexpected model or prompt: %#v", payload)
	}
	if payload["size"] != "1280x720" || payload["seconds"] != "8" {
		t.Fatalf("expected official video params, got %#v", payload)
	}
	if _, ok := payload["stream"]; ok {
		t.Fatalf("stream must not be forwarded to Videos API: %#v", payload)
	}
	if _, ok := payload["quality"]; ok {
		t.Fatalf("unsupported video option must not be forwarded: %#v", payload)
	}
	var debug map[string]interface{}
	if err = json.Unmarshal(debugBody, &debug); err != nil {
		t.Fatalf("decode debug body: %v", err)
	}
	if debug["input_reference"] != nil {
		t.Fatalf("JSON text-to-video debug body must not invent input_reference: %#v", debug)
	}
}

func TestBuildOpenAIVideoCreateMultipartRequest(t *testing.T) {
	body, contentType, debugBody, err := buildOpenAIVideoCreateRequest("sora-2", GenerateInput{
		Messages: []Message{{
			Role: "user",
			Parts: []ContentPart{
				{Kind: ContentPartText, Text: "Animate this first frame with drifting camera movement"},
				{Kind: ContentPartImage, MimeType: "image/png", FileName: "first-frame.png", Data: []byte("png-data")},
			},
		}},
		Options: map[string]interface{}{
			"size":    "720x1280",
			"seconds": "4",
		},
	})
	if err != nil {
		t.Fatalf("build video multipart request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(body))
	req.Header.Set("Content-Type", contentType)
	if err = req.ParseMultipartForm(10 << 20); err != nil {
		t.Fatalf("parse video multipart body: %v", err)
	}
	form := req.MultipartForm
	if form.Value["model"][0] != "sora-2" || form.Value["prompt"][0] != "Animate this first frame with drifting camera movement" {
		t.Fatalf("unexpected video form fields: %#v", form.Value)
	}
	if form.Value["size"][0] != "720x1280" || form.Value["seconds"][0] != "4" {
		t.Fatalf("expected video params, got %#v", form.Value)
	}
	if len(form.File["input_reference"]) != 1 {
		t.Fatalf("expected one input_reference file, got %#v", form.File)
	}
	fileHeader := form.File["input_reference"][0]
	if fileHeader.Filename != "first-frame.png" {
		t.Fatalf("expected source filename, got %q", fileHeader.Filename)
	}
	var debug map[string]interface{}
	if err = json.Unmarshal(debugBody, &debug); err != nil {
		t.Fatalf("decode debug body: %v", err)
	}
	if debug["input_reference"] != true || debug["multipart"] != true {
		t.Fatalf("expected sanitized multipart debug body, got %#v", debug)
	}
}

func TestBuildOpenAIVideoEditMultipartRequestWithVideo(t *testing.T) {
	body, contentType, debugBody, err := buildOpenAIVideoEditRequest("sora-2", GenerateInput{
		Messages: []Message{{
			Role: "user",
			Parts: []ContentPart{
				{Kind: ContentPartText, Text: "Extend this clip with a slow push forward"},
				{Kind: ContentPartVideo, MimeType: "video/mp4", FileName: "source.mp4", Data: []byte("mp4-data")},
			},
		}},
		Options: map[string]interface{}{
			"size":     "1280x720",
			"duration": "8",
		},
	})
	if err != nil {
		t.Fatalf("build video edit multipart request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/videos/edits", bytes.NewReader(body))
	req.Header.Set("Content-Type", contentType)
	if err = req.ParseMultipartForm(10 << 20); err != nil {
		t.Fatalf("parse video edit multipart body: %v", err)
	}
	form := req.MultipartForm
	if form.Value["model"][0] != "sora-2" || form.Value["prompt"][0] != "Extend this clip with a slow push forward" {
		t.Fatalf("unexpected video edit form fields: %#v", form.Value)
	}
	if form.Value["size"][0] != "1280x720" || form.Value["seconds"][0] != "8" {
		t.Fatalf("expected video edit params, got %#v", form.Value)
	}
	if len(form.File["video"]) != 1 {
		t.Fatalf("expected one video file, got %#v", form.File)
	}
	if form.File["video"][0].Filename != "source.mp4" {
		t.Fatalf("expected source filename, got %q", form.File["video"][0].Filename)
	}
	var debug map[string]interface{}
	if err = json.Unmarshal(debugBody, &debug); err != nil {
		t.Fatalf("decode debug body: %v", err)
	}
	if debug["video"] != true || debug["multipart"] != true {
		t.Fatalf("expected sanitized video edit debug body, got %#v", debug)
	}
}

func TestBuildXAIVideoCreateRequestWithImage(t *testing.T) {
	payload, debugBody, err := buildXAIVideoCreateRequest("grok-imagine-video-1.5-preview", GenerateInput{
		Messages: []Message{{
			Role: "user",
			Parts: []ContentPart{
				{Kind: ContentPartText, Text: "Animate this first frame with drifting camera movement"},
				{Kind: ContentPartImage, MimeType: "image/png", FileName: "first-frame.png", Data: []byte("png-data")},
			},
		}},
		Options: map[string]interface{}{
			"size":         "720x1280",
			"seconds":      8,
			"stream":       true,
			"duration":     4,
			"aspect_ratio": "4:3",
			"resolution":   "480p",
		},
	})
	if err != nil {
		t.Fatalf("build xAI video request: %v", err)
	}
	if payload["model"] != "grok-imagine-video-1.5-preview" || payload["prompt"] != "Animate this first frame with drifting camera movement" {
		t.Fatalf("unexpected model or prompt: %#v", payload)
	}
	if payload["duration"] != 4 {
		t.Fatalf("expected duration option, got %#v", payload)
	}
	if payload["aspect_ratio"] != "4:3" || payload["resolution"] != "480p" {
		t.Fatalf("expected xAI video options, got %#v", payload)
	}
	for _, key := range []string{"size", "seconds", "stream"} {
		if _, ok := payload[key]; ok {
			t.Fatalf("unexpected xAI video param %q in payload %#v", key, payload)
		}
	}
	image := asMap(payload["image"])
	if image["type"] != "image_url" {
		t.Fatalf("expected image_url type, got %#v", image)
	}
	if url := getString(image["url"]); !strings.HasPrefix(url, "data:image/png;base64,cG5nLWRhdGE=") {
		t.Fatalf("expected base64 image data uri, got %q", url)
	}
	if strings.Contains(string(debugBody), "cG5nLWRhdGE=") {
		t.Fatalf("debug body must not include source image bytes: %s", string(debugBody))
	}
}

func TestBuildXAIVideoCreateRequestWithVideoUsesExtensionPayload(t *testing.T) {
	payload, debugBody, err := buildXAIVideoCreateRequest("grok-imagine-video-1.5-preview", GenerateInput{
		Messages: []Message{{
			Role: "user",
			Parts: []ContentPart{
				{Kind: ContentPartText, Text: "Extend this clip"},
				{Kind: ContentPartVideo, MimeType: "video/mp4", FileName: "source.mp4", Data: []byte("mp4-data")},
			},
		}},
		Options: map[string]interface{}{
			"duration":     8,
			"aspect_ratio": "16:9",
			"resolution":   "1080p",
		},
	})
	if err != nil {
		t.Fatalf("build xAI video extension request: %v", err)
	}
	if payload["duration"] != 8 {
		t.Fatalf("expected duration option, got %#v", payload)
	}
	if _, ok := payload["aspect_ratio"]; ok {
		t.Fatalf("extension payload must not include aspect_ratio: %#v", payload)
	}
	if _, ok := payload["resolution"]; ok {
		t.Fatalf("extension payload must not include resolution: %#v", payload)
	}
	video := asMap(payload["video"])
	if video["type"] != "video_url" {
		t.Fatalf("expected video_url type, got %#v", video)
	}
	if url := getString(video["url"]); !strings.HasPrefix(url, "data:video/mp4;base64,bXA0LWRhdGE=") {
		t.Fatalf("expected base64 video data uri, got %q", url)
	}
	if strings.Contains(string(debugBody), "bXA0LWRhdGE=") {
		t.Fatalf("debug body must not include source video bytes: %s", string(debugBody))
	}
}

func TestOpenAIVideoGenerationsPollsAndDownloadsMP4(t *testing.T) {
	requestCount := 0
	var createPayload map[string]interface{}
	mp4Bytes := []byte{0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/videos":
			if r.Method != http.MethodPost {
				t.Fatalf("unexpected create method: %s", r.Method)
			}
			if err := json.NewDecoder(r.Body).Decode(&createPayload); err != nil {
				t.Fatalf("decode create request: %v", err)
			}
			_, _ = w.Write([]byte(`{"id":"video_1","status":"queued"}`))
		case "/v1/videos/video_1":
			requestCount++
			_, _ = w.Write([]byte(`{"id":"video_1","status":"completed","progress":1}`))
		case "/v1/videos/video_1/content":
			if r.URL.Query().Get("variant") != "video" {
				t.Fatalf("expected variant=video, got %q", r.URL.RawQuery)
			}
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write(mp4Bytes)
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	client := NewClient()
	output, err := client.Generate(context.Background(), RouteConfig{
		Protocol:      AdapterOpenAIVideoGenerations,
		BaseURL:       server.URL,
		UpstreamModel: "sora-2",
		ReadTimeoutMS: 5000,
	}, GenerateInput{
		Messages: []Message{{Role: "user", Content: "A short establishing shot"}},
		Options:  map[string]interface{}{"size": "1280x720", "seconds": 4},
	})
	if err != nil {
		t.Fatalf("generate video: %v", err)
	}
	if createPayload["model"] != "sora-2" || createPayload["prompt"] != "A short establishing shot" {
		t.Fatalf("unexpected create payload: %#v", createPayload)
	}
	if requestCount != 1 {
		t.Fatalf("expected one poll request, got %d", requestCount)
	}
	if output.ResponseID != "video_1" || len(output.GeneratedVideos) != 1 {
		t.Fatalf("expected generated video output, got %#v", output)
	}
	if output.GeneratedVideos[0].MIMEType != "video/mp4" || !bytes.Equal(output.GeneratedVideos[0].Data, mp4Bytes) {
		t.Fatalf("unexpected generated video: %#v", output.GeneratedVideos[0])
	}
}

func TestXAIVideoGenerationsUsesImageEndpointAndDownloadsMP4(t *testing.T) {
	var requestPath string
	var requestBody map[string]interface{}
	mp4Bytes := []byte{0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/videos":
			requestPath = r.URL.Path
			if got := r.Header.Get("Authorization"); got != "Bearer xai-key" {
				t.Fatalf("unexpected auth header %q", got)
			}
			if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"request_id":"video_req_1","status":"queued"}`))
		case "/v1/videos/video_req_1":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"request_id":"video_req_1","status":"done","response":{"video":{"url":"` + serverURL(r) + `/download/video_req_1.mp4"}}}`))
		case "/download/video_req_1.mp4":
			if got := r.Header.Get("Authorization"); got != "" {
				t.Fatalf("download must not forward upstream auth header, got %q", got)
			}
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write(mp4Bytes)
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	output, err := NewClient().Generate(context.Background(), RouteConfig{
		Protocol:      AdapterOpenAIVideoGenerations,
		BaseURL:       server.URL + "/v1",
		APIKey:        "xai-key",
		UpstreamModel: "grok-imagine-video-1.5-preview",
		ModelVendor:   "xai",
		ReadTimeoutMS: 5000,
	}, GenerateInput{
		Messages: []Message{{
			Role: "user",
			Parts: []ContentPart{
				{Kind: ContentPartText, Text: "Animate this first frame"},
				{Kind: ContentPartImage, MimeType: "image/png", Data: []byte("source")},
			},
		}},
		Options: map[string]interface{}{"duration": 4, "aspect_ratio": "3:4", "resolution": "480p"},
	})
	if err != nil {
		t.Fatalf("generate xAI video: %v", err)
	}
	if requestPath != "/v1/videos" {
		t.Fatalf("expected xAI video endpoint, got %q", requestPath)
	}
	if requestBody["model"] != "grok-imagine-video-1.5-preview" || requestBody["prompt"] != "Animate this first frame" {
		t.Fatalf("unexpected request body: %#v", requestBody)
	}
	image := asMap(requestBody["image"])
	if image["type"] != "image_url" || !strings.HasPrefix(getString(image["url"]), "data:image/png;base64,c291cmNl") {
		t.Fatalf("expected image data uri, got %#v", requestBody)
	}
	if requestBody["duration"] != float64(4) || requestBody["aspect_ratio"] != "3:4" || requestBody["resolution"] != "480p" {
		t.Fatalf("expected xAI video params, got %#v", requestBody)
	}
	if output.ResponseID != "video_req_1" || len(output.GeneratedVideos) != 1 {
		t.Fatalf("expected generated video output, got %#v", output)
	}
	if output.GeneratedVideos[0].MIMEType != "video/mp4" || !bytes.Equal(output.GeneratedVideos[0].Data, mp4Bytes) {
		t.Fatalf("unexpected xAI generated video: %#v", output.GeneratedVideos[0])
	}
}

func TestXAIVideoGenerationsUsesProxyVideoEndpointForVideoInput(t *testing.T) {
	var requestPath string
	var requestBody map[string]interface{}
	mp4Bytes := []byte{0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/videos":
			requestPath = r.URL.Path
			if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"request_id":"video_req_2","status":"queued"}`))
		case "/v1/videos/video_req_2":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"request_id":"video_req_2","status":"done","response":{"video":{"url":"` + serverURL(r) + `/download/video_req_2.mp4"}}}`))
		case "/download/video_req_2.mp4":
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write(mp4Bytes)
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	output, err := NewClient().Generate(context.Background(), RouteConfig{
		Protocol:      AdapterOpenAIVideoGenerations,
		BaseURL:       server.URL + "/v1",
		APIKey:        "xai-key",
		UpstreamModel: "grok-imagine-video-1.5-preview",
		ModelVendor:   "xai",
		ReadTimeoutMS: 5000,
	}, GenerateInput{
		Messages: []Message{{
			Role: "user",
			Parts: []ContentPart{
				{Kind: ContentPartText, Text: "Extend this clip"},
				{Kind: ContentPartVideo, MimeType: "video/mp4", Data: []byte("source-video")},
			},
		}},
		Options: map[string]interface{}{"duration": 10, "aspect_ratio": "16:9", "resolution": "1080p"},
	})
	if err != nil {
		t.Fatalf("extend xAI video: %v", err)
	}
	if requestPath != "/v1/videos" {
		t.Fatalf("expected OpenAI-compatible proxy video endpoint, got %q", requestPath)
	}
	video := asMap(requestBody["video"])
	if video["type"] != "video_url" || !strings.HasPrefix(getString(video["url"]), "data:video/mp4;base64,c291cmNlLXZpZGVv") {
		t.Fatalf("expected video data uri, got %#v", requestBody)
	}
	if requestBody["operation"] != "extend" {
		t.Fatalf("expected proxy extension operation, got %#v", requestBody)
	}
	if requestBody["duration"] != float64(10) {
		t.Fatalf("expected duration on extension payload, got %#v", requestBody)
	}
	if _, ok := requestBody["aspect_ratio"]; ok {
		t.Fatalf("extension payload must not include aspect_ratio: %#v", requestBody)
	}
	if _, ok := requestBody["resolution"]; ok {
		t.Fatalf("extension payload must not include resolution: %#v", requestBody)
	}
	if output.ResponseID != "video_req_2" || len(output.GeneratedVideos) != 1 {
		t.Fatalf("expected generated video output, got %#v", output)
	}
	if output.GeneratedVideos[0].MIMEType != "video/mp4" || !bytes.Equal(output.GeneratedVideos[0].Data, mp4Bytes) {
		t.Fatalf("unexpected xAI extended video: %#v", output.GeneratedVideos[0])
	}
}

func TestBuildXAIVideoGenerationURLUsesDirectXAIEndpointOnlyForXAIHost(t *testing.T) {
	if got := buildXAIVideoGenerationURL(RouteConfig{BaseURL: "https://api.x.ai/v1"}); got != "https://api.x.ai/v1/videos/generations" {
		t.Fatalf("expected direct xAI endpoint, got %q", got)
	}
	if got := buildXAIVideoGenerationURL(RouteConfig{BaseURL: "https://cpa.vexown.com/openai/v1"}); got != "https://cpa.vexown.com/openai/v1/videos" {
		t.Fatalf("expected OpenAI-compatible proxy endpoint, got %q", got)
	}
	if got := buildXAIVideoRequestURL(RouteConfig{BaseURL: "https://api.x.ai/v1"}, xAIVideoOperationExtend); got != "https://api.x.ai/v1/videos/extensions" {
		t.Fatalf("expected direct xAI extension endpoint, got %q", got)
	}
	if got := buildXAIVideoRequestURL(RouteConfig{BaseURL: "https://cpa.vexown.com/openai/v1"}, xAIVideoOperationExtend); got != "https://cpa.vexown.com/openai/v1/videos" {
		t.Fatalf("expected proxy video endpoint, got %q", got)
	}
}

func serverURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}
