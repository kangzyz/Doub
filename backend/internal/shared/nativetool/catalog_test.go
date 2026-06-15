package nativetool

import "testing"

func TestPayloadFromOptionPreservesToolParametersAndFixesIdentity(t *testing.T) {
	_, payload, ok := PayloadFromOption("openai_responses", map[string]interface{}{
		"type": "shell",
		"environment": map[string]interface{}{
			"type":        "host",
			"max_runtime": "10m",
		},
	})
	if !ok {
		t.Fatal("expected shell native tool payload")
	}
	environment := payload["environment"].(map[string]interface{})
	if environment["type"] != "container_auto" {
		t.Fatalf("expected canonical shell environment, got %#v", payload)
	}
	if environment["max_runtime"] != "10m" {
		t.Fatalf("expected shell parameters to pass, got %#v", payload)
	}

	_, payload, ok = PayloadFromOption("google_image_generation", map[string]interface{}{
		"googleSearch":  map[string]interface{}{"dynamic_retrieval_config": map[string]interface{}{"mode": "MODE_DYNAMIC"}},
		"google_search": map[string]interface{}{"time_range_filter": "week"},
	})
	if !ok {
		t.Fatal("expected google_search native tool payload")
	}
	googleSearch := payload["google_search"].(map[string]interface{})
	if googleSearch["time_range_filter"] != "week" || payload["type"] != "google_search" {
		t.Fatalf("expected canonical google_search payload, got %#v", payload)
	}
	if _, ok := payload["googleSearch"]; ok {
		t.Fatalf("expected googleSearch alias to be normalized away, got %#v", payload)
	}
}

func TestPayloadFromOptionRemovesSystemControlledToolFields(t *testing.T) {
	_, payload, ok := PayloadFromOption("anthropic_messages", map[string]interface{}{
		"type":     "advisor_20260301",
		"name":     "override",
		"model":    "attacker-model",
		"headers":  map[string]interface{}{"Authorization": "Bearer token"},
		"max_uses": 2,
	})
	if !ok {
		t.Fatal("expected advisor native tool payload")
	}
	if payload["name"] != "advisor" {
		t.Fatalf("expected advisor identity to be fixed, got %#v", payload)
	}
	if payload["max_uses"] != 2 {
		t.Fatalf("expected safe advisor parameters to pass, got %#v", payload)
	}
	if _, exists := payload["model"]; exists {
		t.Fatalf("expected advisor model override to be removed, got %#v", payload)
	}
	if _, exists := payload["headers"]; exists {
		t.Fatalf("expected advisor headers override to be removed, got %#v", payload)
	}
}
