package conversation

import (
	"encoding/json"
	"strings"

	model "github.com/kangzyz/Doub/backend/internal/domain/conversation"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
)

func syncUpstreamOutputThinking(traceRecorder *messageTraceRecorder, output *llm.GenerateOutput) string {
	if output == nil {
		return ""
	}
	assistantText, extractedThink := splitThinkingContent(output.Text)
	if assistantText == "" {
		assistantText = output.Text
	}
	if traceRecorder != nil && output.Reasoning != nil {
		traceRecorder.syncStructuredThink(
			output.Reasoning.Text,
			output.Reasoning.Summary,
			reasoningPayload(&llm.ReasoningDelta{
				EventType:        "response.completed",
				ItemID:           output.Reasoning.ItemID,
				Status:           output.Reasoning.Status,
				Kind:             messageTraceThinkKindContent,
				EncryptedContent: output.Reasoning.EncryptedContent,
			}),
		)
	} else if traceRecorder != nil && strings.TrimSpace(extractedThink) != "" {
		traceRecorder.syncStructuredThink(extractedThink, "", nil)
	}
	if traceRecorder != nil {
		traceRecorder.completeUpstreamThink()
	}
	return assistantText
}

func syncUpstreamOutputTrace(traceRecorder *messageTraceRecorder, output *llm.GenerateOutput, runID string) (string, []model.ToolCall) {
	if output == nil {
		return "", nil
	}
	// 原生 server-side tools 是上游在同一次 Responses 调用内部完成的工具。
	// 当本轮没有本地函数调用时，先记录工具再记录最终 reasoning，避免 UI 看起来缺少工具后的最后一次思考。
	var serverToolRows []model.ToolCall
	if shouldSyncServerToolsBeforeThinking(output) {
		serverToolRows = syncUpstreamServerToolCalls(traceRecorder, output, runID)
		return syncUpstreamOutputThinking(traceRecorder, output), serverToolRows
	}
	assistantText := syncUpstreamOutputThinking(traceRecorder, output)
	serverToolRows = syncUpstreamServerToolCalls(traceRecorder, output, runID)
	return assistantText, serverToolRows
}

func shouldSyncServerToolsBeforeThinking(output *llm.GenerateOutput) bool {
	return output != nil && len(output.ServerToolCalls) > 0 && len(output.ToolCalls) == 0
}

func syncUpstreamServerToolCalls(traceRecorder *messageTraceRecorder, output *llm.GenerateOutput, runID string) []model.ToolCall {
	if output == nil || len(output.ServerToolCalls) == 0 {
		return nil
	}
	rows := make([]model.ToolCall, 0, len(output.ServerToolCalls))
	for _, item := range output.ServerToolCalls {
		status := strings.TrimSpace(item.Status)
		switch status {
		case "", "completed":
			status = "success"
		case "in_progress", "queued", "generating", "partial_image":
			status = "streaming"
		}
		outputJSON := strings.TrimSpace(item.OutputJSON)
		if outputJSON == "" && isSearchServerToolCall(item) {
			outputJSON = citationsToolOutputJSON(output.Citations)
		}
		rows = append(rows, model.ToolCall{
			RunID:      strings.TrimSpace(runID),
			ToolCallID: strings.TrimSpace(item.ToolCallID),
			ToolType:   strings.TrimSpace(item.ToolType),
			ToolName:   strings.TrimSpace(item.ToolName),
			Status:     status,
			InputJSON:  strings.TrimSpace(item.ArgumentsJSON),
			OutputJSON: outputJSON,
			ErrorJSON:  strings.TrimSpace(item.ErrorJSON),
		})
	}
	if traceRecorder != nil {
		summary, markdown, payload := buildToolTrace(rows)
		traceRecorder.appendToolSection(summary, markdown, payload, messageTraceStatusCompleted)
	}
	return rows
}

func normalizeStreamServerToolStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "", "completed", "success":
		return "success"
	case "in_progress", "queued", "searching", "generating", "partial_image":
		return "streaming"
	case "failed", "error":
		return "error"
	default:
		return strings.TrimSpace(status)
	}
}

func traceStatusFromToolStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "streaming", "requested":
		return messageTraceStatusStreaming
	case "error", "failed":
		return messageTraceStatusError
	default:
		return messageTraceStatusCompleted
	}
}

func isSearchServerToolCall(item llm.ToolCall) bool {
	toolType := strings.ToLower(strings.TrimSpace(item.ToolType))
	toolName := strings.ToLower(strings.TrimSpace(item.ToolName))
	return strings.Contains(toolType, "search") || strings.Contains(toolName, "search")
}

