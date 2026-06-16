package conversation

import (
	"errors"
	"strings"
	"testing"

	"github.com/kangzyz/Doub/backend/internal/infra/llm"
)

func TestShouldNotFallbackToNonStreamingForUpstreamParamErrors(t *testing.T) {
	err := &llm.UpstreamError{StatusCode: 400, Message: "Param Incorrect"}
	if shouldFallbackToNonStreaming(err) {
		t.Fatalf("expected upstream param errors to return directly")
	}

	wrapped := errors.Join(ErrUpstreamRequestFailed, &llm.UpstreamError{StatusCode: 422, Message: "invalid stream"})
	if shouldFallbackToNonStreaming(wrapped) {
		t.Fatalf("expected upstream validation errors to return directly")
	}
}

func TestShouldFallbackToNonStreamingForExplicitStreamUnsupportedErrors(t *testing.T) {
	err := &llm.UpstreamError{StatusCode: 400, Message: "stream is not supported by this model"}
	if !shouldFallbackToNonStreaming(err) {
		t.Fatalf("expected explicit stream unsupported errors to fallback to non-streaming")
	}

	statusErr := &llm.UpstreamError{StatusCode: 405, Message: "method not allowed"}
	if !shouldFallbackToNonStreaming(statusErr) {
		t.Fatalf("expected stream transport status errors to fallback to non-streaming")
	}
}

func TestMessageErrorSummaryIncludesUpstreamBody(t *testing.T) {
	err := wrapUpstreamRequestError(&llm.UpstreamError{
		StatusCode: 400,
		Message:    "Param Incorrect",
		Body:       `{"error":{"message":"Param Incorrect","param":"tools[0].type"}}`,
		Debug: &llm.UpstreamDebugSnapshot{
			Request: llm.UpstreamDebugRequest{
				Method: "POST",
				Path:   "/v1/responses",
				Body:   `{"model":"grok-4"}`,
			},
			Response: llm.UpstreamDebugResponse{
				StatusCode: 400,
				Body:       `{"error":{"message":"Param Incorrect","param":"tools[0].type"}}`,
			},
		},
	})
	summary := MessageErrorSummary(err)
	if summary != "模型请求失败（HTTP 400）\n错误：Param Incorrect" {
		t.Fatalf("unexpected summary: %q", summary)
	}
	if debug := MessageErrorDebug(err); debug == nil || debug.Request.Path != "/v1/responses" {
		t.Fatalf("expected upstream debug snapshot, got %#v", debug)
	}
}

func TestMessageErrorDebugKeepsSnapshotButRemovesUpstreamNames(t *testing.T) {
	err := wrapUpstreamRequestError(&llm.UpstreamError{
		StatusCode: 502,
		Message:    "bad gateway",
		Debug: &llm.UpstreamDebugSnapshot{
			Request: llm.UpstreamDebugRequest{
				Method: "POST",
				Path:   "/v1/responses",
				Headers: map[string]string{
					"Authorization": "[redacted]",
					"Content-Type":  "application/json",
				},
				Body: `{"model":"grok-4","upstream_name":"Oi Hub","upstream":{"name":"Oi Hub","id":7},"messages":[{"role":"user","content":"hi"}]}`,
			},
			Response: llm.UpstreamDebugResponse{
				StatusCode: 502,
				Headers: map[string]string{
					"Provider":    "ExampleEdge",
					"Server":      "ExampleCDN",
					"X-Client-Ip": "127.0.0.1",
				},
				Body: `{"error":{"message":"bad gateway"},"upstreamName":"Oi Hub","data":{"upstream":{"displayName":"Oi Hub","status":"failed"}}}`,
			},
		},
	})

	debug := MessageErrorDebug(err)
	if debug == nil {
		t.Fatal("expected debug snapshot")
	}
	if debug.Request.Headers != nil || debug.Response.Headers != nil {
		t.Fatalf("expected public debug headers to be omitted, got request=%#v response=%#v", debug.Request.Headers, debug.Response.Headers)
	}
	for _, body := range []string{debug.Request.Body, debug.Response.Body} {
		if strings.Contains(body, "Oi Hub") || strings.Contains(body, "upstream_name") || strings.Contains(body, "upstreamName") || strings.Contains(body, "displayName") {
			t.Fatalf("expected upstream name fields removed, got %s", body)
		}
	}
	if !strings.Contains(debug.Request.Body, `"model":"grok-4"`) || !strings.Contains(debug.Response.Body, `"message":"bad gateway"`) {
		t.Fatalf("expected non-name debug body fields preserved, request=%s response=%s", debug.Request.Body, debug.Response.Body)
	}
}

