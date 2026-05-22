# Implement OpenAI Image Edit Interface

## Goal

Enable the existing chat image-edit flow so a user can upload one or more image
attachments, enter an edit instruction, and receive a generated edited image
instead of `image edit protocol not implemented` / `server internal error`.

## Background

The frontend already detects image attachments and models with `image_edit`
capability, then sends `MediaImageRequest` to
`/api/v1/conversations/{id}/media/images/edits/stream`. The backend route exists
but `StreamMediaImage` returns `ErrMediaImageEditNotImplemented` before reading
the uploaded images or calling any upstream adapter.

`gpt_image_playground` and OpenAI's Image API examples both use
`multipart/form-data` for Images API edits: text parameters plus one or more
`image[]` file fields, with optional `mask`. This matches our backend better
than Responses API for the first version because our images already live in
DOUB object storage as uploaded files.

## Requirements

- Implement backend support for `MediaImageTaskEdit`.
- Preserve the existing frontend request contract:
  - `MediaImageRequest.prompt`
  - `MediaImageRequest.options`
  - `MediaImageRequest.clientRunID`
  - `MediaImageRequest.fileIDs`
  - branch/source message fields
- Accept 1-16 uploaded input images for edit requests.
- Resolve input images by `fileIDs` using the authenticated user ID.
- Reject missing, inactive, non-owned, non-image, or unreadable file references
  with stable client-safe errors.
- Call OpenAI-compatible `POST /v1/images/edits` through the configured image
  edit route/protocol.
- Send upstream request as `multipart/form-data`:
  - `model`
  - `prompt`
  - `image[]` for each input image
  - supported image options from `options`
- Reuse existing generated-image result handling:
  - parse `data[].b64_json` and URL outputs
  - validate returned image bytes
  - save generated images as file objects
  - create assistant attachments
  - complete assistant message with file-backed Markdown
- Preserve existing stream lifecycle labels:
  - `queued`
  - `running`
  - `saving_artifact`
  - `completed`
- Record source image attachments on the user message for auditability and
  conversation continuity.
- Keep image generation behavior unchanged when no file IDs are present.

## Acceptance Criteria

- [ ] Uploading an image and submitting an edit prompt no longer returns
      `ErrMediaImageEditNotImplemented`.
- [ ] The backend routes `image_edit` through a route whose protocol is
      `openai_image_edits`.
- [ ] The upstream edit request uses multipart `image[]` fields containing the
      uploaded image bytes.
- [ ] The edit response is persisted through the existing generated-image
      storage path and renders in chat as a protected `/api/v1/files/.../content`
      image.
- [ ] Non-image file IDs are rejected before calling upstream.
- [ ] Missing `fileIDs` for image edit is rejected before calling upstream.
- [ ] Existing text-to-image generation still works and still rejects
      unexpected `fileIDs`.
- [ ] Backend unit tests cover the adapter request body, response parsing, and
      service validation paths.
- [ ] Relevant Go tests pass.

## Technical Approach

### Adapter Layer

Add `openAIImageEditsAdapter` under `backend/internal/infra/llm`.

Implementation points:

- Add `EndpointImageEdits`.
- Register the adapter in `NewClientWithEnv`.
- Mark `AdapterOpenAIImageEdits` as implemented.
- Build multipart form requests for `/v1/images/edits`.
- Read image inputs from `GenerateInput.Messages[].Parts` with
  `Kind == ContentPartImage`.
- Append `image[]` parts with filenames and MIME-derived extensions.
- Apply supported params:
  - `quality`
  - `size`
  - `n`
  - `background`
  - `moderation`
  - `output_format`
  - `output_compression`
  - `input_fidelity`
  - `response_format` where supported/needed
- Reuse `parseOpenAIImageGenerationOutput` for responses.

### Application Service Layer

Refactor `StreamMediaImage` so generation and edit share persistence but have
different input validation and route resolution.

Implementation points:

- `image_generation`:
  - require prompt
  - require no `fileIDs`
  - route with `TaskTypeImageGeneration`
  - protocol must be `openai_image_generations`
- `image_edit`:
  - require prompt
  - require 1-16 `fileIDs`
  - resolve active user-owned file objects
  - require every input to be image category / image MIME
  - open object storage and read bounded image bytes
  - route with `TaskTypeImageEdit`
  - protocol must be `openai_image_edits`
  - build `llm.Message{Role:"user", Parts:[text, images...]}`.
- Create the user message with attachment snapshots for the source images.
- Keep assistant message and generated output persistence unchanged.

### Error Handling

- Remove the `ErrMediaImageEditNotImplemented` fast path from the active flow.
- Keep the sentinel only if needed for compatibility, but it should no longer be
  returned by valid `image_edit` requests.
- Map validation errors to 4xx stream errors.
- Do not expose storage paths, upstream raw bodies, API keys, or file contents.

## Test Plan

Run targeted tests first, then broaden:

```bash
cd backend
go test ./internal/infra/llm
go test ./internal/application/channel
go test ./internal/application/conversation
go test ./internal/transport/http/conversation
go test ./...
```

Specific tests to add/update:

- `openai_images_test.go`
  - multipart edit request includes `model`, `prompt`, params, and `image[]`.
  - multiple input images produce multiple `image[]` form parts.
  - adapter parses `b64_json` edit response into `GeneratedImages`.
- `model_catalog_test.go`
  - `image_edit` task allows `openai_image_edits`.
  - image generation remains routed to `openai_image_generations`.
- `service_media_generation_test.go`
  - image edit without files is rejected.
  - image edit with non-image files is rejected.
  - image edit with valid image file produces saved generated image attachment
    when the fake LLM client returns image bytes.

## Out Of Scope

- Mask editor UI.
- `maskFileID` API field.
- Responses API image editing.
- Conversational multi-turn image editing with OpenAI file IDs.
- Any change to the existing frontend model picker UX unless backend validation
  reveals a necessary safety message.

## Research References

- `research/image-edit-api.md` - external Image API edit behavior and current
  repo constraints.

## Implementation Steps

1. Add adapter endpoint and registration for `openai_image_edits`.
2. Implement multipart edit request construction and tests.
3. Refactor media service to branch generation vs edit validation/route setup.
4. Add source image loading from object storage.
5. Persist user source attachments for edit requests.
6. Reuse existing generated output persistence for edited image results.
7. Update error handling/tests.
8. Run targeted Go tests and then `go test ./...`.
9. Update `.trellis/spec/` with the media image edit contract if implementation
   confirms or changes the planned convention.
