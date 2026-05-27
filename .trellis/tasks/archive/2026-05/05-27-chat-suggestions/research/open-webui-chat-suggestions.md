# Open WebUI Chat Suggestions Research

Reference snapshot: `open-webui/open-webui` commit `3660bc00fd807deced3400a63bfa6db47811a3bb`.

## Reference Files

* `src/lib/components/chat/Suggestions.svelte`
* `src/lib/components/chat/ChatPlaceholder.svelte`
* `src/lib/components/chat/Placeholder.svelte`
* `src/lib/components/chat/Chat.svelte`
* `src/lib/components/chat/Messages/ResponseMessage.svelte`
* `src/lib/components/chat/Messages/ResponseMessage/FollowUps.svelte`
* `backend/open_webui/config.py`
* `backend/open_webui/routers/tasks.py`
* `backend/open_webui/utils/middleware.py`

## What Open WebUI Does

* Empty-chat prompt suggestions are configured as `default_prompt_suggestions`, with item shape `{ title: [primary, secondary], content }`.
* Empty-chat suggestions can be overridden per model through model metadata `suggestion_prompts`.
* The suggestions component shuffles suggestions, supports fuzzy filtering against current input through Fuse.js, hides results after long input, and renders a compact vertical/grid list.
* Clicking an empty-chat suggestion calls a shared `onSelect` handler with `{ type: "prompt", data: prompt.content }`.
* User setting `insertSuggestionPrompt` controls whether click inserts text into the composer or immediately submits.
* Follow-up suggestions are separate from empty-chat suggestions. They are generated after assistant responses by a task prompt that asks the model to return JSON `{ "follow_ups": [...] }`.
* Follow-up generation is streamed back as a `chat:message:follow_ups` event, then persisted on the assistant message as `followUps`.
* Follow-up UI displays only on the latest assistant message by default, with settings to keep older follow-ups visible and to insert rather than send.

## Useful Conventions to Borrow

* Keep the display label separate from the actual prompt sent to the model.
* For MVP, a simple item shape with `title`, optional `subtitle`, and `prompt` is enough.
* User-facing click behavior should be explicit because both "insert into input" and "send immediately" are valid.
* Follow-up suggestions have a larger backend and persistence surface than initial suggestions; they should be treated as a later phase unless explicitly required.

## Risks / Differences for DOUB

* Open WebUI is Svelte/Python; DOUB is Next.js/React frontend plus Go backend, so implementation should borrow behavior, not code.
* Open WebUI's dynamic follow-up feature requires task-model invocation, event streaming, message schema changes, and persistence. That is much larger than empty-state prompt suggestions.
* Open WebUI stores prompt suggestions in backend config and per-model metadata; DOUB currently does not expose equivalent suggestion metadata on public model DTOs.
