# 修复图片生成参数在实际调用中缺失

## Goal

图片生成和图片编辑入口已经具备模型选择 UI，但实际使用时没有看到先前加入的图片生成参数传递与选择生效。需要定位并修复从前端选择、消息提交、后端会话处理到上游图片生成请求之间的参数丢失问题。

## What I already know

* 用户截图显示输入框右下角存在“图像生成 / 图像编辑”和 `gpt-image-2` 模型选择。
* 用户反馈此前版本已经增加过图片生成参数传递和选择，但实际使用时没有看到。
* 仓库已有相关未完成任务：`.trellis/tasks/06-16-fix-openai-image-generation-tool-flow/`。
* 当前仓库存在前端、后端和共享层规范，业务 API 位于 Go 后端，Next.js 前端是静态导出客户端。
* 前端 `ChatMediaOptions` 已支持 OpenAI 图片生成的 `size` 和 xAI 图片的 `aspect_ratio/resolution` 控件，但 `ChatInput` 只用 `selectedModel.protocols[0]` 判断当前协议。
* 前端当前只在 `image_generation` 和 `video_generation` 时渲染 `ChatMediaOptions`，`image_edit` 模式没有渲染图片编辑参数控件。
* 前端提交 hook 会把 `options` 写入 `MediaImageRequest`；后端 HTTP handler 也会把 `options` 放入 `MediaImageInput`。
* 后端媒体服务会用 `filterModelOptions` 按协议过滤 options；新默认配置包含图片参数路径，但 `NormalizeModelOptionAllowedPathsJSON` 当前只给旧部署自动补视频参数。

## Assumptions (temporary)

* 问题可能发生在前端只显示选择但没有把参数写入请求 payload。
* 问题也可能发生在后端接收后没有把图片生成选项传给 LLM provider 或 native tool。
* 本任务优先修复图片生成/编辑运行时参数丢失，不重新设计整体媒体生成 UI。

## Open Questions

* None.

## Requirements

* 保留现有图片生成/编辑入口和模型选择交互。
* 确保用户选择的图片生成参数在实际请求链路中可见并传递到后端/upstream 调用。
* 图片控件协议判断必须按当前媒体任务解析，不能只取模型协议列表第一个值。
* 图片编辑模式也应显示适用的图片参数控件，并用编辑协议过滤/映射。
* 旧部署的 `model_option_allowed_paths` 缺少图片协议路径时，运行时应自动补齐，避免已传入的图片参数被 allowlist 丢弃。
* 如果已有测试覆盖参数传递，需要补齐或修正；没有覆盖时添加聚焦测试。

## Acceptance Criteria

* [ ] 前端提交图片生成/编辑请求时包含所选模型和图片生成选项。
* [ ] 后端处理会话/媒体生成时不会丢弃图片生成选项。
* [ ] 上游图片生成请求能收到 UI 选择对应的参数。
* [ ] `gpt-image-*` 这类双能力模型在生成模式和编辑模式下分别显示对应参数控件。
* [ ] 旧 `model_option_allowed_paths` 只含聊天/视频路径时，运行时会补齐图片协议路径。
* [ ] 相关单元测试、类型检查或最小验证通过。

## Definition of Done

* Tests added/updated where appropriate.
* Lint/typecheck or targeted tests pass.
* Existing unrelated dirty changes are preserved.
* If behavior introduces a reusable convention, update Trellis spec notes.

## Out of Scope

* 重做图片生成 UI。
* 增加新的图片模型能力或新的上游 provider。
* 处理视频生成参数链路，除非共享代码必须同步修复。

## Technical Notes

* Frontend files inspected:
  * `frontend/features/chat/components/sections/chat-input.tsx`
  * `frontend/features/chat/components/sections/chat-media-options.tsx`
  * `frontend/features/chat/hooks/use-chat-message-submit.ts`
  * `frontend/features/chat/hooks/use-chat-model-options.ts`
  * `frontend/shared/api/conversation.types.ts`
* Backend files inspected:
  * `backend/internal/transport/http/conversation/dto_request.go`
  * `backend/internal/transport/http/conversation/handler_media.go`
  * `backend/internal/application/conversation/service_media_generation.go`
  * `backend/internal/application/conversation/model_option_policy.go`
  * `backend/internal/infra/config/config.go`
  * `backend/internal/infra/llm/openai_images.go`
