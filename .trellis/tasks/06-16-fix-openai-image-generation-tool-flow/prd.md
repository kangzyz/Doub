# 修复 OpenAI 图片生成工具兼容和状态流

## Goal

修复 OpenAI Responses 原生 `image_generation` 工具在聊天流中的两个问题：不支持该工具的模型应自动降级重试，支持该工具的模型在图片生成成功但无文本输出时不应被标记为“生成中断”，并且图片生成中的状态/预览应进入现有工具轨迹 UI。

## What I already know

* 用户遇到 `Tool 'image_generation' is not supported with gpt-5.3-codex-spark.`，说明并非所有 OpenAI Responses 模型都支持 `image_generation` 原生工具。
* 用户使用 `gpt-5.5` 时，上游返回了 `response.image_generation_call.in_progress`、`generating`、`partial_image` 等事件，图片实际生成成功，但应用最终显示“生成中断”且没有图片生成动画。
* 日志确认“生成中断”的直接错误为 `bufio.Scanner: token too long`：OpenAI Responses 图片工具把很大的 `partial_image_b64` 放在单个 SSE `data:` 行里，超过了普通 OpenAI 兼容流原来的 1MiB scanner token 上限。
* 用户在对话生成期间使用鼠标滚轮向上滚动，会被锁在最底部，无法查看上方消息。
* 前端 `frontend/features/chat/hooks/use-chat-model-options.ts` 的 daily chat 默认会为 `openai_responses` 注入 `web_search`、`image_generation`、`code_interpreter`。
* 后端 `service_message_send.go` 已有不支持原生工具时移除工具并重试的机制，但当前错误识别只覆盖 `Unsupported tool type: ...` 等格式。
* 后端 `openai_responses.go` 当前只识别部分 server-side tool 状态事件，未覆盖 `response.image_generation_call.generating` / `partial_image`。
* 后端聊天生成最终要求 `assistantText` 非空；纯图片工具结果可能无文本输出，从而被当成空响应错误。

## Requirements

* OpenAI Responses 聊天流遇到 `Tool '<tool>' is not supported ...`、`tool ... is not supported ...` 等错误时，应识别对应原生工具并移除后重试。
* Responses 图片工具流应把 `generating` 和 `partial_image` 事件同步成 streaming 工具轨迹，partial image 输出需要保留可被前端识别的图片数据。
* OpenAI 兼容流读取器应能接收超过 1MiB 的单行 SSE 图片 base64 事件，不应因 `bufio.Scanner: token too long` 中断。
* 当 Responses 原生 `image_generation` 工具成功返回图片结果但 assistant 文本为空时，本轮聊天应成功完成；如果上游流正常结束且只留下 `partial_image_b64`，也应视为可用图片结果。
* 工具图像生成进行中时，前端应显示图片生成/编辑同款动画，而不是只显示普通“工具调用中”文字。
* 成功完成后，工具图像生成的图片应直接渲染在正式助手回复正文中；工具轨迹只保留状态、提示词和诊断信息，不应成为图片唯一展示位置。
* 对话生成期间，用户使用滚轮/触摸/键盘离开底部时应中断自动贴底；只有用户重新回到真正底部或点击“滚动到底部”时才恢复自动贴底。

## Acceptance Criteria

* [x] 单元测试覆盖 `Tool 'image_generation' is not supported with ...` 并能返回 `image_generation`。
* [x] 单元测试覆盖 `response.image_generation_call.generating` / `partial_image` 被解析为 server-side tool call，并且 partial image 输出包含可显示的 base64 图片字段。
* [x] 单元测试覆盖超过 1MiB 的 Responses 图片工具 SSE `data:` 行不会触发 scanner token 过长错误。
* [x] 单元测试覆盖“只有 `image_generation` server-side tool 成功、无文本输出”的聊天结果不会触发空响应错误，包括流正常结束后只保留 `partial_image_b64` 的情况。
* [x] 前端消息组件会把活跃的原生 `image_generation` 工具调用切换到图片生成动画。
* [x] 前端消息组件会把完成后的原生 `image_generation` 图片渲染到正式助手回复正文，并避免工具调用面板重复展示同一张图片。
* [x] 相关 Go 测试通过。
* [x] 前端滚动控制修复后通过 lint。

## Definition of Done

* Tests added/updated for changed behavior.
* Lint / typecheck / relevant test commands pass or any skipped commands are documented.
* No broad model allowlist is hard-coded unless existing project conventions already require it.
* Streaming behavior remains compatible with web search / code interpreter / shell native tools.

## Technical Approach

Use backend capability-by-failure fallback as the primary compatibility mechanism, because model-specific OpenAI tool support changes over time and this code already has a retry path. Extend Responses stream parsing for image-generation-specific events, allow large single-line SSE image payloads, and relax the empty-text guard only when server-side image generation has stream-ended image output. Keep frontend changes minimal by detecting the existing trace payload shape in the message component.

## Decision (ADR-lite)

**Context**: OpenAI model/tool support is not uniform, and Responses native image generation can produce useful tool output without assistant text.

**Decision**: Treat unsupported native tool errors as recoverable by removing the named tool and retrying; treat successful image-generation server tool output as a valid assistant result even without text.

**Consequences**: First request may still hit an upstream 400 before automatic retry, but users avoid a failed turn. Pure image-tool chats may persist an empty markdown assistant body with process trace image output, rather than forcing the model to synthesize text.

## Out of Scope

* Building a complete OpenAI model/tool allowlist.
* Reworking default native tools configuration UI.
* Persisting Responses native image tool outputs as first-class file attachments.

## Technical Notes

* Likely backend files:
  * `backend/internal/application/conversation/service_helpers.go`
  * `backend/internal/application/conversation/service_message_send.go`
  * `backend/internal/application/conversation/service_tool_loop.go`
  * `backend/internal/infra/llm/openai_responses.go`
  * `backend/internal/infra/llm/client.go`
* Likely frontend files if needed:
  * `frontend/features/chat/hooks/use-chat-model-options.ts`
  * `frontend/features/chat/components/message/message-process-trace.tsx`
  * `frontend/features/chat/hooks/use-chat-scroll-controller.ts`
* Relevant specs:
  * `.trellis/spec/backend/ai-and-conversation.md`
  * `.trellis/spec/backend/error-handling.md`
  * `.trellis/spec/backend/quality-guidelines.md`
  * `.trellis/spec/frontend/api-integration.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/shared/code-quality.md`
