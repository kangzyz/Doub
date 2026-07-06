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

## Scenario: Conversation JSON Export

### 1. Scope / Trigger

Use this contract when changing conversation export, conversation backup JSON,
conversation message DTOs used by export, or frontend download behavior. This
path is cross-layer: the backend authorizes and assembles the export, HTTP
serializes existing conversation/message/run DTOs, and the frontend saves the
exact response as a JSON file.

### 2. Signatures

- HTTP: `GET /api/v1/conversations/:id/export`
- Application:
  `Service.ExportConversation(ctx context.Context, userID uint, publicID string) (*ConversationExportResult, error)`
- Repository:
  - `GetConversationByPublicID(ctx, publicID, userID)`
  - `ListAllMessages(ctx, conversationID)`
  - `ListConversationRunsByRunIDs(ctx, userID, conversationID, runIDs)`
- Response:
  `ConversationExportResponse{ version, exportScope, exportedAt, conversation, messages, runs, totalMessages, totalRuns, defaultMessagePublicIDs, compatibility }`
- Frontend:
  `exportConversation(accessToken, conversationPublicID)` and
  `downloadConversationExport(data)`

### 3. Contracts

- Export is authenticated and scoped to the requesting `userID`; a public ID
  owned by another user must behave as not found.
- `version` is the export schema version. `exportScope` is `full`.
- `exportedAt` is generated in UTC by the application service.
- `conversation` uses the normal `ConversationResponse` mapping, including
  normalized `labelsJSON` and `shareStatus`.
- `messages` includes all conversation messages, not only the latest visible
  branch. Message feedback and process traces must be hydrated before response
  mapping.
- `runs` includes only runs referenced by trimmed, deduplicated non-empty
  message `runID` values and must stay scoped to the same user and conversation.
- `defaultMessagePublicIDs` is derived from the latest visible branch so an
  importer or viewer can reconstruct the default thread while still preserving
  all exported messages.
- `compatibility.format` is `doub.conversation.export`. Import compatibility is
  not promised by this response.
- The frontend writes the response object unchanged with pretty JSON and a
  trailing newline. The filename is based on conversation title/public ID and
  `exportedAt`; unsafe filename characters are replaced.

### 4. Validation & Error Matrix

- Missing/invalid `:id` path parameter -> HTTP 400.
- Conversation missing or not owned by user -> `ErrConversationNotFound` ->
  HTTP 404.
- Message listing, feedback hydration, trace hydration, or run listing failure
  -> HTTP 500.
- Blank message `runID` -> skipped when selecting runs.
- Duplicate or whitespace-padded message `runID` -> trim and include once.
- Invalid `exportedAt` on the frontend -> filename timestamp falls back to the
  current browser time; exported JSON content is not modified.

### 5. Good/Base/Bad Cases

- Good: a branched conversation exports all messages and sets
  `defaultMessagePublicIDs` to the newest visible path.
- Good: messages with `runID` values `" run_1 "`, `"run_1"`, and `"run_2"`
  request runs `["run_1", "run_2"]`.
- Base: a conversation with no message runs exports an empty `runs` array and
  `totalRuns: 0`.
- Base: a conversation title containing `\/:*?"<>|` saves as a sanitized
  `.json` filename.
- Bad: an export endpoint returns only visible branch messages and loses retry
  history.
- Bad: frontend mutates or filters messages before writing the JSON backup.

### 6. Tests Required

- Service tests should cover default visible branch ID selection and run ID
  trimming/deduplication.
- Application or repository tests should cover user ownership scoping, all
  message retrieval, feedback hydration, trace hydration, and run lookup by
  selected run IDs when practical.
- HTTP or generated docs checks should cover the export route and response DTO.
- Frontend lint/build must pass after changing `ConversationExportDTO`,
  `exportConversation`, the download helper, share/export menus, or i18n keys.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not export only the currently visible branch.
