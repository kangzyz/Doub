# AI, Conversation, And Runtime Guidelines

DOUB Chat owns AI orchestration in backend application services. Do not add a
separate SDK-driven API layer or move provider rules into the frontend.

## Conversation Flow

`backend/internal/application/conversation` owns chat send, streaming,
branching, files, RAG, memory, prompt shaping, tool loops, process traces, and
message persistence. The largest flow is
`service_message_send.go`.

When changing chat behavior, check the related focused files and tests:

- `service_branch.go` and `service_branch_test.go`
- `service_cache.go` and `service_cache_test.go`
- `service_file_context.go` and `service_file_context_test.go`
- `service_mcp_tools.go` and `service_mcp_tools_test.go`
- `prompt_plan.go` and `prompt_plan_test.go`
- `generation_stream.go` and `generation_stream_test.go`

## Model Routing

Platform model names are resolved to upstream models by
`internal/application/channel`. Route identity should include platform model,
upstream, upstream model, binding code, protocol, vendor, and icon snapshots.
`service_routing_test.go` documents important identity and circuit-key rules.

Do not hard-code provider-private routing rules in frontend code. Frontend model
controls should consume model capability JSON and backend-provided policy.

## Streaming And Trace Events

Streaming endpoints emit NDJSON: each event is one JSON object followed by a
newline. The parser lives in `frontend/shared/api/conversation.ts`. Backend
events include delta text, usage, file processing, RAG search, compaction, media
status, process updates, and upstream thinking.

If you add or rename an event:

- Update backend stream emission.
- Update `StreamMessageEvent` types in `frontend/shared/api/conversation.types.ts`.
- Update `normalizeStreamEvent` and event handlers in
  `frontend/shared/api/conversation.ts`.
- Add translations or UI handling in feature components if the event is visible.

## RAG, Files, And Memory

File processing, extraction, embeddings, RAG retrieval, and memory are backend
concerns. The frontend should render structured status from backend DTOs and
trace blocks, not infer processing state from filenames or provider-specific
details.

Keep prompt and trace data safe. Trace should explain process status without
leaking hidden prompts, raw file contents, API keys, or tool secrets.

## Scenario: Media Image Edit Endpoint

### 1. Scope / Trigger

Use this contract when implementing or changing conversation-scoped image
editing. It is an infra and cross-layer path: frontend sends uploaded
`fileIDs`, application service reads object storage, LLM infra calls an
OpenAI-compatible Images API endpoint, and conversation persistence stores both
source and generated image attachments.

### 2. Signatures

- HTTP: `POST /api/v1/conversations/:id/media/images/edits/stream`
- Application: `Service.StreamMediaImage(ctx, MediaImageInput{TaskType:
  MediaImageTaskEdit, Prompt, FileIDs, Options, ...})`
- LLM route protocol: `openai_image_edits`
- LLM endpoint: `image_edits` -> `POST <baseURL>/v1/images/edits`
- For dual-kind OpenAI Images models such as `["image_gen","image_edit"]`, a
  single active route may be stored with either OpenAI Images protocol. The
  channel resolver must derive the effective protocol from the media task before
  the conversation service builds `llm.RouteConfig`.

### 3. Contracts

- Request `prompt` is required and trimmed before use.
- Request `fileIDs` must reference 1 to 16 active files owned by the user.
- Source files must be image objects backed by object storage; supported edit
  MIME types are `image/png`, `image/jpeg`, and `image/webp`.
- The LLM adapter sends `multipart/form-data` with `model`, `prompt`, one or
  more `image[]` file parts, and allowed image edit options only.
- Supported edit options include `quality`, `size`, `n`, `user`; GPT-image
  models may also receive `background`, `moderation`, `output_format`,
  `output_compression`, and `input_fidelity`.
- For upstream OpenAI-compatible image edit streaming with `partial_images`
  omitted or set to `1`, a received `image_edit.partial_image` is accepted as
  the final image if the stream later fails with a
  `stream idle timeout` before a completed/final event. The application service
  must save the latest partial image and emit the normal `completed` response.
  This fallback is edit-only and must not apply when `partial_images` is greater
  than `1`.
