package conversation

import (
	"testing"

	"github.com/kangzyz/Doub/backend/internal/infra/config"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
)

func TestFilterModelOptionsAllowlistUsesDefaultAndProtocolPaths(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"temperature":  0.7,
		"service_tier": "PRIORITY",
		"model":        "override",
		"reasoning": map[string]interface{}{
			"effort":  "high",
			"summary": "auto",
			"extra":   true,
		},
		"text": map[string]interface{}{
			"verbosity": "low",
		},
		"stream_options": map[string]interface{}{
			"include_usage": true,
		},
	}, llm.AdapterOpenAIResponses, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  `{"default":["reasoning.effort"]}`,
	})

	if filtered["temperature"] != 0.7 {
		t.Fatalf("expected temperature to pass, got %#v", filtered)
	}
	if filtered["service_tier"] != "priority" {
		t.Fatalf("expected service_tier to pass, got %#v", filtered)
	}
	if _, ok := filtered["model"]; ok {
		t.Fatalf("expected model to be denied, got %#v", filtered)
	}
	reasoning := filtered["reasoning"].(map[string]interface{})
	if reasoning["effort"] != "high" || reasoning["summary"] != "auto" {
		t.Fatalf("expected allowed reasoning fields, got %#v", reasoning)
	}
	if _, ok := reasoning["extra"]; ok {
		t.Fatalf("expected unlisted reasoning.extra to be removed, got %#v", reasoning)
	}
	if _, ok := filtered["stream_options"]; ok {
		t.Fatalf("expected chat-only stream_options to be removed for responses, got %#v", filtered)
	}
}

func TestFilterModelOptionsRejectsUnsupportedOpenAIServiceTier(t *testing.T) {
	for _, serviceTier := range []string{"auto", "scale", "unknown"} {
		t.Run(serviceTier, func(t *testing.T) {
			filtered := filterModelOptions(map[string]interface{}{
				"temperature":  0.7,
				"service_tier": serviceTier,
			}, llm.AdapterOpenAIResponses, modelOptionPolicyConfig{
				Mode:             modelOptionPolicyAllowlist,
				AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
				DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
			})

			if _, ok := filtered["service_tier"]; ok {
				t.Fatalf("expected unsupported service_tier to be removed, got %#v", filtered)
			}
			if filtered["temperature"] != 0.7 {
				t.Fatalf("expected other allowed options to remain, got %#v", filtered)
			}
		})
	}
}

func TestFilterModelOptionsDenylistAllowsUnlistedAndRemovesDenied(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"temperature":          0.2,
		"custom_vendor_option": true,
		"previous_response_id": "resp_123",
		"reasoning": map[string]interface{}{
			"effort": "high",
		},
	}, llm.AdapterXAIResponses, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyDenylist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  `{"default":["reasoning.effort"]}`,
	})

	if filtered["custom_vendor_option"] != true {
		t.Fatalf("expected custom option to pass in denylist mode, got %#v", filtered)
	}
	if _, ok := filtered["previous_response_id"]; ok {
		t.Fatalf("expected previous_response_id to be hard denied, got %#v", filtered)
	}
	if reasoning, ok := filtered["reasoning"].(map[string]interface{}); ok {
		if _, ok := reasoning["effort"]; ok {
			t.Fatalf("expected configured deny path removed, got %#v", filtered)
		}
	}
}

func TestFilterModelOptionsOpenAIChatCompletionsAllowsThinkingType(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"reasoning": map[string]interface{}{
			"effort": "high",
			"extra":  true,
		},
		"thinking": map[string]interface{}{
			"type":          "enabled",
			"budget_tokens": 1024,
		},
	}, llm.AdapterOpenAIChatCompletions, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	thinking := filtered["thinking"].(map[string]interface{})
	if thinking["type"] != "enabled" {
		t.Fatalf("expected thinking.type to pass for chat completions, got %#v", filtered)
	}
	if _, ok := thinking["budget_tokens"]; ok {
		t.Fatalf("expected unlisted thinking.budget_tokens to be removed for chat completions, got %#v", filtered)
	}
	reasoning := filtered["reasoning"].(map[string]interface{})
	if reasoning["effort"] != "high" {
		t.Fatalf("expected reasoning.effort to pass for OpenAI-compatible chat, got %#v", filtered)
	}
	if _, ok := reasoning["extra"]; ok {
		t.Fatalf("expected unlisted reasoning.extra to be removed for chat completions, got %#v", filtered)
	}
}