messages, _ := s.repo.ListMessages(ctx, conversation.ID, latestBranchOnly)
```

#### Correct

```go
// Export every message, then separately record the default visible branch IDs.
messages, _ := s.repo.ListAllMessages(ctx, conversation.ID)
defaultIDs := exportDefaultMessagePublicIDs(messages)
```

#### Wrong

```typescript
// Do not alter the backup payload before saving.
download(JSON.stringify({ messages: data.messages.filter(isVisible) }));
```

#### Correct

```typescript
// Save the typed backend export unchanged.
downloadConversationExport(data);
```

## Scenario: HTML Visual Prompt Contract

### 1. Scope / Trigger

Use this contract when changing `htmlVisualPrompt` behavior, model output format
instructions, or the frontend renderer classes that those instructions target.
This is a backend-to-frontend output contract: the backend shapes model output,
and the frontend sanitizes/styles the resulting HTML.

### 2. Signatures

- Backend flag: `resolveMessageSystemPromptInjection(..., htmlVisualPrompt bool)`
- Backend prompt constant:
  `backend/internal/application/conversation/system_prompt.go::htmlVisualPromptInstruction`
- Frontend renderer:
  `frontend/features/chat/components/markdown/streamdown-render.tsx`
- Frontend CSS:
  `frontend/app/globals.css` `.reply` semantic component styles

### 3. Contracts

- When enabled, the request-level system prompt tells the model to emit semantic
  HTML fragments using `.reply` and predefined semantic classes only.
- Visual styling is owned by frontend CSS variables, not by model-authored
  colors, shadows, spacing, or arbitrary classes.
- Semantic `.reply` HTML is the final rendered answer DOM. The prompt must not
  tell the model to wrap `.reply`, `.card`, `.pros`, `.cons`, or other semantic
  HTML in fenced `markdown`, `html`, `text`, or source-code blocks. Fences are
  reserved for explicit source/demo/component requests.
- Explicit user requests for a full HTML page, HTML file, standalone webpage,
  interactive demo, or copyable HTML template take precedence over the semantic
  visual prompt. In that case the model should output the requested source
  artifact and should not force `.reply` fragments or the ordinary-chat ban on
  `html/head/body/style/script`.
- Semantic HTML block tags should start at column 0 or use shallow 2-space
  indentation, and a semantic container should not contain blank lines before a
  4-space-indented child tag. CommonMark ends raw HTML blocks at blank lines,
  so a later indented child can be parsed as a code block instead of DOM.
- Semantic HTML tag lines should not use 4+ leading spaces even without a blank
  line. CommonMark can interpret those lines as indented code when the raw HTML
  block boundary is ambiguous; the frontend compatibility normalizer may reduce
  approved semantic tag indentation to 2 spaces outside `<pre>`.
- The frontend may apply a compatibility normalizer for persisted/model-broken
  semantic HTML only when approved semantic classes are present. That normalizer
  must not unwrap arbitrary source/demo code fences or bypass the sanitizer.
- Citation sources in semantic HTML must remain real citation anchors. Models
  should emit numeric citation markers or `<a href="...">[N]</a>` when they have
  a URL, not static visual badges such as
  `<span class="badge badge-g">来源</span>`. As a compatibility fallback,
  `linkCitationMarkers` may rewrite approved semantic source badges to citation
  anchors only when upstream citation URLs are available.
- The model must not emit full documents (`html/head/body`), `<style>`,
  `<script>`, event handlers, hard-coded colors, or invented classes.
- Inline style has one prompt-level exception:
  `.progress-bar` may carry `style="--pct:75%"`.
- Every prompt class must exist in the Streamdown semantic class allowlist and
  in global CSS. Adding a class in only one layer is invalid.

### 4. Validation & Error Matrix

- Unknown class from model -> frontend strips it from `className`.
- Unsupported tag/attribute -> Streamdown sanitizer strips it.
- Unsafe inline style value or property -> style sanitizer strips it.
- Static semantic source badge plus upstream citation URL ->
  `linkCitationMarkers` rewrites the badge to `<a href="URL">[N]</a>`.
- Static semantic source badge without upstream citation URL -> unchanged; do
  not fabricate a clickable source.
- New theme preset omitted from bootstrap or persistence validation -> first
  paint or reload can fall back to default theme; update both runtime and
  bootstrap paths.

### 5. Good/Base/Bad Cases

- Good: `<div class="reply"><div class="grid grid-2">...</div></div>` renders
  through theme-aware CSS and changes appearance when the app theme changes.
- Base: an existing persisted message with `.reply` restyles automatically
  after switching light/dark mode or preset because CSS variables changed.
- Good: `<p>claim <a href="https://example.com">[1]</a></p>` renders as a
  clickable citation chip even inside `.reply` HTML.
- Bad: a normal answer emits ```markdown around `<div class="cons">...</div>`;
  the prompt should prevent it, and any frontend compatibility unwrap must be
  narrow enough to preserve real source/demo code blocks.