- The user message stores source image attachment snapshots and attachment
  rows. The assistant message stores generated image files and markdown using
  `/api/v1/files/<file_id>/content`.
- Upstream debug snapshots for multipart image edit requests must redact the
  request body instead of storing raw image bytes.
- A stored `openai_image_generations` route on a dual-kind image model may serve
  image edit only after the resolver converts the effective route protocol to
  `openai_image_edits`; chat tasks must still reject image protocols.

### 4. Validation & Error Matrix

- Missing prompt -> `ErrInvalidMediaGenerationTask`
- Missing `fileIDs` for edit -> `ErrInvalidMediaGenerationTask`
- More than 16 edit images -> `ErrTooManyMessageFiles`
- Missing, inactive, non-owned, or non-image source file -> `ErrInvalidFileReference`
- Source image over configured upload/image size limits -> `ErrFileTooLarge`
- Unsupported or spoofed image bytes -> `ErrMIMEBlocked`
- No active route whose exact or derived effective protocol is
  `openai_image_edits` -> `ErrModelRouteNotConfigured`
- Single-kind route protocol mismatch for the task ->
  `ErrModelRouteNotConfigured`; route resolver should filter it before the
  conversation service builds `llm.RouteConfig`
- Empty upstream image result -> `ErrUpstreamEmptyResponse`
- Stream idle timeout after a single edit partial image with
  `partial_images=1` or omitted -> success using the latest partial image
- Stream idle timeout without any partial image, or with `partial_images>1` ->
  `ErrUpstreamRequestFailed`

### 5. Good/Base/Bad Cases

- Good: one uploaded PNG plus prompt resolves an effective
  `openai_image_edits` route, sends one `image[]` multipart part, saves the
  edited image, and emits `completed`.
- Base: multiple source images preserve input order after deduplication and are
  sent as repeated `image[]` parts.
- Base: an edit stream can emit one `image_edit.partial_image`, then stall
  before a final event; when only one partial was requested, the latest partial
  is stored as the assistant image and the client receives `completed`.
- Base: a dual-kind `["image_gen","image_edit"]` image model with a stored
  `openai_image_generations` route derives `openai_image_edits` for edit tasks.
- Bad: a text or SVG upload must not be sent upstream; fail before creating the
  LLM request.
- Bad: do not convert multi-partial streams (`partial_images>1`) into a final
  image on idle timeout; there is no single agreed final preview in that mode.

### 6. Tests Required

- LLM adapter test asserts `/v1/images/edits`, multipart fields, repeated
  `image[]` parts, filenames, bytes, output parsing, and usage parsing.
- Endpoint URL and adapter tests assert `EndpointImageEdits`,
  `DefaultEndpointForAdapter(openai_image_edits)`, and non-streaming behavior.
- Conversation tests should cover source file validation, source attachment
  persistence, route task type `image_edit`, and generated assistant image
  persistence when adding fakes for storage and LLM.
- Conversation tests should cover the single-partial idle-timeout fallback:
  upstream sends `image_edit.partial_image`, stalls past `StreamIdleTimeoutMS`,
  service marks route success, stores the partial bytes as the generated
  attachment, and returns a successful assistant image.
- Channel routing tests should cover derived effective protocol for dual-kind
  image models and keep chat tasks from accepting image protocols.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not send uploaded image bytes through JSON or include them in debug body.
