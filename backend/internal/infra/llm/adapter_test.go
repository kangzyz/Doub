package llm

import (
	"testing"
)

func TestSupportsStreamingAdapter(t *testing.T) {
	if !SupportsStreamingAdapter(AdapterOpenAIImageGenerations) {
		t.Fatalf("expected image generations adapter to support upstream streaming")
	}
	if !SupportsStreamingAdapter(AdapterOpenAIResponses) {
		t.Fatalf("expected responses adapter to support streaming")
	}
	if SupportsStreamingAdapter(AdapterOpenAIImageEdits) {
		t.Fatalf("expected image edits adapter to remain non-streaming")
	}
	if !IsImplementedAdapter(AdapterOpenAIImageEdits) {
		t.Fatalf("expected image edits adapter to be implemented")
	}
	if got := DefaultEndpointForAdapter(AdapterOpenAIImageEdits); got != EndpointImageEdits {
		t.Fatalf("expected image edits endpoint, got %q", got)
	}
}

func TestSupportsImageGenerationStream(t *testing.T) {
	if !SupportsImageGenerationStream(AdapterOpenAIImageGenerations, "gpt-image-1") {
		t.Fatalf("expected gpt-image models to support image generation streaming")
	}
	if SupportsImageGenerationStream(AdapterOpenAIImageGenerations, "dall-e-3") {
		t.Fatalf("expected DALL-E models to remain non-streaming")
	}
	if SupportsImageGenerationStream(AdapterOpenAIResponses, "gpt-image-1") {
		t.Fatalf("expected non-image protocol to remain non-streaming for image generation")
	}
}