- Bad: a `.pros-cons` container inserts a blank line before an indented
  `<div class="cons">`; CommonMark can treat the child as an indented code block.
- Bad: `<span class="badge badge-g">来源</span>` has no URL and cannot be
  clicked unless backend citation URLs are available for compatibility rewrite.
- Bad: `<div style="background:#fff" class="made-up">...</div>` relies on
  stripped or non-theme-safe presentation and must not be prompted.

### 6. Tests Required

- Backend prompt tests should assert the semantic markers that matter, such as
  `.reply`, predefined classes, and CSS/theme ownership.
- Citation tests should cover semantic source badge rewriting with upstream URLs
  and unchanged behavior when no citation URL exists.
- Frontend lint/build must pass after changing allowed tags, allowed classes,
  global CSS, theme preset typing, i18n, or layout bootstrap.
- Browser verification should cover at least one semantic `.reply` sample across
  the new preset(s), light mode, and dark mode.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not ask the model to design the chat message with arbitrary inline CSS.
const htmlVisualPromptInstruction = `use style="background:#fff;color:#111"`
```

#### Correct

```go
// Ask the model to emit semantic classes; frontend CSS owns presentation.
const htmlVisualPromptInstruction = `use <div class="reply"> and predefined class mappings`
```

## Model Routing

Platform model names are resolved to upstream models by
`internal/application/channel`. Route identity should include platform model,
upstream, upstream model, binding code, protocol, vendor, and icon snapshots.
`service_routing_test.go` documents important identity and circuit-key rules.

Do not hard-code provider-private routing rules in frontend code. Frontend model
controls should consume model capability JSON and backend-provided policy.

## Scenario: Model Catalog Availability And Display Order

### 1. Scope / Trigger

Use this contract when changing platform model listing, admin model ordering,
public/chat model picker ordering, or vendor grouping.

### 2. Signatures

- Repository: `ListModels(ctx, repository.ListChannelModelsInput)`.
- Query input: `OnlyActive`, `OnlyAvailable`, `Query`, `Status`, `Vendor`,
  `Protocol`, `Sort`.
- Admin HTTP: `GET /api/v1/admin/llm/models?only_active=&only_available=&sort=`.
- Frontend admin API: `listAdminLLMModels(token, { onlyActive, onlyAvailable, sort })`.

### 3. Contracts

- `OnlyAvailable` means a platform model is active and has at least one active
  route whose upstream model and upstream are also active.
- `OnlyAvailable` is stricter than `OnlyActive`; when set, it defines the
  availability filter and should not rely on frontend filtering.
- The default and `sortOrder_asc` order groups models by availability first:
  available models, then enabled models with unavailable sources, then models
  with no active route path.
- Within each availability rank, vendor groups are ordered by the minimum
  `sort_order` for that vendor key in the current result set, then by vendor
  key, model `sort_order`, and model ID.
- Admin reorder submits the visible available/routable model IDs only.
  `ReorderModels` updates only submitted IDs and must not renumber hidden,
  disabled, unroutable, or future internal-scope models.
- Frontend grouping should use the explicit model `vendor` field through
  `resolveVendorIdentity`; model-name inference is still valid for model icons
  but must not move a model into a different vendor group.

### 4. Validation & Error Matrix

- Empty reorder list -> `ErrInvalidModelOrder`.
- Duplicate model ID in reorder list -> `ErrInvalidModelOrder`.
- Unknown model ID in reorder list -> `ErrModelNotFound`.
- Missing or unknown `sort` -> default display order.
- Blank or unknown vendor -> `unknown` vendor group in the frontend.

### 5. Good/Base/Bad Cases

- Good: the public chat model picker receives backend-sorted available models
  and keeps vendor groups in that order.
- Good: the admin order sheet loads with `only_available=true`, saves the
  submitted IDs, and leaves unavailable models' stored `sort_order` unchanged.
- Base: admin model table still shows disabled or unroutable rows, but marks
  them as not enabled or no upstream instead of putting them into the order
  sheet.
- Bad: grouping by `resolveModelIdentity({ code })` moves a custom model into a
  vendor inferred from its model name instead of its configured vendor.
- Bad: a reorder call renumbers every platform model and unexpectedly changes
  hidden or disabled rows.

### 6. Tests Required

- Backend tests should cover default order by availability, vendor group order,
  `OnlyAvailable` filtering, duplicate and missing reorder IDs, and preserving
  unsubmitted model `sort_order`.
- HTTP or generated docs checks should include the `only_available` query
  parameter when the admin model API contract changes.
- Frontend lint/build must pass after changing model API options, admin model
  table/order sheet, i18n keys, or chat model picker grouping.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Do not use model-name inference for vendor grouping.
const identity = resolveModelIdentity({ code: model.platformModelName, vendor: model.vendor });
```

