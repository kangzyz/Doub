package nativetool

import "strings"

// Definition describes a provider-native tool that the backend knows how to
// normalize and safely forward to an upstream adapter.
type Definition struct {
	Protocol         string
	Provider         string
	Type             string
	Key              string
	Label            string
	Description      string
	Payload          map[string]interface{}
	DefaultEnabled   bool
	RiskLevel        string
	UsageAliases     []string
	rawTypeFieldKeys []string
}

var protocolOrder = []string{
	"openai_chat_completions",
	"openai_responses",
	"anthropic_messages",
	"xai_responses",
	"gemini_generate_content",
	"google_image_generation",
}

var definitions = []Definition{
	{
		Protocol:       "openai_chat_completions",
		Provider:       "OpenAI",
		Type:           "web_search",
		Key:            "openai.web_search",
		Label:          "Web Search",
		Description:    "OpenAI hosted web search.",
		Payload:        map[string]interface{}{"type": "web_search"},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_search"},
	},
	{
		Protocol:       "openai_chat_completions",
		Provider:       "OpenAI",
		Type:           "web_search_preview",
		Key:            "openai.web_search_preview",
		Label:          "Web Search Preview",
		Description:    "OpenAI hosted web search preview tool.",
		Payload:        map[string]interface{}{"type": "web_search_preview"},
		DefaultEnabled: false,
		UsageAliases:   []string{"web_search_preview"},
	},
	{
		Protocol:       "openai_responses",
		Provider:       "OpenAI",
		Type:           "web_search",
		Key:            "openai.web_search",
		Label:          "Web Search",
		Description:    "OpenAI hosted web search.",
		Payload:        map[string]interface{}{"type": "web_search"},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_search"},
	},
	{
		Protocol:       "openai_responses",
		Provider:       "OpenAI",
		Type:           "web_search_preview",
		Key:            "openai.web_search_preview",
		Label:          "Web Search Preview",
		Description:    "OpenAI hosted web search preview tool.",
		Payload:        map[string]interface{}{"type": "web_search_preview"},
		DefaultEnabled: false,
		UsageAliases:   []string{"web_search_preview"},
	},
	{
		Protocol:       "openai_responses",
		Provider:       "OpenAI",
		Type:           "shell",
		Key:            "openai.shell",
		Label:          "Shell",
		Description:    "OpenAI hosted shell tool with an automatic container.",
		Payload:        map[string]interface{}{"type": "shell", "environment": map[string]interface{}{"type": "container_auto"}},
		DefaultEnabled: false,
		RiskLevel:      "high",
		UsageAliases:   []string{"shell"},
	},
	{
		Protocol:       "openai_responses",
		Provider:       "OpenAI",
		Type:           "image_generation",
		Key:            "openai.image_generation",
		Label:          "Image Generation",
		Description:    "OpenAI hosted image generation tool.",
		Payload:        map[string]interface{}{"type": "image_generation"},
		DefaultEnabled: true,
		UsageAliases:   []string{"image_generation"},
	},
	{
		Protocol:       "openai_responses",
		Provider:       "OpenAI",
		Type:           "code_interpreter",
		Key:            "openai.code_interpreter",
		Label:          "Code Interpreter",
		Description:    "OpenAI hosted code interpreter with an automatic container.",
		Payload:        map[string]interface{}{"type": "code_interpreter", "container": map[string]interface{}{"type": "auto"}},
		DefaultEnabled: true,
		RiskLevel:      "high",
		UsageAliases:   []string{"code_interpreter"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "web_search_20250305",
		Key:            "anthropic.web_search_20250305",
		Label:          "Web Search",
		Description:    "Anthropic hosted web search tool.",
		Payload:        map[string]interface{}{"type": "web_search_20250305", "name": "web_search"},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_search"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "web_search_20260209",
		Key:            "anthropic.web_search_20260209",
		Label:          "Web Search",
		Description:    "Anthropic hosted web search tool.",
		Payload:        map[string]interface{}{"type": "web_search_20260209", "name": "web_search", "allowed_callers": []string{"direct"}},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_search"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "web_fetch_20250910",
		Key:            "anthropic.web_fetch_20250910",
		Label:          "Web Fetch",
		Description:    "Anthropic hosted web fetch tool.",
		Payload:        map[string]interface{}{"type": "web_fetch_20250910", "name": "web_fetch"},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_fetch"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "web_fetch_20260209",
		Key:            "anthropic.web_fetch_20260209",
		Label:          "Web Fetch",
		Description:    "Anthropic hosted web fetch tool.",
		Payload:        map[string]interface{}{"type": "web_fetch_20260209", "name": "web_fetch", "allowed_callers": []string{"direct"}},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_fetch"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "code_execution_20250825",
		Key:            "anthropic.code_execution_20250825",
		Label:          "Code Execution",
		Description:    "Anthropic hosted code execution tool.",
		Payload:        map[string]interface{}{"type": "code_execution_20250825", "name": "code_execution"},
		DefaultEnabled: true,
		RiskLevel:      "high",
		UsageAliases:   []string{"code_execution"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "code_execution_20260120",
		Key:            "anthropic.code_execution_20260120",
		Label:          "Code Execution",
		Description:    "Anthropic hosted code execution tool.",
		Payload:        map[string]interface{}{"type": "code_execution_20260120", "name": "code_execution"},
		DefaultEnabled: true,
		RiskLevel:      "high",
		UsageAliases:   []string{"code_execution"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "advisor_20260301",
		Key:            "anthropic.advisor_20260301",
		Label:          "Advisor",
		Description:    "Anthropic hosted advisor tool.",
		Payload:        map[string]interface{}{"type": "advisor_20260301", "name": "advisor"},
		DefaultEnabled: true,
		UsageAliases:   []string{"advisor"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "tool_search_tool_regex_20251119",
		Key:            "anthropic.tool_search_tool_regex_20251119",
		Label:          "Tool Search Regex",
		Description:    "Anthropic hosted regex tool search.",
		Payload:        map[string]interface{}{"type": "tool_search_tool_regex_20251119", "name": "tool_search_tool_regex"},
		DefaultEnabled: true,
		UsageAliases:   []string{"tool_search_tool_regex"},
	},
	{
		Protocol:       "anthropic_messages",
		Provider:       "Anthropic",
		Type:           "tool_search_tool_bm25_20251119",
		Key:            "anthropic.tool_search_tool_bm25_20251119",
		Label:          "Tool Search BM25",
		Description:    "Anthropic hosted BM25 tool search.",
		Payload:        map[string]interface{}{"type": "tool_search_tool_bm25_20251119", "name": "tool_search_tool_bm25"},
		DefaultEnabled: true,
		UsageAliases:   []string{"tool_search_tool_bm25"},
	},
	{
		Protocol:       "xai_responses",
		Provider:       "xAI",
		Type:           "web_search",
		Key:            "xai.web_search",
		Label:          "Web Search",
		Description:    "xAI hosted web search.",
		Payload:        map[string]interface{}{"type": "web_search"},
		DefaultEnabled: true,
		UsageAliases:   []string{"web_search"},
	},
	{
		Protocol:       "xai_responses",
		Provider:       "xAI",
		Type:           "x_search",
		Key:            "xai.x_search",
		Label:          "X Search",
		Description:    "xAI hosted X search.",
		Payload:        map[string]interface{}{"type": "x_search"},
		DefaultEnabled: true,
		UsageAliases:   []string{"x_search"},
	},
	{
		Protocol:       "xai_responses",
		Provider:       "xAI",
		Type:           "code_interpreter",
		Key:            "xai.code_interpreter",
		Label:          "Code Interpreter",
		Description:    "xAI hosted code interpreter.",
		Payload:        map[string]interface{}{"type": "code_interpreter"},
		DefaultEnabled: true,
		RiskLevel:      "high",
		UsageAliases:   []string{"code_interpreter", "code_execution"},
	},
	{
		Protocol:         "gemini_generate_content",
		Provider:         "Google",
		Type:             "google_search",
		Key:              "google.google_search",
		Label:            "Google Search",
		Description:      "Google hosted search grounding tool.",
		Payload:          map[string]interface{}{"type": "google_search", "google_search": map[string]interface{}{}},
		DefaultEnabled:   true,
		UsageAliases:     []string{"google_search"},
		rawTypeFieldKeys: []string{"google_search", "googleSearch"},
	},
	{
		Protocol:         "gemini_generate_content",
		Provider:         "Google",
		Type:             "url_context",
		Key:              "google.url_context",
		Label:            "URL Context",
		Description:      "Google hosted URL context retrieval tool.",
		Payload:          map[string]interface{}{"type": "url_context", "url_context": map[string]interface{}{}},
		DefaultEnabled:   true,
		UsageAliases:     []string{"url_context", "urlContext"},
		rawTypeFieldKeys: []string{"url_context", "urlContext"},
	},
	{
		Protocol:         "gemini_generate_content",
		Provider:         "Google",
		Type:             "code_execution",
		Key:              "google.code_execution",
		Label:            "Code Execution",
		Description:      "Google hosted Python code execution tool.",
		Payload:          map[string]interface{}{"type": "code_execution", "code_execution": map[string]interface{}{}},
		DefaultEnabled:   true,
		RiskLevel:        "high",
		UsageAliases:     []string{"code_execution", "codeExecution"},
		rawTypeFieldKeys: []string{"code_execution", "codeExecution"},
	},
	{
		Protocol:         "google_image_generation",
		Provider:         "Google",
		Type:             "google_search",
		Key:              "google.google_search",
		Label:            "Google Search",
		Description:      "Google hosted search grounding tool.",
		Payload:          map[string]interface{}{"type": "google_search", "google_search": map[string]interface{}{}},
		DefaultEnabled:   true,
		UsageAliases:     []string{"google_search"},
		rawTypeFieldKeys: []string{"google_search", "googleSearch"},
	},
}

var dailyChatDefaultNativeToolTypesByProtocol = map[string][]string{
	"openai_chat_completions": {
		"web_search",
	},
	"openai_responses": {
		"web_search",
		"image_generation",
		"code_interpreter",
	},
	"gemini_generate_content": {
		"google_search",
		"url_context",
		"code_execution",
	},
}

// Definitions returns all known provider-native tool definitions.
func Definitions() []Definition {
	result := make([]Definition, 0, len(definitions))
	for _, definition := range definitions {
		result = append(result, cloneDefinition(definition))
	}
	return result
}

// DefinitionsByProtocol returns native tool definitions for one protocol.
func DefinitionsByProtocol(protocol string) []Definition {
	protocol = strings.TrimSpace(protocol)
	result := make([]Definition, 0)
	for _, definition := range definitions {
		if definition.Protocol == protocol {
			result = append(result, cloneDefinition(definition))
		}
	}
	return result
}

// DailyChatDefaultDefinitions returns the provider-native tools that are safe
// and useful enough to attach automatically for ordinary chat requests.
func DailyChatDefaultDefinitions(protocol string) []Definition {
	protocol = strings.TrimSpace(protocol)
	toolTypes := dailyChatDefaultNativeToolTypesByProtocol[protocol]
	if len(toolTypes) == 0 {
		return nil
	}
	result := make([]Definition, 0, len(toolTypes))
	for _, toolType := range toolTypes {
		if definition, ok := Find(protocol, toolType); ok {
			result = append(result, definition)
		}
	}
	return result
}

// Protocols returns the protocol keys that have native tool definitions.
func Protocols() []string {
	return append([]string(nil), protocolOrder...)
}

// Find returns a definition by protocol and provider-native type.
func Find(protocol string, toolType string) (Definition, bool) {
	protocol = strings.TrimSpace(protocol)
	toolType = strings.TrimSpace(toolType)
	for _, definition := range definitions {
		if definition.Protocol == protocol && definition.Type == toolType {
			return cloneDefinition(definition), true
		}
	}
	return Definition{}, false
}

// FindByKey returns the first definition with the given stable tool key.
func FindByKey(key string) (Definition, bool) {
	key = strings.TrimSpace(key)
	for _, definition := range definitions {
		if definition.Key == key {
			return cloneDefinition(definition), true
		}
	}
	return Definition{}, false
}

var nativeToolDeniedPayloadKeys = map[string]struct{}{
	"model":                {},
	"messages":             {},
	"input":                {},
	"instructions":         {},
	"prompt":               {},
	"system":               {},
	"systemInstruction":    {},
	"headers":              {},
	"api_key":              {},
	"apiKey":               {},
	"base_url":             {},
	"baseURL":              {},
	"stream":               {},
	"previous_response_id": {},
}

// PayloadFromOption recognizes and normalizes one options.tools item.
func PayloadFromOption(protocol string, raw map[string]interface{}) (Definition, map[string]interface{}, bool) {
	toolType := strings.TrimSpace(stringValue(raw["type"]))
	if toolType == "" {
		toolType = inferToolTypeFromRawKeys(protocol, raw)
	}
	if toolType == "" {
		return Definition{}, nil, false
	}
	definition, ok := Find(protocol, toolType)
	if !ok {
		return Definition{}, nil, false
	}
	return definition, buildPayload(definition, raw), true
}

// PayloadFromKey recognizes a stable native tool key and normalizes payload.
func PayloadFromKey(key string, raw map[string]interface{}) (Definition, map[string]interface{}, bool) {
	key = strings.TrimSpace(key)
	for _, definition := range definitions {
		if definition.Key != key {
			continue
		}
		matched, payload, ok := PayloadFromOption(definition.Protocol, raw)
		if !ok {
			continue
		}
		return matched, payload, true
	}
	return Definition{}, nil, false
}

func buildPayload(definition Definition, raw map[string]interface{}) map[string]interface{} {
	payload := cloneMap(raw)
	if payload == nil {
		payload = make(map[string]interface{})
	}
	for key := range nativeToolDeniedPayloadKeys {
		delete(payload, key)
	}
	for _, key := range definition.rawTypeFieldKeys {
		if _, canonical := definition.Payload[key]; !canonical {
			delete(payload, key)
		}
	}
	mergePayload(payload, definition.Payload)
	return payload
}

func mergePayload(dst map[string]interface{}, src map[string]interface{}) {
	for key, value := range src {
		srcMap, srcIsMap := value.(map[string]interface{})
		dstMap, dstIsMap := dst[key].(map[string]interface{})
		if srcIsMap && dstIsMap {
			mergePayload(dstMap, srcMap)
			continue
		}
		dst[key] = cloneValue(value)
	}
}

func inferToolTypeFromRawKeys(protocol string, raw map[string]interface{}) string {
	for _, definition := range definitions {
		if definition.Protocol != protocol {
			continue
		}
		for _, key := range definition.rawTypeFieldKeys {
			if _, ok := raw[key]; ok {
				return definition.Type
			}
		}
	}
	return ""
}

func cloneDefinition(definition Definition) Definition {
	definition.Payload = cloneMap(definition.Payload)
	definition.UsageAliases = append([]string(nil), definition.UsageAliases...)
	definition.rawTypeFieldKeys = append([]string(nil), definition.rawTypeFieldKeys...)
	return definition
}

func cloneMap(src map[string]interface{}) map[string]interface{} {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]interface{}, len(src))
	for key, value := range src {
		dst[key] = cloneValue(value)
	}
	return dst
}

func cloneValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		return cloneMap(typed)
	case []string:
		return append([]string(nil), typed...)
	case []interface{}:
		items := make([]interface{}, len(typed))
		for index, item := range typed {
			items[index] = cloneValue(item)
		}
		return items
	default:
		return typed
	}
}

func stringValue(value interface{}) string {
	if typed, ok := value.(string); ok {
		return typed
	}
	return ""
}
