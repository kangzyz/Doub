# Implement OpenAI Video Generation and Upstream Sync

## Goal

Selectively integrate safe upstream changes while preserving DOUB fork policy, and implement a complete OpenAI video generation flow in chat. The video flow must support both text-to-video and image-to-video, route through `video_gen` models, save generated MP4 output as conversation attachments, and show video-specific UI affordances.

## Requirements

* Do not merge `upstream/main` directly into `main`; port upstream changes selectively in small, conflict-aware groups.
* Preserve local fork policy: do not restore billing/subscription/payment, default MCP management, PWA/version guard, SQLite/sqlite-vec, or DOUB branding/theme/Android/site asset changes.
* Add a `video_generation` chat submit task for models with `video_gen`.
* Add backend task routing for `TaskTypeVideoGeneration`, protocol `openai_video_generations`, and OpenAI Videos API adapter support.
* Add `POST /api/v1/conversations/:id/media/videos/generations/stream`.
* Support text-to-video with prompt-only JSON requests.
* Support image-to-video with exactly one reference image attachment, sent as official `input_reference`.
* Validate image-to-video inputs: one image only, MIME type `image/jpeg`, `image/png`, or `image/webp`, readable dimensions, and size-compatible temporary reference image.
* Save completed MP4 output as a conversation file attachment with assistant `contentType="video"`.
* Add video-specific chat UI: lucide `Video` icon, video model style, composer placeholder, single-image "reference first frame" state, video generation skeleton/status, and video attachment preview path.
* Preserve existing chat/image behavior.

## Acceptance Criteria

* [ ] Selecting a `video_gen` model and submitting prompt text creates a video generation task instead of showing the unsupported-model error.
* [ ] Selecting a `video_gen` model and submitting one supported image attachment performs image-to-video.
* [ ] Multiple attachments or non-image attachments are blocked before request submission with video-specific copy.
* [ ] Backend routes video tasks only to routes whose model/protocol support video generation.
* [ ] OpenAI adapter creates the video job, polls until terminal status, downloads `variant=video` content, and returns MP4 bytes.
* [ ] Generated video is saved through the existing file service, attached to the assistant message, and playable in the existing preview UI.
* [ ] Existing image generation/edit and chat submissions still work.
* [ ] Focused backend and frontend tests cover routing, submission decision, OpenAI adapter behavior, validation, and service persistence.

## Definition of Done

* Backend tests added or updated for video task routing, adapter, media service, and video file classification.
* Frontend tests added or updated for `resolveChatSubmitDecision` and video UI state where practical.
* `go test ./...` passes or any failures are documented as unrelated/blocking.
* Frontend lint/build/test commands are run according to available scripts, or skipped with a concrete reason.
* `git diff --check` passes.

## Technical Approach

* Reuse the existing image media generation architecture for streaming events, run creation, assistant message persistence, and file attachment creation.
* Extend LLM abstractions with `GeneratedVideo` instead of overloading `GeneratedImage`.
* Implement OpenAI video generation as an async job adapter: create, poll, download content.
* Use existing conversation attachment and file preview infrastructure for generated videos.
* Use existing upload limits and user quota; add video MIME/category support, but do not add a new admin setting in this task.
* For upstream integration, port only changes that match the existing upstream policy task and this implementation's needs.

## Out of Scope

* Raw merge of `upstream/main`.
* Billing, subscription, pricing, usage accounting, redemption, or payment features.
* Default MCP management, PWA/version guard, SQLite/sqlite-vec, and branding/theme replacement.
* Video edit, video extension, characters, Batch API, webhook resume, billing statistics, or advanced parameter UI beyond `size` and `seconds`.
* Uploading reference images to OpenAI Files as a separate user-visible step.

## Technical Notes

* Official OpenAI docs: `https://developers.openai.com/api/docs/guides/video-generation`.
* Official create API reference: `https://developers.openai.com/api/reference/resources/videos/methods/create/`.
* Current local code already recognizes `video_gen` and `openai_video_generations` in model catalog/admin display, but lacks frontend submit routing, backend task routing, HTTP endpoints, media service, and adapter implementation.
* Existing upstream policy lives in `.trellis/tasks/06-05-upstream-update-policy/prd.md` and `FORK_DIVERGENCE.md`.