#### Correct

```typescript
// Vendor grouping follows the configured vendor; model icons may still infer by name.
const vendorIdentity = resolveVendorIdentity(model.vendor);
```

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

## Scenario: OpenAI Responses Native Image Generation Tool

### 1. Scope / Trigger

Use this contract when changing OpenAI Responses native `image_generation`
tool handling in chat, including model compatibility fallback, stream parsing,
process trace rendering, or the empty-response guard.

### 2. Signatures

- LLM adapter:
  `applyResponsesStreamEvent(adapter, eventName, parsed, rawBody, result, onEvent)`
- Stream event types:
  - `response.image_generation_call.in_progress`
  - `response.image_generation_call.generating`
  - `response.image_generation_call.partial_image`
  - `response.image_generation_call.completed`
- Application trace:
  `llm.GenerateStreamEvent.ServerToolCall -> messageTraceRecorder.syncToolSection`
- Chat success guard:
  `hasSuccessfulImageGenerationServerToolOutput(*llm.GenerateOutput)`

### 3. Contracts

- `image_generation` is a server-side OpenAI Responses tool, not a local MCP or
  function call. It must be stored in `GenerateOutput.ServerToolCalls`.
- Model/tool support is not uniform. If upstream returns a safe validation
  error such as `Tool 'image_generation' is not supported with ...`, the chat
  service may remove that named native tool and retry the same request.
- `generating` and `partial_image` events are streaming states. They should
  update the tool trace as in-progress/streaming, not as completed or failed.
- `partial_image` payloads may contain `partial_image_b64`, `output_format`,
  and `background`. Preserve these fields in tool `OutputJSON` so the frontend
  trace renderer can show a preview.
- Responses image-generation SSE events can carry very large base64 payloads in
  one `data:` line. The OpenAI-compatible stream reader must allow a token size
  up to `maxUpstreamBodyBytes`, not the small default `bufio.Scanner` limit.
- A completed or stream-ended `image_generation` server-side tool with a real
  image source (`url`, `image_url`, `b64_json`, `base64`, or
  `partial_image_b64`) is a valid chat result even when assistant text is blank.
