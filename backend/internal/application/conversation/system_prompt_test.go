package conversation

import (
	"strings"
	"testing"

	"github.com/kangzyz/Doub/backend/internal/application/channel"
	"github.com/kangzyz/Doub/backend/internal/infra/config"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
)

func TestResolveSystemPromptInjectionUsesNativeSystemPrompt(t *testing.T) {
	route := &channel.ResolvedRoute{
		Protocol:              llm.AdapterOpenAIResponses,
		ModelSystemPrompt:     "model rule",
		ModelCapabilitiesJSON: `{"supportsSystemPrompt":true}`,
	}

	got := resolveMessageSystemPromptInjection(config.Config{DefaultSystemPrompt: "global rule"}, route, false)
	if got.Content == "" {
		t.Fatal("expected system prompt content")
	}
	if got.InlineToUser {
		t.Fatal("expected native system prompt")
	}
	for _, want := range []string{"Global instructions", "global rule", "Model instructions", "model rule"} {
		if !strings.Contains(got.Content, want) {
			t.Fatalf("expected content to contain %q, got %q", want, got.Content)
		}
	}
}

func TestResolveMessageSystemPromptInjectionAddsHTMLVisualPrompt(t *testing.T) {
	route := &channel.ResolvedRoute{
		Protocol: llm.AdapterOpenAIResponses,
	}

	got := resolveMessageSystemPromptInjection(config.Config{}, route, true)
	if got.Content == "" {
		t.Fatal("expected request-level system prompt content")
	}
	if got.InlineToUser {
		t.Fatal("expected native system prompt")
	}
	for _, want := range []string{
		"Response format instructions",
		`回复 = 语义化 HTML 片段`,
		"视觉由 Cherry Studio CSS 统一管理",
		"禁止 style 属性",
		"并列卡片  .grid.grid-2|3 > .card.card-b|g|o|r|p",
		"在 .reply 中嵌入 ```mermaid",
		"完整网页/可交互 demo → ```html",
		"React 组件 → ```tsx",
		"架构示意优先 mermaid",
	} {
		if !strings.Contains(got.Content, want) {
			t.Fatalf("expected content to contain %q, got %q", want, got.Content)
		}
	}
	for _, old := range []string{"DOUB 全局 CSS", "不得加代码围栏", "4 空格缩进", "可点击来源", "用户请求优先"} {
		if strings.Contains(got.Content, old) {
			t.Fatalf("expected content not to contain old expanded prompt fragment %q, got %q", old, got.Content)
		}
	}
}

func TestHTMLVisualPromptInstructionMatchesProvidedFormat(t *testing.T) {
	if htmlVisualPromptInstruction != expectedHTMLVisualPromptInstruction() {
		t.Fatalf("html visual prompt drifted from the provided format\nwant:\n%s\n\ngot:\n%s", expectedHTMLVisualPromptInstruction(), htmlVisualPromptInstruction)
	}
}

func expectedHTMLVisualPromptInstruction() string {
	return `<format lang="zh-CN">
  <principle>
    回复 = 语义化 HTML 片段，外壳 <div class="reply">...</div>。
    只用预定义 class 标对语义，视觉由 Cherry Studio CSS 统一管理。
    禁止 style 属性、硬编码色值、自创 class、<br>、Markdown 敷衍排版。
    例外：≤3 句的线性回答可省略 .reply，直接 <p>。
  </principle>

  <core-mapping>
    ── 高频（必记）──
    标题 <h2>/<h3>｜段落 <p>｜要点 <ul>｜步骤 <ol>｜术语释义 <dl><dt><dd>
    引用 <blockquote>＋<cite>｜分隔 <hr>｜折叠 <details><summary>
    强调 <strong>｜重读 <em>｜高亮 <mark>｜缩写 <abbr>｜按键 <kbd>
    代码 <code> / <pre><code class="language-xxx">（必须标语言）
    上下标 <sup>/<sub>｜diff <ins>/<del>｜表格 <table>

    ── 布局 ──
    并列卡片  .grid.grid-2|3 > .card.card-b|g|o|r|p
    横向对比  .row > .col.card.card-x
    优缺点    .pros-cons > .pros / .cons
    指标板    .stats > .stat
    时间线    .timeline > .timeline-item

    ── 状态 ──
    标签 .badge.badge-b|g|o|r｜标签云 .tags > .tag.tag-g|o|p|r
    清单 ul.checklist > li.done|pending｜提示框 .note / .warn / .tip

    ── 高级（按需，勿滥用）──
    .tldr（长回复≥300字摘要）｜.pullquote（核心引言）
    .formula（公式+.label）｜<pre class="filetree">（.dir/.file/.hint）
    .terminal > .terminal-header/.terminal-body（.prompt/.cmd/.output/.comment/.error）
    .dialog > .dialog-msg[.right] > .dialog-avatar/.dialog-bubble[.dialog-name]
    <pre class="flow"> ASCII 图（仅限单向线性流：A → B → C；禁止用于包含/嵌套/同心/分层结构）
    .progress > 标签+.progress-bar[.ok|warn|danger]+数值
    （进度条允许唯一 style 例外：style="--pct:75%"）
    脚注 <sup class="fn-ref"> + <ol class="footnotes">
  </core-mapping>

  <decision-flow>
    0. 所有回复默认使用 .reply 语义 HTML 体系（.card、.grid、.pros-cons 等）
    1. 用户明确要求"画图/示意图/流程图/架构图/时序图/ER图/状态图/甘特图/思维导图"
       → 在 .reply 中嵌入 ` + "```" + `mermaid（flowchart/subgraph 表达包含关系）
    2. 用户明确要求画 mermaid 无法表达的几何图形（同心圆圈层、洋葱圈、涟漪、不规则形状）
       → 在 .reply 中嵌入 ` + "```" + `svg
    3. "做/实现/演示" → 重型渲染代码块（` + "```" + `html / ` + "```" + `tsx 等）
    4. 完整网页/可交互 demo → ` + "```" + `html（允许 <style>）
    5. React 组件 → ` + "```" + `tsx（hooks + tailwind）

    核心原则：.reply 是骨架，mermaid/svg 是骨架里的插图，不是替代品。
    判类型 → 先想"用哪个 .reply 组件表达" → 再想"是否需要配图"。
  </decision-flow>

  <other>
    简体中文｜高信息密度｜代码优先可运行｜长回复首段加 .tldr
    架构示意优先 mermaid，ASCII 仅用于线性流。
  </other>
</format>`
}