upstreamDebugSnapshot(req, multipartPayload, resp, body)
```

#### Correct

```go
// Multipart request is required, and debug snapshots redact source images.
upstreamDebugSnapshot(req, []byte("[multipart form data redacted]"), resp, body)
```

#### Wrong

```go
// Do not reject dual-kind image models only because the stored route protocol
// came from the first image kind during sync.
if taskType == TaskTypeImageEdit && route.Protocol != openaiImageEdits {
	return ErrModelRouteNotConfigured
}
```

#### Correct

```go
// Resolve the effective protocol from task type before constructing RouteConfig.
protocol, ok := routeProtocolForTask(taskType, modelKindsJSON, route.Protocol)
if !ok {
	return ErrModelRouteNotConfigured
}
route.Protocol = protocol
```

#### Wrong

```go
// Do not turn every partial image timeout into success.
if lastPartialImage != nil {
	return completeWith(lastPartialImage)
}
```

#### Correct

```go
// Only the single-partial edit stream fallback is product-accepted as final.
if taskType == MediaImageTaskEdit && partialImages == 1 && isStreamIdleTimeout(err) {
	return completeWith(lastPartialImage)
}
```

## Scenario: Assistant Follow-Up Suggestions

### 1. Scope / Trigger

Use this contract when adding or changing post-response follow-up suggestions
for normal text chat. This path is cross-layer: assistant messages are
persisted in PostgreSQL, suggestions are generated by the conversation
application service, exposed through HTTP message DTOs, and rendered by the
chat UI.

### 2. Signatures

- DB: `chat_messages.follow_ups_json text NOT NULL DEFAULT '[]'`
- Domain: `conversation.Message.FollowUpsJSON string`
- Repository:
  `UpdateMessageFollowUps(ctx context.Context, messageID uint, followUpsJSON string) error`
- HTTP DTO: `MessageResponse.FollowUps []string json:"followUps"`
- Frontend DTO: `MessageDTO.followUps?: string[]`
- Frontend message model: `ChatAreaMessage.followUps?: string[]`

### 3. Contracts

- Follow-ups are generated only after a successful assistant text/markdown
  completion is persisted.
- Generation is asynchronous and must not delay the main assistant response
  stream.
- The LLM output contract is JSON shaped as
  `{ "follow_ups": ["...", "...", "..."] }`; common variants such as
  `followUps` and `suggestions` may be accepted at the parser boundary.
- Stored values are a JSON array of strings, not a wrapper object.
- API responses always expose `followUps` as an array; missing, blank, or
  invalid storage values map to `[]`.
- The frontend renders follow-ups only for the latest successful assistant
  message and sends a clicked suggestion through the normal message submit
  flow.

### 4. Validation & Error Matrix

- Assistant role is not `assistant` -> skip generation.
- Message status is non-empty and not `success` -> skip generation.
- Content type is not text/markdown/empty -> skip generation.
- Assistant content is blank -> skip generation.
- No task route or no LLM client -> skip generation.
- LLM failure, invalid JSON, fewer than three usable suggestions, or repository
  update failure -> log for operators and hide suggestions from the user.

### 5. Good/Base/Bad Cases

- Good: a successful text assistant reply stores three to five concise
  follow-ups, and a later message list response includes those strings in
  `followUps`.
- Base: if generation finishes after the send response returns, the frontend
  polls/reloads the message list and updates the latest assistant message when
  `followUps` appears.
- Bad: image generation replies, failed assistant replies, and invalid model
  outputs must not render an empty or broken suggestion area.

### 6. Tests Required

- Unit tests for prompt context construction, role/content-type/status
  eligibility, JSON shape parsing, deduplication, length limiting, and rejection
  of fewer than three suggestions.
- Repository or service fake implementations must include
  `UpdateMessageFollowUps` whenever they satisfy the conversation repository
  interface.
- Frontend build/lint must pass after DTO and message-render comparison updates.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not block the main response stream while asking another LLM for
// follow-up suggestions.
followUps, _ := s.generateAssistantFollowUps(ctx, conversation, userMsg, assistantMsg)
assistantMsg.FollowUpsJSON = marshal(followUps)
```

#### Correct

```go
// Persist the assistant answer first, then generate suggestions asynchronously.
s.maybeGenerateFollowUpsAsync(*input.Conversation, *input.UserMessage, *input.AssistantMessage)
```

## Scenario: Upstream Citation Reference Links

### 1. Scope / Trigger

Use this contract when changing chat behavior that consumes provider-native
citations from web/search tools, output annotations, image references, or
server-side tool calls.

### 2. Signatures

- Infra result: `llm.GenerateOutput.Citations []string`
- Application helper:
  `linkCitationMarkers(content string, citations []string) string`
- Stored assistant content: normal Markdown string in `chat_messages.content`

### 3. Contracts

- Provider adapters collect citation URLs into `GenerateOutput.Citations`; they
  should not render provider-specific citation UI.