- Do not persist Responses native image tool output as conversation image
  attachments unless the task explicitly implements that storage path.

### 4. Validation & Error Matrix

- Unsupported native tool message naming `image_generation` -> remove that tool
  from options and retry once per removed tool type.
- `generating` or `partial_image` event -> trace status `streaming`.
- Completed image generation tool with image output and blank assistant text ->
  successful assistant message with process trace.
- Stream ends successfully after a `partial_image_b64` output but without a
  `completed` item -> successful assistant message with process trace.
- Blank assistant text without completed image generation output ->
  `ErrUpstreamEmptyResponse`.
- Failed/error image generation event -> failed tool trace and normal upstream
  error handling.

### 5. Good/Base/Bad Cases

- Good: `gpt-5.5` emits `generating`, `partial_image`, then `completed`; the
  process trace animates during generation and the turn completes even if no
  text is returned.
- Base: a model that rejects `image_generation` returns
  `Tool 'image_generation' is not supported ...`; the service retries without
  that tool instead of failing the turn.
- Bad: frontend hard-codes OpenAI model names to decide whether to send the
  image tool; this will drift as OpenAI changes model/tool support.
- Bad: a partial image event is treated as final success while the stream is
  still active or after the stream ended with an upstream error.

### 6. Tests Required

- Conversation helper tests must cover unsupported native tool error text,
  including `Tool '<tool>' is not supported ...`.
- LLM adapter tests must cover `generating` and `partial_image` stream events
  becoming server-side tool updates with preserved image payload fields.
- LLM adapter tests must cover an image-generation SSE `data:` line larger than
  1 MiB so large base64 payloads do not regress to `bufio.Scanner: token too
  long`.
- Conversation service/helper tests must cover completed native image
  generation output and stream-ended partial image output allowing blank
  assistant text, while missing image output and non-image tools still reject
  blank text.

### 7. Wrong vs Correct

#### Wrong

```go
if strings.TrimSpace(assistantText) == "" {
	return ErrUpstreamEmptyResponse
}
```

#### Correct

```go
if strings.TrimSpace(assistantText) == "" &&
	!hasSuccessfulImageGenerationServerToolOutput(upstreamOutput) {
	return ErrUpstreamEmptyResponse
}
```

## RAG, Files, And Memory

File processing, extraction, embeddings, RAG retrieval, and memory are backend
concerns. The frontend should render structured status from backend DTOs and
trace blocks, not infer processing state from filenames or provider-specific
details.

Keep prompt and trace data safe. Trace should explain process status without
leaking hidden prompts, raw file contents, API keys, or tool secrets.

## Scenario: OpenAI Responses Daily Native Tool Defaults

### 1. Scope / Trigger

Use this contract when changing provider-native tool definitions, daily chat
default native tools, or the model option policy that injects OpenAI Responses
`tools`.

### 2. Signatures

- Catalog:
  `backend/internal/shared/nativetool.DailyChatDefaultDefinitions(protocol string)`
- Application policy:
  `nativeProviderToolsFromOption(protocolKey, rawTools, capabilitiesJSON, allowedTypesJSON)`
- Frontend default-options mirror:
  `frontend/features/chat/hooks/use-chat-model-options.ts::DAILY_CHAT_NATIVE_TOOL_PAYLOADS`
- OpenAI Responses request field:
  `tools: [{"type":"web_search"}, {"type":"image_generation"}, ...]`

### 3. Contracts

- `openai_responses` daily chat defaults are safe, broadly useful tools only.
  The default set is `web_search` and `image_generation`.
- Keep backend daily defaults and the frontend `DAILY_CHAT_NATIVE_TOOL_PAYLOADS`
  mirror in sync; otherwise the frontend can still send a tool explicitly after
  the backend default injector stops adding it.
