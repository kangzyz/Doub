# Image Edit API Research

## External References

- CookSleep `gpt_image_playground` routes edit requests to the OpenAI-compatible
  Images API when input images are present. The edit path is
  `images/edits`, the request is `multipart/form-data`, input images are
  appended as `image[]`, and optional mask data is appended as `mask`.
  Source: https://raw.githubusercontent.com/CookSleep/gpt_image_playground/refs/heads/main/src/lib/openaiCompatibleImageApi.ts
- The same project converts the first input image to PNG when a mask is present,
  converts the mask to PNG, validates payload size, and parses `b64_json` or
  image URLs from the response.
- OpenAI's Image API edit example for `gpt-image-2` posts to
  `https://api.openai.com/v1/images/edits` with multipart fields:
  `model`, `image[]`, optional `mask`, and `prompt`. The result is read from
  `data[0].b64_json`.
  Source: https://developers.openai.com/api/docs/guides/image-generation#edit-an-image-with-a-mask
- The OpenAI guide also states the Image API is best for single-prompt
  generation or editing, while Responses API is better for conversational,
  multi-turn editable image experiences.

## Current Repo Constraints

- The frontend already routes image attachments plus an `image_edit` model kind
  to `streamImageEdit`, which posts `MediaImageRequest` to
  `/media/images/edits/stream`.
- Backend routing already has `StreamImageEdit`, but application service returns
  `ErrMediaImageEditNotImplemented` immediately.
- Existing generated-image persistence is solid and should be reused:
  `readGeneratedImage`, `UploadFile`, `CreateAttachments`, and
  `generatedImageMarkdown`.
- Existing LLM image generation adapter parses Image API output into
  `GeneratedImages`; edit output has the same response shape for the MVP.
- Object storage reads are available through `storeProvider.Open(ctx)` and
  `store.Open(ctx, file.StoragePath)`. User-scoped file metadata can be loaded
  with `GetActiveFileObjectsByIDs`.

## Recommended MVP

- Implement Images API multipart edits in backend only.
- Use existing frontend request shape: `prompt`, `options`, `clientRunID`, and
  `fileIDs`.
- Accept 1-16 active user-owned image files as edit inputs.
- Do not implement mask UI or `maskFileID` in MVP.
- Do not use Responses API for this first version. It needs a different
  stateful conversation/file-id workflow and is better treated as a later
  design.

## Implementation Notes

- Add an `openAIImageEditsAdapter` next to `openAIImageGenerationsAdapter`.
- Register `AdapterOpenAIImageEdits` as implemented.
- Use multipart, not JSON, because the current app already has uploaded bytes in
  its own object storage rather than OpenAI file IDs.
- Reuse image generation option filtering where possible, but allow edit-only
  parameters like `input_fidelity` if already present in model options.
- For GPT image models, prefer `b64_json` parsing from the default response. For
  DALL-E 2 compatibility, keep response parsing support for URL or b64 output.

## Deferred Work

- Mask editing: add `maskFileID`, validate same dimensions and alpha channel,
  and append multipart `mask`.
- Responses API image editing with OpenAI file IDs and multi-turn context.
- Frontend mask editor or image-region selection.
