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

### 5. Good/Base/Bad Cases

- Good: one uploaded PNG plus prompt resolves an effective
  `openai_image_edits` route, sends one `image[]` multipart part, saves the
  edited image, and emits `completed`.
- Base: multiple source images preserve input order after deduplication and are
  sent as repeated `image[]` parts.
- Base: a dual-kind `["image_gen","image_edit"]` image model with a stored
  `openai_image_generations` route derives `openai_image_edits` for edit tasks.
- Bad: a text or SVG upload must not be sent upstream; fail before creating the
  LLM request.

### 6. Tests Required

- LLM adapter test asserts `/v1/images/edits`, multipart fields, repeated
  `image[]` parts, filenames, bytes, output parsing, and usage parsing.
- Endpoint URL and adapter tests assert `EndpointImageEdits`,
  `DefaultEndpointForAdapter(openai_image_edits)`, and non-streaming behavior.
- Conversation tests should cover source file validation, source attachment
  persistence, route task type `image_edit`, and generated assistant image
  persistence when adding fakes for storage and LLM.
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