- When removing a daily default native tool, scrub stale frontend
  `doub-chat:chat-model-options:*` cached `tools` entries during default-option
  merge unless the current model defaults still explicitly include that tool.
- `code_interpreter` is high risk and upstream/model support is not uniform; it
  must remain explicit opt-in through model capabilities or `options.tools`.
- Keep the `code_interpreter` catalog definition, sanitizer, and global
  allowed-tool policy so supported upstreams can still enable it intentionally.
- If an upstream rejects a native tool with an unsupported-tool validation
  error, the conversation service may remove that named tool and retry once per
  tool type.

### 4. Validation & Error Matrix

- Default `openai_responses` options -> no `code_interpreter` in filtered
  `tools`.
- Explicit allowed `code_interpreter` option -> sanitized payload with
  `container.type=auto`.
- Upstream `Unsupported tool type: code_interpreter` -> remove
  `code_interpreter` from request options and retry when present.
- Stale frontend model-options cache contains `code_interpreter` while current
  model defaults do not -> drop cached `code_interpreter` before sending.
- Unsupported tool is not present in request options -> return the upstream
  error; do not invent a fallback payload.

### 5. Good/Base/Bad Cases

- Good: ordinary GPT-5.5 chat sends `web_search` and `image_generation` but not
  `code_interpreter`.
- Base: an admin configures a model capability with `openai.code_interpreter`;
  the policy preserves the tool after sanitizing unsafe fields.
- Bad: fixing only `nativetool.DailyChatDefaultDefinitions` while leaving the
  frontend daily default mirror unchanged still sends `code_interpreter` in
  `options.tools`.
- Bad: fixing both default lists but preserving old browser cached
  `code_interpreter` entries still sends the unsupported tool after deploy.
- Bad: adding every known OpenAI Responses hosted tool to daily defaults causes
  model-specific HTTP 400 failures for normal chat.

### 6. Tests Required

- `model_option_policy_test.go` must assert the OpenAI Responses daily default
  tool list and explicitly reject `code_interpreter` in that default list.
- Frontend lint must pass after changing
  `DAILY_CHAT_NATIVE_TOOL_PAYLOADS`.
- Tests must also cover explicit `code_interpreter` preservation and sanitizer
  behavior.
- Helper tests must continue to cover unsupported native tool error parsing and
  request option removal.

### 7. Wrong vs Correct

#### Wrong

```go
"openai_responses": {"web_search", "image_generation", "code_interpreter"}
```

#### Correct

```go
"openai_responses": {"web_search", "image_generation"}
```

## Scenario: Media Image Generation Endpoint

### 1. Scope / Trigger

Use this contract when changing conversation-scoped image generation through
OpenAI-compatible Images API routes or xAI/Grok image routes.

### 2. Signatures

- HTTP: `POST /api/v1/conversations/:id/media/images/generations/stream`
- Application: `Service.StreamMediaImage(ctx, MediaImageInput{TaskType:
  MediaImageTaskGeneration, Prompt, Options, ...})`
- LLM route protocols: `openai_image_generations`, `xai_image`
- OpenAI-compatible endpoint: `POST <baseURL>/v1/images/generations`
- xAI/Grok endpoint: `POST <baseURL>/v1/images/generations`

### 3. Contracts

- Request `prompt` is required and trimmed before use.
- Image generation accepts no user input image attachments; image attachments
  route to image editing when the selected model supports it.
- OpenAI image generation sends `size` for combined output resolution and aspect
  ratio. Common official values include `auto`, `1024x1024`, `1536x1024`, and
  `1024x1536`; keep legacy DALL-E sizes allowed for compatible routes.
- xAI/Grok image generation sends `aspect_ratio` and `resolution`. Official
  `resolution` values are `1k` and `2k`; keep UI options lowercase and normalize
  uppercase input during option filtering.
- User image options must pass through the model option policy and value
  sanitizer before provider dispatch.

### 4. Good/Base/Bad Cases

