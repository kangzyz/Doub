package conversation

import (
	"encoding/json"
	"strings"

	"github.com/kangzyz/Doub/backend/internal/application/channel"
	"github.com/kangzyz/Doub/backend/internal/infra/config"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
)

const (
	systemPromptModeNative     = "native"
	systemPromptModeUser       = "user"
	systemPromptModeInlineUser = "inline_user"
)

const htmlVisualPromptInstruction = `<format lang="zh-CN">
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

type systemPromptInjection struct {
	Content      string
	InlineToUser bool
}

type systemPromptLayer struct {
	title   string
	content string
}

type systemPromptCapabilities struct {
	SupportsSystemPrompt      *bool  `json:"supportsSystemPrompt"`
	SupportsSystemPromptSnake *bool  `json:"supports_system_prompt"`
	SystemPromptMode          string `json:"systemPromptMode"`
	SystemPromptModeSnake     string `json:"system_prompt_mode"`
}

// resolveMessageSystemPromptInjection 合并平台、模型和本次请求级系统提示词，并按路由能力决定注入方式。
func resolveMessageSystemPromptInjection(cfg config.Config, route *channel.ResolvedRoute, htmlVisualPrompt bool) systemPromptInjection {
	if route == nil {
		return systemPromptInjection{}
	}
	content := buildResolvedMessageSystemPrompt(cfg.DefaultSystemPrompt, route.ModelSystemPrompt, htmlVisualPrompt)
	if content == "" {
		return systemPromptInjection{}
	}
	return systemPromptInjection{
		Content:      content,
		InlineToUser: shouldInlineSystemPromptToUser(*route),
	}
}

// buildResolvedMessageSystemPrompt 把请求级输出格式指令放在全局/模型指令之后，避免覆盖更高优先级约束。
func buildResolvedMessageSystemPrompt(globalPrompt string, modelPrompt string, htmlVisualPrompt bool) string {
	layers := []systemPromptLayer{
		{title: "Global instructions", content: globalPrompt},
		{title: "Model instructions", content: modelPrompt},
	}
	if htmlVisualPrompt {
		layers = append(layers, systemPromptLayer{
			title:   "Response format instructions",
			content: htmlVisualPromptInstruction,
		})
	}
	return buildSystemPromptLayers(layers)
}

func buildSystemPromptLayers(layers []systemPromptLayer) string {
	sections := make([]string, 0, len(layers)+1)
	for _, layer := range layers {
		content := strings.TrimSpace(layer.content)
		if content == "" {
			continue
		}
		sections = append(sections, "# "+layer.title+"\n"+content)
	}
	if len(sections) == 0 {
		return ""
	}
	return strings.Join(append([]string{
		"The following instruction layers are ordered from highest to lowest priority. Higher-priority layers override lower-priority layers.",
	}, sections...), "\n\n")
}

// shouldInlineSystemPromptToUser 判断模型是否需要把系统提示词降级写入用户消息。
func shouldInlineSystemPromptToUser(route channel.ResolvedRoute) bool {
	mode, modeSet := systemPromptModeFromCapabilities(route.ModelCapabilitiesJSON)
	if modeSet {
		switch mode {
		case systemPromptModeUser, systemPromptModeInlineUser:
			return true
		case systemPromptModeNative:
			return !chatProtocolSupportsNativeSystemPrompt(route.Protocol)
		}
	}
	if supports, ok := supportsSystemPromptFromCapabilities(route.ModelCapabilitiesJSON); ok {
		return !supports || !chatProtocolSupportsNativeSystemPrompt(route.Protocol)
	}
	if routeLooksLikeGemma(route) {
		return true
	}
	return !chatProtocolSupportsNativeSystemPrompt(route.Protocol)
}

// chatProtocolSupportsNativeSystemPrompt 只列出已经确认能承载 system 角色的聊天协议。
func chatProtocolSupportsNativeSystemPrompt(protocol string) bool {
	switch llm.NormalizeAdapter(protocol) {
	case llm.AdapterOpenAIResponses,
		llm.AdapterOpenAIChatCompletions,
		llm.AdapterAnthropicMessages,
		llm.AdapterGoogleGenerateContent,
		llm.AdapterXAIResponses:
		return true
	default:
		return false
	}
}

func supportsSystemPromptFromCapabilities(raw string) (bool, bool) {
	payload, ok := decodeSystemPromptCapabilities(raw)
	if !ok {
		return false, false
	}
	if payload.SupportsSystemPrompt != nil {
		return *payload.SupportsSystemPrompt, true
	}
	if payload.SupportsSystemPromptSnake != nil {
		return *payload.SupportsSystemPromptSnake, true
	}
	return false, false
}

func systemPromptModeFromCapabilities(raw string) (string, bool) {
	payload, ok := decodeSystemPromptCapabilities(raw)
	if !ok {
		return "", false
	}
	for _, value := range []string{payload.SystemPromptMode, payload.SystemPromptModeSnake} {
		mode := strings.TrimSpace(strings.ToLower(value))
		if mode != "" {
			return mode, true
		}
	}
	return "", false
}

func decodeSystemPromptCapabilities(raw string) (systemPromptCapabilities, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return systemPromptCapabilities{}, false
	}
	var payload systemPromptCapabilities
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return systemPromptCapabilities{}, false
	}
	return payload, true
}

func routeLooksLikeGemma(route channel.ResolvedRoute) bool {
	values := []string{
		route.PlatformModelName,
		route.UpstreamModel,
		route.ModelVendor,
	}
	for _, value := range values {
		if strings.Contains(strings.ToLower(strings.TrimSpace(value)), "gemma") {
			return true
		}
	}
	return false
}

// inlineSystemPromptIntoLatestUserMessage 面向不支持 system 角色的模型，把指令注入最近一条用户消息。
func inlineSystemPromptIntoLatestUserMessage(messages []llm.Message, prompt string) []llm.Message {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return messages
	}
	result := cloneLLMMessages(messages)
	for index := len(result) - 1; index >= 0; index-- {
		if result[index].Role != "user" {
			continue
		}
		result[index] = prependUserPromptInstruction(result[index], prompt)
		return result
	}
	return append([]llm.Message{{
		Role:    "user",
		Content: formatInlineSystemPrompt(prompt, ""),
	}}, result...)
}

func prependUserPromptInstruction(message llm.Message, prompt string) llm.Message {
	if len(message.Parts) == 0 {
		message.Content = formatInlineSystemPrompt(prompt, message.Content)
		return message
	}

	parts := make([]llm.ContentPart, 0, len(message.Parts)+1)
	inserted := false
	for _, part := range message.Parts {
		if !inserted && part.Kind == llm.ContentPartText {
			part.Text = formatInlineSystemPrompt(prompt, part.Text)
			inserted = true
		}
		parts = append(parts, part)
	}
	if !inserted {
		parts = append([]llm.ContentPart{{
			Kind: llm.ContentPartText,
			Text: formatInlineSystemPrompt(prompt, message.Content),
		}}, parts...)
	}
	message.Parts = parts
	return message
}

func formatInlineSystemPrompt(prompt string, userContent string) string {
	prompt = strings.TrimSpace(prompt)
	userContent = strings.TrimSpace(userContent)
	if userContent == "" {
		return "<system_instructions>\n" + prompt + "\n</system_instructions>"
	}
	return "<system_instructions>\n" + prompt + "\n</system_instructions>\n\n<user_message>\n" + userContent + "\n</user_message>"
}