func TestResolveMessageSystemPromptInjectionSkipsHTMLVisualPromptWhenDisabled(t *testing.T) {
	route := &channel.ResolvedRoute{
		Protocol: llm.AdapterOpenAIResponses,
	}

	got := resolveMessageSystemPromptInjection(config.Config{}, route, false)
	if got.Content != "" {
		t.Fatalf("expected no system prompt content, got %q", got.Content)
	}
}

func TestResolveSystemPromptInjectionFallsBackWhenCapabilitiesDisableSystemPrompt(t *testing.T) {
	route := &channel.ResolvedRoute{
		Protocol:              llm.AdapterOpenAIResponses,
		ModelCapabilitiesJSON: `{"supportsSystemPrompt":false}`,
	}

	got := resolveMessageSystemPromptInjection(config.Config{DefaultSystemPrompt: "global rule"}, route, false)
	if !got.InlineToUser {
		t.Fatal("expected user prompt fallback")
	}
}

func TestResolveSystemPromptInjectionFallsBackWithSnakeCaseCapabilities(t *testing.T) {
	route := &channel.ResolvedRoute{
		Protocol:              llm.AdapterOpenAIResponses,
		ModelCapabilitiesJSON: `{"supports_system_prompt":false}`,
	}

	got := resolveMessageSystemPromptInjection(config.Config{DefaultSystemPrompt: "global rule"}, route, false)
	if !got.InlineToUser {
		t.Fatal("expected snake_case capability to use user prompt fallback")
	}
}

func TestResolveSystemPromptInjectionFallsBackWhenModeRequestsUserPrompt(t *testing.T) {
	route := &channel.ResolvedRoute{
		Protocol:              llm.AdapterOpenAIResponses,
		ModelCapabilitiesJSON: `{"systemPromptMode":"user"}`,
	}

	got := resolveMessageSystemPromptInjection(config.Config{DefaultSystemPrompt: "global rule"}, route, false)
	if !got.InlineToUser {
		t.Fatal("expected systemPromptMode=user to use user prompt fallback")
	}
}

func TestResolveSystemPromptInjectionFallsBackForGemma(t *testing.T) {
	route := &channel.ResolvedRoute{
		PlatformModelName: "gemma-3-27b",
		Protocol:          llm.AdapterGoogleGenerateContent,
	}

	got := resolveMessageSystemPromptInjection(config.Config{DefaultSystemPrompt: "global rule"}, route, false)
	if !got.InlineToUser {
		t.Fatal("expected Gemma to inline system prompt into user prompt")
	}
}

func TestInlineSystemPromptIntoLatestUserMessage(t *testing.T) {
	messages := []llm.Message{
		{Role: "user", Content: "first"},
		{Role: "assistant", Content: "answer"},
		{Role: "user", Content: "second"},
	}

	got := inlineSystemPromptIntoLatestUserMessage(messages, "system rule")
	if got[0].Content != "first" {
		t.Fatalf("expected first user message to stay unchanged, got %q", got[0].Content)
	}
	if !strings.Contains(got[2].Content, "<system_instructions>") || !strings.Contains(got[2].Content, "system rule") || !strings.Contains(got[2].Content, "second") {
		t.Fatalf("expected latest user message to include inline system prompt and original content, got %q", got[2].Content)
	}
}