- OpenAI Chat Completions compatible adapters must normalize provider citation
  payloads into `GenerateOutput.Citations` even when URLs arrive outside the
  standard message annotation shape. Known shapes include non-stream response
  root `sources` and streaming final chunk root `sources` arrays containing
  `{ "url": "...", "title": "..." }` objects.
- The conversation application layer maps numeric markers in the final assistant
  text (`[1]`, `[2]`, etc.) to display-only inline HTML anchors
  (`<a href="URL">[1]</a>`). The href MUST be HTML-escaped (`html.EscapeString`)
  because `normalizeCitationURL` only validates scheme/host, not quote/angle/`&`
  characters. This keeps URL text out of the visible body while rendering the
  bracketed marker as the clickable label.
- Inline HTML anchors are used instead of Markdown reference links because when
  the `htmlVisualPrompt` feature is active the model wraps prose in block-level
  HTML (`<div>`), and CommonMark does NOT parse Markdown (including reference
  links) inside a raw HTML block — but `rehype-raw` reconstructs real `<a>` tags
  everywhere, so an inline anchor renders as a citation capsule in both plain
  Markdown and inside HTML fragments. The frontend `MarkdownLink` detects a
  citation purely from "external href + visible text `[N]`", independent of
  whether the anchor came from Markdown or raw HTML.
- Inline numeric citation links from providers (`[1](https://...)`) must be
  rewritten to the same inline-anchor format so the visible body does not show
  raw URL text.
- Adjacent numeric markers (`[1][2]`) are rewritten as back-to-back anchors with
  no separator so the frontend `groupCitationChildren` (inside `<p>`) can still
  merge them into one clustered capsule.
- The rewrite must be idempotent: a `[N]` already inside an emitted (or
  model-authored) `>[N]</a>` anchor is skipped, so re-running the rewrite never
  nests `<a><a>...</a></a>`.
- Streaming deltas stay provider text only. Only the completed/persisted message
  is rewritten (post-stream, at the single `linkCitationMarkers` call site).
- Do not add a new API field for citation links unless inline HTML anchors cannot
  represent the required behavior.

### 4. Validation & Error Matrix

- Blank assistant content -> return unchanged.
- No citation URLs -> return unchanged.
- No numeric citation markers in content -> return unchanged.
- Citation marker has no URL at the matching one-based index -> skip it.
- Empty, malformed, or non-HTTP(S) citation URL -> skip it.
- Marker already wrapped in a citation anchor (`>[N]</a>`) -> skip it (idempotent).

### 5. Good/Base/Bad Cases

- Good: `answer [1][2]` plus two URLs persists as
  `answer <a href="https://...">[1]</a><a href="https://...">[2]</a>`.
- Good: `answer [1](https://example.com)` persists as
  `answer <a href="https://example.com">[1]</a>`.
- Good: a citation URL with a query string (`?a=1&b=2`) persists with an escaped
  href (`href="https://example.com/?a=1&amp;b=2"`).
- Base: `answer [1]` plus three URLs links only the referenced first marker.
- Base: a Chat Completions stream whose final chunk is
  `{ "choices": [{ "delta": {}, "finish_reason": "stop" }], "sources": [...] }`
  still yields citations for the completed persisted assistant message.
- Bad: frontend code guesses URLs from process trace output and rewrites message
  text client-side.

### 6. Tests Required

- Unit tests for marker-to-URL mapping, inline numeric link rewriting, adjacent
  marker handling, invalid URL filtering, href HTML-escaping, idempotency (no
  nested anchors on re-run), and unchanged content without markers.
- LLM adapter tests must cover provider citation extraction for both
  non-streaming responses and streaming terminal chunks when an upstream uses a
  custom root `sources` field.
- Existing server-side tool trace tests must continue to prove citation URLs are
  still captured for process trace visibility.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not make the frontend infer clickable references from trace rows.
message.Content = upstream.Text
message.ProcessTrace.Tools = citationsJSON
```

#### Correct

```go
// Keep the API contract as Markdown content and let the renderer handle links.
// Emit inline HTML anchors so citations render in both Markdown and HTML fragments.
message.Content = linkCitationMarkers(upstream.Text, upstream.Citations)
```