func TestFilterModelOptionsAllowsReasoningPresetPaths(t *testing.T) {
	t.Run("anthropic output_config effort", func(t *testing.T) {
		filtered := filterModelOptions(map[string]interface{}{
			"output_config": map[string]interface{}{
				"effort": "high",
				"extra":  true,
			},
			"thinking": map[string]interface{}{
				"type": "adaptive",
			},
		}, llm.AdapterAnthropicMessages, modelOptionPolicyConfig{
			Mode:             modelOptionPolicyAllowlist,
			AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
			DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
		})

		outputConfig := filtered["output_config"].(map[string]interface{})
		if outputConfig["effort"] != "high" {
			t.Fatalf("expected output_config.effort to pass, got %#v", filtered)
		}
		if _, ok := outputConfig["extra"]; ok {
			t.Fatalf("expected unlisted output_config.extra to be removed, got %#v", filtered)
		}
	})

	t.Run("gemini thinking config", func(t *testing.T) {
		filtered := filterModelOptions(map[string]interface{}{
			"generationConfig": map[string]interface{}{
				"thinkingConfig": map[string]interface{}{
					"thinkingBudget":  4096,
					"thinkingLevel":   "HIGH",
					"includeThoughts": true,
				},
			},
		}, llm.AdapterGoogleGenerateContent, modelOptionPolicyConfig{
			Mode:             modelOptionPolicyAllowlist,
			AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
			DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
		})

		generationConfig := filtered["generationConfig"].(map[string]interface{})
		thinkingConfig := generationConfig["thinkingConfig"].(map[string]interface{})
		if thinkingConfig["thinkingBudget"] != 4096 || thinkingConfig["thinkingLevel"] != "HIGH" {
			t.Fatalf("expected Gemini thinking preset fields to pass, got %#v", filtered)
		}
		if _, ok := thinkingConfig["includeThoughts"]; ok {
			t.Fatalf("expected unlisted thinkingConfig.includeThoughts to be removed, got %#v", filtered)
		}
	})
}

func TestFilterModelOptionsPreservesOfficialNativeToolsOutsidePathPolicy(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"temperature": 0.4,
		"tools": []interface{}{
			map[string]interface{}{"type": "web_search_20260209", "foo": "bar"},
			map[string]interface{}{"type": "custom_tool", "name": "provider_lookup"},
			map[string]interface{}{"type": "web_search_20260209"},
			"invalid",
		},
	}, llm.AdapterAnthropicMessages, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: `{"default":["temperature"]}`,
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	if filtered["temperature"] != 0.4 {
		t.Fatalf("expected allowed scalar option to pass, got %#v", filtered)
	}
	tools, ok := filtered["tools"].([]map[string]interface{})
	if !ok || len(tools) != 1 {
		t.Fatalf("expected one sanitized official native tool, got %#v", filtered["tools"])
	}
	if tools[0]["type"] != "web_search_20260209" || tools[0]["name"] != "web_search" {
		t.Fatalf("expected sanitized web_search tool, got %#v", tools[0])
	}
	if _, ok := tools[0]["foo"]; ok {
		t.Fatalf("expected arbitrary tool fields to be removed, got %#v", tools[0])
	}
}

func TestFilterModelOptionsPreservesXAINativeToolsWhenToolsIsExplicitlyDenied(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"tools": []interface{}{
			map[string]interface{}{"type": "x_search", "extra": true},
			map[string]interface{}{"type": "not_official"},
		},
	}, llm.AdapterXAIResponses, modelOptionPolicyConfig{
		Mode:                       modelOptionPolicyDenylist,
		AllowedPathsJSON:           config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:            `{"default":["tools"]}`,
		NativeToolAllowedTypesJSON: `{"xai_responses":["x_search"]}`,
	})

	tools, ok := filtered["tools"].([]map[string]interface{})
	if !ok || len(tools) != 1 {
		t.Fatalf("expected official xAI native tool to bypass option denylist, got %#v", filtered)
	}
	if tools[0]["type"] != "x_search" {
		t.Fatalf("expected sanitized x_search tool, got %#v", tools[0])
	}
	if _, ok := tools[0]["extra"]; ok {
		t.Fatalf("expected arbitrary xAI tool fields to be removed, got %#v", tools[0])
	}
}

func TestFilterModelOptionsDropsProviderNativeToolsDisabledByPolicy(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"temperature": 0.4,
		"tools": []interface{}{
			map[string]interface{}{"type": "web_search_20260209"},
		},
	}, llm.AdapterAnthropicMessages, modelOptionPolicyConfig{
		Mode:                       modelOptionPolicyAllowlist,
		AllowedPathsJSON:           `{"default":["temperature"]}`,
		DeniedPathsJSON:            config.DefaultModelOptionDeniedPathsJSON(),
		NativeToolAllowedTypesJSON: `{"anthropic_messages":[]}`,
	})

	if filtered["temperature"] != 0.4 {
		t.Fatalf("expected allowed scalar option to pass, got %#v", filtered)
	}
	if _, ok := filtered["tools"]; ok {
		t.Fatalf("expected disabled native tools to be removed, got %#v", filtered)
	}
}

