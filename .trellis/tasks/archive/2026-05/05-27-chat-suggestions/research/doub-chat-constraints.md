# DOUB Chat Constraints Research

## Relevant Files

* `frontend/features/chat/components/app-chat-area.tsx`
* `frontend/features/chat/components/sections/chat-empty.tsx`
* `frontend/features/chat/components/sections/chat-input.tsx`
* `frontend/features/chat/hooks/use-chat-runtime.ts`
* `frontend/features/chat/hooks/use-chat-message-submit.ts`
* `frontend/features/chat/hooks/use-chat-model-options.ts`
* `frontend/features/chat/types/chat-runtime.ts`
* `frontend/features/chat/types/messages.ts`
* `frontend/shared/api/conversation.types.ts`
* `frontend/i18n/messages/en-US/chat.json`
* `frontend/i18n/messages/zh-CN/chat.json`
* `frontend/features/admin/model/conversation-settings.ts`
* `backend/internal/application/settings/seed.go`
* `backend/internal/application/settings/runtime_settings.go`

## Current Chat Shape

* `AppChatArea` owns the chat page composition, active conversation state, draft state, selected model, tools, attachments, and `ChatInput` props.
* Empty new-chat UI uses `ChatEmptyState` with only greeting text and centered `ChatInput`.
* The same `ChatInput` component is reused in empty mode and conversation mode.
* Message sending is encapsulated by `useChatRuntime` and `useChatMessageSubmit`.
* `onSendMessage` currently sends the trimmed current `draft`; there is no public `sendPrompt(prompt)` API.
* Creating a new conversation is already handled inside `submitMessage` when `conversationID` is absent.
* User settings already include chat composer behavior such as send shortcut, draft restore, draft preservation, markdown, model metadata visibility, and input height.

## Current Settings / Config Shape

* Admin conversation settings currently cover task model, title/label prompts, default system prompt, and model option policy.
* Runtime settings are seeded in Go and applied into `config.Runtime`.
* Public model options expose `capabilitiesJSON` parsed for `defaultOptions`, but no prompt suggestion metadata is currently mapped into `ChatModelOption`.
* User chat settings are fetched in `useChatModelOptions` through `getUserSettings`.

## Implementation Implications

* The lowest-risk MVP can be frontend-only: render localized static suggestions in `ChatEmptyState` / `AppChatArea`, and on click set `draft`.
* If the selected behavior is "click sends immediately", `useChatMessageSubmit` should expose a prompt-specific send function rather than relying on React state update timing.
* Backend-managed/admin-editable suggestions require new settings keys, API exposure to non-admin chat users, validation for JSON shape, frontend admin editor fields, and i18n copy.
* LLM-generated follow-up suggestions require message DTO changes, backend task generation, stream event support, persistence, frontend message rendering, and user/admin toggles.

## Recommended MVP Bias

Start with initial prompt suggestions only. Keep the data model shaped so it can later be sourced from admin settings or model metadata without rewriting the UI component.
