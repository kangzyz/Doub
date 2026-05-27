# DOUB Follow-Up Suggestions Implementation Research

## Relevant Files

* `backend/internal/application/conversation/service_metadata.go`
* `backend/internal/application/conversation/service_message_completion.go`
* `backend/internal/application/conversation/service_message_send.go`
* `backend/internal/application/conversation/service_text_task_route.go`
* `backend/internal/domain/conversation/types.go`
* `backend/internal/transport/http/conversation/handler_message_send.go`
* `backend/internal/transport/http/conversation/dto_response.go`
* `frontend/shared/api/conversation.ts`
* `frontend/shared/api/conversation.types.ts`
* `frontend/features/chat/hooks/use-chat-message-submit.ts`
* `frontend/features/chat/components/sections/chat-area.tsx`
* `frontend/features/chat/components/message/message-bot.tsx`

## Findings

* Existing title/label generation already provides the core backend pattern for follow-up generation:
  * resolve an internal text-task route through `resolveTextTaskRoute`;
  * use the configured task model with `follow` semantics;
  * call `llmClient.Generate` with a JSON-only prompt;
  * parse loose JSON and sanitize output;
  * record basic service usage.
* `persistSuccessfulMessageGeneration` is the post-response hook after the assistant message is persisted. It already triggers async metadata generation and message embedding.
* Current message persistence and DTOs do not include a field for follow-up suggestions.
* Current NDJSON stream types support `delta`, `usage`, process/think events, media events, compaction, and `completed`, but no follow-up event.
* The frontend stream reader currently waits until the HTTP response ends before resolving `streamMessage`, even if a `completed` event has already been seen.
* `ChatArea` can identify and pass per-message props into `ChatMessageBot`; follow-up UI can be added below assistant message content/meta.

## Recommended Technical Direction

* Add a persisted `followUpsJSON`/`follow_ups_json` field to assistant messages and expose it through backend DTOs and frontend message types.
* Reuse the title/label text-task routing pattern for follow-up generation, with a built-in prompt that returns `{ "follow_ups": [...] }`.
* Trigger follow-up generation automatically after a successful assistant reply, but keep it outside the main answer stream so the assistant answer is not delayed.
* For the active UI, add a small follow-up generation call after `streamMessage` completes, then update the assistant message locally and persist the generated suggestions. If generation fails or returns invalid JSON, hide suggestions without surfacing a user-facing error.
* Add static empty-chat suggestions as localized frontend data first; keep the item type separate from UI so it can later be sourced from admin settings.

## Open Product Decision

* Whether generated follow-up suggestions should appear only on the latest assistant message, or stay visible on all assistant messages that have persisted suggestions.