- Good: OpenAI image generation selected with wide output sends
  `size:"1536x1024"` and no separate `aspect_ratio`.
- Good: xAI/Grok image generation selected with wide output sends
  `aspect_ratio:"16:9"` and `resolution:"2k"`.
- Bad: exposing xAI `aspect_ratio` controls for OpenAI Images routes creates
  fields the OpenAI Images API does not consume.

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
- Source image bytes for edit requests are decoded, bounded to
  `64 * 1024 * 1024` pixels, converted to 8-bit RGBA PNG, and sent upstream as
  `image/png`; the multipart filename extension must match the normalized MIME
  type.
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

## Scenario: Media Video Generation Endpoint

### 1. Scope / Trigger

Use this contract when implementing or changing conversation-scoped video
generation, including text-to-video, image-to-video, video model routing,
provider adapter payloads, polling, download, storage, and frontend stream
events.

### 2. Signatures

- HTTP: `POST /api/v1/conversations/:id/media/videos/generations/stream`
- Application: `Service.StreamMediaVideo(ctx, MediaVideoInput{Prompt, FileIDs,
  InputReferenceFileID, Options, ...})`
- LLM route protocol: `openai_video_generations`
- OpenAI/Sora endpoint: `POST <baseURL>/v1/videos`
- OpenAI/Sora video edit endpoint for uploaded source videos:
  `POST <baseURL>/v1/videos/edits`
- xAI/Grok direct endpoint: `POST <baseURL>/v1/videos/generations`
- xAI/Grok through OpenAI-compatible proxy endpoint:
  `POST <baseURL>/v1/videos`
- xAI/Grok video extension endpoint:
  `POST <baseURL>/v1/videos/extensions`
- Download output: generated MP4 bytes are returned as
  `llm.GenerateOutput.GeneratedVideos`

### 3. Contracts

- `prompt` is required and trimmed before use.
- Video generation accepts at most one reference attachment. It may be a
  JPEG/PNG/WebP source image for image-to-video, or an MP4 source video for
  video-to-video extension/editing. The frontend sends both `fileIDs: [fileID]`
  and `inputReferenceFileID` for compatibility, and the backend deduplicates
  them before validation.
- Source images must be user-owned active file objects classified as images and
  normalized to PNG bytes before provider dispatch.
- Source videos must be user-owned active MP4 file objects classified as videos;
  keep the MP4 bytes intact rather than routing them through image normalization.
- OpenAI/Sora-compatible video requests with a source image use
  `multipart/form-data` and send the image as the `input_reference` file part.
- OpenAI/Sora-compatible requests with an uploaded source video use
  `multipart/form-data` against `/videos/edits` and send the MP4 as the `video`
  file part. Do not use `/videos/extensions` unless the service has an upstream
  video id that the provider accepts.
- xAI/Grok video requests use JSON and send the source image as an
  `image_url` data URI under the `image` field. Direct `api.x.ai` routes use
  `/videos/generations`; OpenAI-compatible proxy routes such as
  `/openai/v1` keep the proxy's `/videos` path. Do not send Grok
  image-to-video as OpenAI multipart `input_reference`; upstream can ignore it
  and treat the request as unsupported text-to-video.
- xAI/Grok MP4 reference videos send the source as
  `video: {url:"data:video/mp4;base64,..."}`. Direct
  `api.x.ai` routes use `/videos/extensions` for this operation, while
  OpenAI-compatible proxy routes keep the proxy's `/videos` endpoint and add
  `operation:"extend"`, `mode:"extend-video"`, and `video_url`/`videoUrl`
  aliases so the proxy does not route the payload as text-to-video.
  For xAI extension requests pass `duration` only; omit `aspect_ratio` and
  `resolution` because the upstream extension API does not support them.
- User video options must pass through the model option policy only for official
  fields. OpenAI-compatible video uses `size` and `seconds`; xAI/Grok uses
  `duration`, `aspect_ratio`, and `resolution`, with `seconds` accepted only as
  a legacy duration alias when it is valid for xAI. For xAI/Grok,
  generation/image-to-video `duration` accepts 1-15 seconds; video extension
  `duration` accepts 2-10 seconds.