func TestFilterModelOptionsPreservesOpenAIResponsesNativeTools(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"tools": []interface{}{
			map[string]interface{}{"type": "web_search_preview", "extra": true},
			map[string]interface{}{"type": "shell"},
		},
	}, llm.AdapterOpenAIResponses, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: `{"default":[]}`,
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	tools, ok := filtered["tools"].([]map[string]interface{})
	if !ok || len(tools) != 5 {
		t.Fatalf("expected sanitized OpenAI native tools, got %#v", filtered)
	}
	previewTool, ok := toolsByType(tools, "web_search_preview")
	if !ok {
		t.Fatalf("expected web_search_preview to pass, got %#v", tools)
	}
	if _, ok := previewTool["extra"]; ok {
		t.Fatalf("expected arbitrary OpenAI tool fields to be removed, got %#v", previewTool)
	}
	shellTool, ok := toolsByType(tools, "shell")
	if !ok {
		t.Fatalf("expected shell to pass, got %#v", tools)
	}
	environment, ok := shellTool["environment"].(map[string]interface{})
	if !ok || environment["type"] != "container_auto" {
		t.Fatalf("expected shell environment to be normalized, got %#v", shellTool)
	}
	for _, toolType := range []string{"web_search", "image_generation", "code_interpreter"} {
		if _, ok := toolsByType(tools, toolType); !ok {
			t.Fatalf("expected daily OpenAI tool %s, got %#v", toolType, tools)
		}
	}
}

func TestFilterModelOptionsInjectsDailyChatNativeToolsByProtocol(t *testing.T) {
	t.Run("openai responses", func(t *testing.T) {
		filtered := filterModelOptions(nil, llm.AdapterOpenAIResponses, modelOptionPolicyConfig{
			Mode:             modelOptionPolicyAllowlist,
			AllowedPathsJSON: `{"default":[]}`,
			DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
		})

		tools, ok := filtered["tools"].([]map[string]interface{})
		if !ok || len(tools) != 3 {
			t.Fatalf("expected OpenAI daily chat tools, got %#v", filtered)
		}
		expected := []string{"web_search", "image_generation", "code_interpreter"}
		for index, toolType := range expected {
			if tools[index]["type"] != toolType {
				t.Fatalf("expected tool %d to be %q, got %#v", index, toolType, tools[index])
			}
		}
		for _, tool := range tools {
			if tool["type"] == "web_search_preview" || tool["type"] == "shell" {
				t.Fatalf("expected preview and shell to stay out of daily defaults, got %#v", tools)
			}
		}
	})

	t.Run("gemini generate content", func(t *testing.T) {
		filtered := filterModelOptions(map[string]interface{}{}, llm.AdapterGoogleGenerateContent, modelOptionPolicyConfig{
			Mode:             modelOptionPolicyAllowlist,
			AllowedPathsJSON: `{"default":[]}`,
			DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
		})

		tools, ok := filtered["tools"].([]map[string]interface{})
		if !ok || len(tools) != 3 {
			t.Fatalf("expected Gemini daily chat tools, got %#v", filtered)
		}
		for _, key := range []string{"google_search", "url_context", "code_execution"} {
			if _, ok := toolsByKey(tools, key); !ok {
				t.Fatalf("expected Gemini tool %s, got %#v", key, tools)
			}
		}
	})
}

func TestFilterModelOptionsPreservesGeminiGoogleSearchNativeTool(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"tools": []interface{}{
			map[string]interface{}{
				"type": "google_search",
				"google_search": map[string]interface{}{
					"time_range_filter": "week",
				},
				"extra": true,
			},
			map[string]interface{}{"type": "web_search"},
		},
	}, llm.AdapterGoogleGenerateContent, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: `{"default":[]}`,
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	tools, ok := filtered["tools"].([]map[string]interface{})
	if !ok || len(tools) != 3 {
		t.Fatalf("expected sanitized Gemini native tool, got %#v", filtered)
	}
	googleSearchTool, ok := toolsByKey(tools, "google_search")
	if !ok {
		t.Fatalf("expected google_search tool, got %#v", tools)
	}
	if _, ok := googleSearchTool["type"]; ok {
		t.Fatalf("expected Gemini google_search payload to omit internal type, got %#v", googleSearchTool)
	}
	googleSearch, ok := googleSearchTool["google_search"].(map[string]interface{})
	if !ok || googleSearch["time_range_filter"] != "week" {
		t.Fatalf("expected google_search settings to pass, got %#v", googleSearchTool)
	}
	if _, ok := googleSearchTool["extra"]; ok {
		t.Fatalf("expected arbitrary Gemini tool fields to be removed, got %#v", googleSearchTool)
	}
	for _, key := range []string{"url_context", "code_execution"} {
		if _, ok := toolsByKey(tools, key); !ok {
			t.Fatalf("expected daily Gemini tool %s, got %#v", key, tools)
		}
	}
}

