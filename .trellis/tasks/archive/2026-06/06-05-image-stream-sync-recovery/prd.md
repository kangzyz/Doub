# 图片任务流断开后的后台同步体验

## Goal

图片生成/编辑任务遇到前端传输层读流错误时，不再展示红色“生成中断 / network error”。这类错误不代表后端生成失败，后端通常会继续生成并落库；前端应保持图片动态占位，展示“正在同步生成结果”，并通过现有 reload / resume 机制同步最终服务端状态。

## Requirements

* 仅图片生成和图片编辑任务启用后台同步体验，普通聊天流失败行为不变。
* 图片任务遇到可恢复传输错误时，不设置 assistant inline error，不触发错误 toast。
* 图片任务遇到可恢复传输错误时，继续显示 image loading 占位，并使用本地化状态文案 `mediaStatus.syncingResult`。
* 后端同 `runID` assistant 已成功时，服务端 success 状态、图片内容和附件优先，本地 pending/sync/error 状态不得覆盖。
* 后端明确返回业务错误或上游错误时，仍按真实错误展示。

## Acceptance Criteria

* [ ] 图片编辑实际成功但主 POST 流抛 `network error` 时，当前页面不显示红色“生成中断”，继续显示图片动态占位和“正在同步生成结果”。
* [ ] 同 `runID` 服务端 success 被 reload 拉到后，占位替换为最终图片，刷新前后显示一致。
* [ ] 上游真实失败如 `empty_stream` 仍显示真实错误，不进入后台同步占位。
* [ ] 普通聊天流失败仍显示原有“生成中断”。
* [ ] `cd frontend && pnpm lint` 通过。

## Definition of Done

* 前端状态合并以服务端成功消息为权威。
* 新增可见文案同时覆盖 `zh-CN` 和 `en-US`。
* 不新增后端接口，不改变现有 API wire contract。

## Technical Approach

* 在 `features/chat/hooks/use-chat-message-submit.ts` 中识别图片任务的可恢复传输错误。
* 可恢复传输错误包括普通 `Error/TypeError` 的 `network error`、`Failed to fetch`、读流中断，以及无后端 `errorCode/details` 的 `stream completed without final payload`。
* 带 `ApiError.errorCode` 或 `ApiError.details` 的错误视为真实服务端错误，不吞掉。
* 在 `features/chat/hooks/use-chat-branch-state.ts` 中修正 pending 与服务端同 run 消息的合并，服务端 success 时清除本地 alert/pending/streaming/file processing 状态。

## Decision (ADR-lite)

**Context**: 图片媒体任务后端使用请求取消隔离，前端流断开后任务仍可能成功完成。当前前端会把传输层错误写入本地 pending alert，导致刷新前显示错误、刷新后显示成功图片。

**Decision**: 图片任务传输层错误进入后台同步占位，而不是失败 UI；服务端同 run 成功消息优先覆盖本地临时状态。

**Consequences**: 用户不会看到误报的 network error；真实上游失败仍保留错误反馈。该实现依赖现有 reload / resume 机制，不新增协议。

## Out of Scope

* 不修改后端生成、上传或 stream contract。
* 不新增图片任务重试或备用路由。
* 不改变普通聊天流错误处理。

## Technical Notes

* Relevant specs: `.trellis/spec/frontend/api-integration.md`, `.trellis/spec/frontend/hook-guidelines.md`, `.trellis/spec/frontend/state-management.md`, `.trellis/spec/frontend/quality-guidelines.md`.
* Existing stream parser is in `frontend/shared/api/conversation.ts`.
* Existing pending/server reconciliation is in `frontend/features/chat/hooks/use-chat-branch-state.ts`.