- xAI/Grok route detection must use route metadata such as model vendor or the
  upstream model name, not frontend model-name heuristics.
- The application service saves completed MP4 output through the normal upload
  path and persists assistant `contentType="video"` with video attachment rows.

### 4. Validation & Error Matrix

- Missing prompt -> `ErrMediaVideoPromptRequired`
- More than one source reference, or mismatched `fileIDs` and
  `inputReferenceFileID` -> `ErrMediaVideoTooManyInputs`
- Missing, inactive, non-owned, non-image/non-video, or unreadable source file ->
  `ErrMediaVideoReferenceInvalid` or `ErrInvalidFileReference`
- Source image/video exceeds upload/reference limits -> `ErrFileTooLarge`
- No routable `openai_video_generations` model -> `ErrModelRouteNotConfigured`
- Route protocol is not a video adapter -> `ErrMediaRouteProtocolMismatch`
- Upstream completes without a downloadable video URL/bytes ->
  `ErrUpstreamEmptyResponse` or upstream request failure

### 5. Good/Base/Bad Cases

- Good: one uploaded PNG plus a Grok video model on an OpenAI-compatible proxy
  sends `POST /v1/videos` with JSON `image.url=data:image/png;base64,...`;
  direct `api.x.ai` sends the same JSON body to `/v1/videos/generations`.
- Good: one uploaded PNG plus an OpenAI Sora model sends multipart
  `input_reference` to `/v1/videos`.
- Good: one uploaded MP4 plus a direct `api.x.ai` Grok video route sends JSON
  to `/v1/videos/extensions` with `video.url=data:video/mp4;base64,...` and
  only `duration` from video options.
- Good: one uploaded MP4 plus a Grok video model on an OpenAI-compatible proxy
  sends the same JSON video payload plus `operation:"extend"` to `/v1/videos`,
  not `/v1/videos/extensions`.
- Good: one uploaded MP4 plus an OpenAI-compatible Sora model sends multipart
  `video` to `/v1/videos/edits`.
- Base: prompt-only video generation sends no image field/part and lets the
  upstream enforce whether text-to-video is supported for that model.
- Bad: sending a Grok image-to-video request as multipart `input_reference`
  makes the upstream behave as if no image was provided and can return
  `Text-to-video is not supported for this model.`
- Bad: sending an OpenAI-compatible proxy request to `/v1/videos/generations`
  can fail with HTTP 404 even though `/v1/videos` is available.
- Bad: sending an OpenAI-compatible proxy extension request to
  `/v1/videos/extensions` can fail or be routed as unsupported text-to-video
  even though the proxy's `/v1/videos` endpoint accepts the operation.

### 6. Tests Required

- LLM adapter tests must assert OpenAI multipart `input_reference`, OpenAI
  multipart `video` edit input, xAI JSON `image.url` data URI, xAI JSON
  `video.url` extension payload, sanitized debug bodies without source bytes,
  async polling, video URL download, and MP4 MIME preservation.
- Conversation tests should cover video reference file ID normalization,
  source image normalization, source MP4 validation, unsupported reference
  rejection, generated MP4 validation, and attachment persistence when service
  fakes are available.
- Frontend lint/build must pass after changing `MediaVideoRequest`,
  submission routing, stream event parsing, or visible video UI copy.

### 7. Wrong vs Correct

#### Wrong

```go
// Grok/xAI video requests do not consume OpenAI multipart input_reference.
writeOpenAIMultipartFile(writer, "input_reference", fileName, image.MimeType, image.Data)
```

#### Correct

```go
// Grok/xAI expects a JSON image_url object; keep source bytes out of debug logs.
payload["image"] = map[string]interface{}{
	"type": "image_url",
	"url":  "data:image/png;base64,...",
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
