package conversation

import (
	"strings"
	"testing"

	model "github.com/kangzyz/Doub/backend/internal/domain/conversation"
)

func TestBuildFollowUpsMessagesTruncatesToBudget(t *testing.T) {
	messages := []model.Message{
		{Role: "system", Content: strings.Repeat("hidden", 100)},
		{Role: "user", Content: strings.Repeat("用户问题", 5000)},
		{Role: "assistant", Content: strings.Repeat("助手回答", 5000)},
	}

	got := buildFollowUpsMessages(messages)

	if tokens := estimateTokens(got); tokens > conversationFollowUpsMessageMaxTokens {
		t.Fatalf("follow-up messages exceeded budget: got %d, want <= %d", tokens, conversationFollowUpsMessageMaxTokens)
	}
	if !strings.HasPrefix(got, "user:\n") {
		t.Fatalf("expected follow-up context to start with user content, got %q", got[:min(len(got), 32)])
	}
	if strings.Contains(got, "hidden") {
		t.Fatal("expected system content to be excluded from follow-up context")
	}
}

func TestParseGeneratedFollowUpsAcceptsCommonShapes(t *testing.T) {
	cases := []string{
		`{"follow_ups":["下一步怎么做？","能举个例子吗？","有哪些风险？"]}`,
		"```json\n{\"followUps\":[\"What's next?\",\"Show an example\",\"What are the risks?\"]}\n```",
		`{"suggestions":["Refine the plan","Compare options","List tradeoffs"]}`,
	}
	for _, raw := range cases {
		got := sanitizeGeneratedFollowUps(parseGeneratedFollowUps(raw))
		if len(got) != 3 {
			t.Fatalf("expected three follow-ups for %q, got %#v", raw, got)
		}
	}
}

func TestSanitizeGeneratedFollowUpsRejectsInvalidOutput(t *testing.T) {
	cases := [][]string{
		{"only one"},
		{"", "  ", "valid"},
	}
	for _, raw := range cases {
		if got := sanitizeGeneratedFollowUps(raw); len(got) != 0 {
			t.Fatalf("expected invalid follow-ups to be hidden, got %#v", got)
		}
	}
}

func TestShouldGenerateFollowUpsForAssistantMessage(t *testing.T) {
	if !shouldGenerateFollowUpsForAssistantMessage(model.Message{Role: "assistant", ContentType: "text", Content: "Done", Status: "success"}) {
		t.Fatal("expected successful text assistant message to be eligible")
	}
	if shouldGenerateFollowUpsForAssistantMessage(model.Message{Role: "assistant", ContentType: "image", Content: "![img](url)", Status: "success"}) {
		t.Fatal("expected image assistant message to be ineligible")
	}
	if shouldGenerateFollowUpsForAssistantMessage(model.Message{Role: "assistant", ContentType: "text", Content: "Done", Status: "error"}) {
		t.Fatal("expected failed assistant message to be ineligible")
	}
}