func TestUnsupportedNativeToolTypeFromError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "message",
			err:  &llm.UpstreamError{StatusCode: 400, Message: "Unsupported tool type: code_interpreter"},
			want: "code_interpreter",
		},
		{
			name: "detail body",
			err:  &llm.UpstreamError{StatusCode: 400, Body: `{"detail":"Unsupported tool type: image_generation"}`},
			want: "image_generation",
		},
		{
			name: "openai tool not supported message",
			err:  &llm.UpstreamError{StatusCode: 400, Message: "Tool 'image_generation' is not supported with gpt-5.3-codex-spark."},
			want: "image_generation",
		},
		{
			name: "nested openai tool not supported body",
			err:  &llm.UpstreamError{StatusCode: 400, Body: `{"error":{"message":"Tool 'code_interpreter' is not supported with this model."}}`},
			want: "code_interpreter",
		},
		{
			name: "nested error message",
			err:  &llm.UpstreamError{StatusCode: 400, Body: `{"error":{"message":"Unsupported tool type: code_interpreter"}}`},
			want: "code_interpreter",
		},
		{
			name: "debug response body",
			err: &llm.UpstreamError{
				StatusCode: 400,
				Debug: &llm.UpstreamDebugSnapshot{
					Response: llm.UpstreamDebugResponse{Body: `{"detail":"Unsupported tool type: shell"}`},
				},
			},
			want: "shell",
		},
		{
			name: "stream unsupported is not native tool unsupported",
			err:  &llm.UpstreamError{StatusCode: 400, Message: "stream is not supported by this model"},
			want: "",
		},
		{
			name: "wrapped upstream error",
			err:  errors.Join(ErrUpstreamRequestFailed, &llm.UpstreamError{StatusCode: 400, Message: "unsupported tool type = `url_context`"}),
			want: "url_context",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := unsupportedNativeToolTypeFromError(tt.err); got != tt.want {
				t.Fatalf("unsupportedNativeToolTypeFromError() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRemoveNativeToolFromGenerateInput(t *testing.T) {
	originalTools := []interface{}{
		map[string]interface{}{"type": "web_search"},
		map[string]interface{}{"type": "code_interpreter", "container": map[string]interface{}{"type": "auto"}},
		map[string]interface{}{"type": "image_generation"},
	}
	input := llm.GenerateInput{
		Options: map[string]interface{}{
			"tools":       originalTools,
			"temperature": 0.2,
		},
	}

	next, ok := removeNativeToolFromGenerateInput(input, "code_interpreter")
	if !ok {
		t.Fatal("expected code_interpreter to be removed")
	}
	if next.Options["temperature"] != 0.2 {
		t.Fatalf("expected non-tool options to be preserved, got %#v", next.Options)
	}
	tools, ok := next.Options["tools"].([]interface{})
	if !ok {
		t.Fatalf("expected tools slice, got %#v", next.Options["tools"])
	}
	if len(tools) != 2 {
		t.Fatalf("expected two remaining tools, got %#v", tools)
	}
	for _, tool := range tools {
		payload, ok := tool.(map[string]interface{})
		if !ok {
			t.Fatalf("expected tool payload map, got %#v", tool)
		}
		if nativeToolTypeFromOptionPayload(payload) == "code_interpreter" {
			t.Fatalf("expected code_interpreter to be removed, got %#v", tools)
		}
	}
	if len(input.Options["tools"].([]interface{})) != 3 {
		t.Fatalf("expected original input tools to remain unchanged, got %#v", input.Options["tools"])
	}
}

func TestRemoveNativeToolFromGenerateInputDeletesToolsWhenEmpty(t *testing.T) {
	input := llm.GenerateInput{
		Options: map[string]interface{}{
			"tools": []interface{}{map[string]interface{}{"type": "code_interpreter"}},
		},
	}

	next, ok := removeNativeToolFromGenerateInput(input, "code_interpreter")
	if !ok {
		t.Fatal("expected code_interpreter to be removed")
	}
	if _, exists := next.Options["tools"]; exists {
		t.Fatalf("expected tools option to be deleted when empty, got %#v", next.Options["tools"])
	}
}