func toolsByType(tools []map[string]interface{}, toolType string) (map[string]interface{}, bool) {
	for _, tool := range tools {
		if tool["type"] == toolType {
			return tool, true
		}
	}
	return nil, false
}

func toolsByKey(tools []map[string]interface{}, key string) (map[string]interface{}, bool) {
	for _, tool := range tools {
		if _, ok := tool[key]; ok {
			return tool, true
		}
	}
	return nil, false
}

func TestFilterModelOptionsGeminiPolicyKeyMatchesGoogleAdapter(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"generationConfig": map[string]interface{}{
			"temperature":      0.4,
			"responseMimeType": "application/json",
			"candidateCount":   3,
		},
	}, llm.AdapterGoogleGenerateContent, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	generationConfig := filtered["generationConfig"].(map[string]interface{})
	if generationConfig["temperature"] != 0.4 || generationConfig["responseMimeType"] != "application/json" {
		t.Fatalf("expected gemini allowlist fields, got %#v", generationConfig)
	}
	if _, ok := generationConfig["candidateCount"]; ok {
		t.Fatalf("expected unlisted gemini option removed, got %#v", generationConfig)
	}
}

func TestFilterModelOptionsOpenAIImageGenerationsAllowsImageParams(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"size":               "1024x1024",
		"quality":            "high",
		"response_format":    "b64_json",
		"output_format":      "webp",
		"output_compression": 80,
		"partial_images":     2,
		"prompt":             "override",
		"stream":             true,
	}, llm.AdapterOpenAIImageGenerations, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	if filtered["size"] != "1024x1024" || filtered["quality"] != "high" || filtered["response_format"] != "b64_json" {
		t.Fatalf("expected image generation params to pass, got %#v", filtered)
	}
	if filtered["output_format"] != "webp" || filtered["output_compression"] != 80 {
		t.Fatalf("expected image output params to pass, got %#v", filtered)
	}
	if _, ok := filtered["prompt"]; ok {
		t.Fatalf("expected prompt override to be hard denied, got %#v", filtered)
	}
	if _, ok := filtered["stream"]; ok {
		t.Fatalf("expected stream override to be hard denied, got %#v", filtered)
	}
	if filtered["partial_images"] != 2 {
		t.Fatalf("expected partial_images to pass for upstream image streaming, got %#v", filtered)
	}
}

func TestFilterModelOptionsOpenAIImageEditsAllowsEditParams(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"background":         "transparent",
		"input_fidelity":     "high",
		"n":                  1,
		"output_compression": 80,
		"output_format":      "webp",
		"partial_images":     2,
		"quality":            "high",
		"size":               "1024x1024",
		"prompt":             "override",
		"stream":             true,
	}, llm.AdapterOpenAIImageEdits, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	if filtered["background"] != "transparent" || filtered["input_fidelity"] != "high" {
		t.Fatalf("expected image edit params to pass, got %#v", filtered)
	}
	if filtered["partial_images"] != 2 || filtered["output_format"] != "webp" {
		t.Fatalf("expected image edit output params to pass, got %#v", filtered)
	}
	for _, key := range []string{"prompt", "stream"} {
		if _, ok := filtered[key]; ok {
			t.Fatalf("expected %s to be hard denied, got %#v", key, filtered)
		}
	}
}

func TestFilterModelOptionsXAIImageAllowsImageParams(t *testing.T) {
	filtered := filterModelOptions(map[string]interface{}{
		"aspect_ratio":    "16:9",
		"n":               2,
		"resolution":      "2K",
		"response_format": "b64_json",
		"prompt":          "override",
		"stream":          true,
		"quality":         "high",
	}, llm.AdapterXAIImage, modelOptionPolicyConfig{
		Mode:             modelOptionPolicyAllowlist,
		AllowedPathsJSON: config.DefaultModelOptionAllowedPathsJSON(),
		DeniedPathsJSON:  config.DefaultModelOptionDeniedPathsJSON(),
	})

	if filtered["aspect_ratio"] != "16:9" || filtered["resolution"] != "2K" || filtered["response_format"] != "b64_json" {
		t.Fatalf("expected xAI image params to pass, got %#v", filtered)
	}
	if filtered["n"] != 2 {
		t.Fatalf("expected xAI n param to pass, got %#v", filtered)
	}
	for _, key := range []string{"prompt", "stream", "quality"} {
		if _, ok := filtered[key]; ok {
			t.Fatalf("expected %s to be removed, got %#v", key, filtered)
		}
	}
}
