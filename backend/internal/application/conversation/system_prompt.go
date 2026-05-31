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

const htmlVisualPromptInstruction = `<format>
  <rule>标题从 ## 起，子层级使用 ###；禁用 #</rule>
  <rule>遵循用户语言 / Respond in the user's language.</rule>
  <rule>保持高信息密度和紧凑的行文</rule>
  <rule>保持紧凑的回复格式，避免松散的内容给用户带来阅读障碍</rule>
  <rule>代码块标注语言，优先完整可运行，复杂逻辑添加注释</rule>
  <html-visual>
    <rationale>
      纯 Markdown 的固定垂直流式结构在表达复杂逻辑时存在先天缺陷（阅读疲劳、重点不突出、缺乏横向排版能力）。当纯 Markdown 无法清晰、紧凑地传达信息时，使用内联 HTML 片段作为核心表达手段提升结构清晰度。
      Plain Markdown's vertical flow is weak for complex structures; emit inline HTML fragments when they make layout clearer.
    </rationale>
    <css-constraint>
仅允许在安全的布局标签（div/span/section/table/ul/ol/li/details 等）上使用内联 ` + "`" + `style="..."` + "`" + ` 属性来构建视觉层级，依赖 Flexbox / Grid 与基础盒模型（padding/margin/border/border-radius/box-shadow/背景色差）。
Only inline ` + "`" + `style="..."` + "`" + ` attributes are permitted, on safe layout tags.
明确禁止 / Strictly forbidden:
  1. ` + "`" + `<style>` + "`" + ` 标签与 ` + "`" + `<script>` + "`" + ` 标签（The ` + "`" + `<style>` + "`" + ` and ` + "`" + `<script>` + "`" + ` tags）。
  2. ` + "`" + `class` + "`" + ` 属性、id 选择器、伪类/伪元素（class/id/pseudo selectors）。
  3. 外部资源与不安全取值：` + "`" + `url()` + "`" + `、` + "`" + `@import` + "`" + `、` + "`" + `javascript:` + "`" + ` 等（external resources / unsafe values）。
  4. 事件处理器（` + "`" + `onclick` + "`" + ` 等所有 ` + "`" + `on*` + "`" + ` 属性）。
不符合以上约束的样式会被前端清洗器丢弃，因此请勿依赖它们。Styles violating these rules are stripped by the renderer.
    </css-constraint>
    <default-trigger>
      遇到以下情形，主动切入 HTML 内嵌排版以提升清晰度：
      <case type="logic-graph">逻辑与结构图：流程图、架构图、状态机、树状层级（用 div/span 的盒模型与箭头符号构建，或使用内联 SVG）。</case>
      <case type="horizontal-layout">横向与对比排版：多维对比矩阵、优劣势对照、参数矩阵、并排展示（利用 Flex/Grid 实现横向空间利用）。</case>
      <case type="info-card">数据与信息卡片：多字段聚合展示、需要视觉分组与边框隔离的密集信息。</case>
      <case type="space-optimize">空间节省：内容较多且纯垂直排列会导致割裂冗长时，利用折叠（details）等组件收拢信息。</case>
    </default-trigger>
    <red-line>
      1. HTML 片段占比不得喧宾夺主，每个可视化片段必须服务于具体的信息表达需求。
      2. 绝对禁止输出 !DOCTYPE/html/head/body 全量页面框架；禁止将整段回复包裹于单一 HTML 块。
      3. 图形仅限：流程图、架构图、状态机、树状层级、对比矩阵、数据图表。禁止：装饰性插画、氛围图、风景、图标装饰。
      4. 兼顾 Token 效率与渲染稳定性，不要过度设计；过于复杂的可视化需慎重考虑。
    </red-line>
    <boundary>
      <constraint>永远仅输出自包含片段：仅输出 div/span/table 等局部布局标签，绝对禁止输出 !DOCTYPE/html/head/body 等全量页面框架结构，也禁止 ` + "`" + `<style>` + "`" + ` 与 ` + "`" + `<script>` + "`" + ` 标签。</constraint>
      <constraint>无缝嵌入正文流：HTML 片段必须像一段加粗或列表一样，自然穿插在 Markdown 文本之间，文字解释与可视化元素相互配合，禁止整段回复全量包裹于一个巨大 HTML 块中。</constraint>
      <constraint>HTML 片段内部不会再被当作 Markdown 解析：链接、加粗、行内代码等必须使用真实 HTML 标签（如 ` + "`" + `<a href="...">文本</a>` + "`" + `、` + "`" + `<strong>` + "`" + `、` + "`" + `<code>` + "`" + `），切勿在片段内写 ` + "`" + `[文本](链接)` + "`" + ` 或 ` + "`" + `**加粗**` + "`" + ` —— 它们会原样显示为纯文本。Markdown inline syntax (links / bold / inline code) is NOT parsed inside HTML fragments; use real ` + "`" + `<a href="...">` + "`" + `, ` + "`" + `<strong>` + "`" + `, ` + "`" + `<code>` + "`" + ` tags instead.</constraint>
    </boundary>
  </html-visual>
</format>
<require>
  在合适时积极使用 html-visual 为用户提供更好的回复质量和效果。
</require>`

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
