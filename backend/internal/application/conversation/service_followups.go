package conversation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	model "github.com/kangzyz/Doub/backend/internal/domain/conversation"
	"go.uber.org/zap"
)

const (
	conversationFollowUpsMessageMaxTokens = int64(7000)
	conversationFollowUpsPrompt           = `Generate 3 to 5 concise follow-up suggestions for the user after the conversation below. Return ONLY valid JSON.

## Constraints
1. **Language**: Use the same language as the latest user/assistant exchange.
2. **Usefulness**: Each suggestion must be a natural next user message that continues the current conversation.
3. **Scope**: Suggestions must fit normal text chat. Do not suggest image/media actions unless the conversation explicitly asks for them.
4. **Length**: Keep each suggestion short: max 24 Chinese characters or 12 English words.
5. **Format**: Strictly output valid JSON matching ` + "`" + `{ "follow_ups": ["...", "...", "..."] }` + "`" + ` without markdown code fences or explanatory text.

## Conversation
{{MESSAGES}}`
)

func (s *Service) maybeGenerateFollowUpsAsync(conversation model.Conversation, userMsg model.Message, assistantMsg model.Message) {
	if !shouldGenerateFollowUpsForAssistantMessage(assistantMsg) {
		return
	}
	if s.routeResolver == nil || s.llmClient == nil {
		return
	}

	go func() {
		asyncCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()

		followUps, err := s.generateAssistantFollowUps(asyncCtx, conversation, userMsg, assistantMsg)
		if err != nil {
			if s.logger != nil {
				s.logger.Warn("conversation_follow_ups_generation_failed",
					zap.Uint("conversation_id", conversation.ID),
					zap.Uint("message_id", assistantMsg.ID),
					zap.Error(err),
				)
			}
			return
		}
		if len(followUps) == 0 {
			return
		}
		raw, err := json.Marshal(followUps)
		if err != nil {
			return
		}
		if err := s.repo.UpdateMessageFollowUps(asyncCtx, assistantMsg.ID, string(raw)); err != nil && s.logger != nil {
			s.logger.Warn("conversation_follow_ups_update_failed",
				zap.Uint("conversation_id", conversation.ID),
				zap.Uint("message_id", assistantMsg.ID),
				zap.Error(err),
			)
		}
	}()
}

func shouldGenerateFollowUpsForAssistantMessage(message model.Message) bool {
	if message.Role != "assistant" {
		return false
	}
	if message.Status != "" && message.Status != "success" {
		return false
	}
	contentType := strings.TrimSpace(strings.ToLower(message.ContentType))
	if contentType != "" && contentType != "text" && contentType != "markdown" {
		return false
	}
	return strings.TrimSpace(message.Content) != ""
}

func (s *Service) generateAssistantFollowUps(ctx context.Context, conversation model.Conversation, userMsg model.Message, assistantMsg model.Message) ([]string, error) {
	messages, err := s.repo.ListMessageAncestors(ctx, conversation.ID, assistantMsg.ID, 10)
	if err != nil || len(messages) == 0 {
		messages = []model.Message{userMsg, assistantMsg}
	}
	renderedMessages := buildFollowUpsMessages(messages)
	if renderedMessages == "" {
		return nil, nil
	}
	prompt := strings.ReplaceAll(conversationFollowUpsPrompt, "{{MESSAGES}}", renderedMessages)
	out, err := s.callConversationMetadataLLM(ctx, s.cfg.Snapshot().ConversationTaskModel, conversation.Model, conversation.UserID, conversation.ID, prompt)
	if err != nil {
		return nil, fmt.Errorf("follow-ups llm generate: %w", err)
	}
	return sanitizeGeneratedFollowUps(parseGeneratedFollowUps(out.Text)), nil
}

func buildFollowUpsMessages(messages []model.Message) string {
	var sb strings.Builder
	for _, message := range messages {
		role := strings.TrimSpace(message.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		if sb.Len() > 0 {
			sb.WriteString("\n\n")
		}
		sb.WriteString(role)
		sb.WriteString(":\n")
		sb.WriteString(content)
	}
	return truncateByEstimatedTokens(strings.TrimSpace(sb.String()), conversationFollowUpsMessageMaxTokens)
}

func parseGeneratedFollowUps(raw string) []string {
	var payload struct {
		FollowUps      []string `json:"follow_ups"`
		FollowUpsCamel []string `json:"followUps"`
		Suggestions    []string `json:"suggestions"`
	}
	if unmarshalJSONObject(raw, &payload) != nil {
		return nil
	}
	if len(payload.FollowUps) > 0 {
		return payload.FollowUps
	}
	if len(payload.FollowUpsCamel) > 0 {
		return payload.FollowUpsCamel
	}
	return payload.Suggestions
}

func sanitizeGeneratedFollowUps(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	items := make([]string, 0, 5)
	for _, item := range raw {
		value := strings.Join(strings.Fields(strings.TrimSpace(item)), " ")
		value = strings.Trim(value, " \t\r\n-#\"'`“”‘’")
		if value == "" {
			continue
		}
		runes := []rune(value)
		if len(runes) > 120 {
			value = string(runes[:120])
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, strings.TrimSpace(value))
		if len(items) >= 5 {
			break
		}
	}
	if len(items) < 3 {
		return nil
	}
	return items
}