func hasSuccessfulImageGenerationServerToolOutput(output *llm.GenerateOutput) bool {
	if output == nil {
		return false
	}
	for _, item := range output.ServerToolCalls {
		if !isImageGenerationServerToolCall(item) {
			continue
		}
		if !serverToolCallHasUsableImageOutputStatus(item.Status) {
			continue
		}
		if toolOutputHasImageSource(item.OutputJSON) {
			return true
		}
	}
	return false
}

func isImageGenerationServerToolCall(item llm.ToolCall) bool {
	toolType := strings.ToLower(strings.TrimSpace(item.ToolType))
	toolName := strings.ToLower(strings.TrimSpace(item.ToolName))
	return strings.Contains(toolType, "image_generation") || strings.Contains(toolName, "image_generation")
}

func serverToolCallHasUsableImageOutputStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case "", "completed", "success", "streaming", "in_progress", "generating", "partial_image":
		return true
	default:
		return false
	}
}

func toolOutputHasImageSource(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" {
		return false
	}
	var decoded interface{}
	if err := json.Unmarshal([]byte(value), &decoded); err == nil {
		return toolOutputValueHasImageSource(decoded)
	}
	return looksLikeImageSource(value)
}

func toolOutputValueHasImageSource(value interface{}) bool {
	switch typed := value.(type) {
	case string:
		return looksLikeImageSource(typed)
	case []interface{}:
		for _, item := range typed {
			if toolOutputValueHasImageSource(item) {
				return true
			}
		}
	case map[string]interface{}:
		for _, key := range []string{"url", "uri", "image_url", "b64_json", "base64", "partial_image_b64", "result"} {
			if toolOutputValueHasImageSource(typed[key]) {
				return true
			}
		}
		for _, item := range typed {
			if toolOutputValueHasImageSource(item) {
				return true
			}
		}
	}
	return false
}

func looksLikeImageSource(value string) bool {
	text := strings.TrimSpace(value)
	lower := strings.ToLower(text)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "data:image/") || strings.HasPrefix(lower, "blob:") {
		return true
	}
	compact := strings.Map(func(r rune) rune {
		if r == ' ' || r == '\n' || r == '\r' || r == '\t' {
			return -1
		}
		return r
	}, text)
	if len(compact) <= 80 {
		return false
	}
	for _, r := range compact {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '+' || r == '/' || r == '=' {
			continue
		}
		return false
	}
	return true
}

func citationsToolOutputJSON(citations []string) string {
	if len(citations) == 0 {
		return ""
	}
	items := make([]map[string]string, 0, len(citations))
	for _, citation := range citations {
		if value := strings.TrimSpace(citation); value != "" {
			items = append(items, map[string]string{"url": value})
		}
	}
	if len(items) == 0 {
		return ""
	}
	payload, err := json.Marshal(items)
	if err != nil {
		return ""
	}
	return string(payload)
}

func addLLMUsage(left llm.Usage, right llm.Usage) llm.Usage {
	return llm.Usage{
		InputTokens:        left.InputTokens + right.InputTokens,
		OutputTokens:       left.OutputTokens + right.OutputTokens,
		CacheReadTokens:    left.CacheReadTokens + right.CacheReadTokens,
		CacheWriteTokens:   left.CacheWriteTokens + right.CacheWriteTokens,
		CacheWrite5mTokens: left.CacheWrite5mTokens + right.CacheWrite5mTokens,
		CacheWrite1hTokens: left.CacheWrite1hTokens + right.CacheWrite1hTokens,
		ReasoningTokens:    left.ReasoningTokens + right.ReasoningTokens,
		Speed:              mergeLLMUsageSpeed(left.Speed, right.Speed),
		ServiceTier:        mergeLLMUsageServiceTier(left.ServiceTier, right.ServiceTier),
	}
}

func mergeLLMUsageSpeed(left string, right string) string {
	left = strings.TrimSpace(strings.ToLower(left))
	right = strings.TrimSpace(strings.ToLower(right))
	if left == "fast" || right == "fast" {
		return "fast"
	}
	if right != "" {
		return right
	}
	return left
}

func mergeLLMUsageServiceTier(left string, right string) string {
	left = strings.TrimSpace(strings.ToLower(left))
	right = strings.TrimSpace(strings.ToLower(right))
	if right != "" {
		return right
	}
	return left
}

func buildFinalToolSynthesisMessages(messages []llm.Message, instruction string) []llm.Message {
	result := make([]llm.Message, 0, len(messages)+1)
	result = append(result, messages...)
	result = append(result, llm.Message{
		Role:    "system",
		Content: strings.TrimSpace(instruction),
	})
	return result
}
