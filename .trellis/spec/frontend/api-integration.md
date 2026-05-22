# Frontend API Integration

The frontend talks to the Go backend through explicit fetch wrappers in
`frontend/shared/api`. There is no generated RPC TypeScript API client in this
repository.

## Client Stack

Use these shared helpers:

- `shared/api/http-client.ts` for base URL resolution, envelope parsing,
  request building, and `ApiError`.
- `shared/api/authed-client.ts` for authenticated requests, access-token refresh,
  and stream/FormData fetches.
- `shared/api/*.types.ts` for DTOs that mirror backend response shapes.
- `pathParam` for path segment encoding.

Do not call `fetch` directly from feature components unless a shared API helper
cannot represent the use case. Streams and uploads should use `authedFetch`.

## Envelope Contract

Backend responses use:

```ts
export type ApiEnvelope<T> = {
  errorMsg: string;
  errorCode?: string;
  details?: unknown;
  requestId?: string;
  data: T;
};
```

`apiRequest` throws `ApiError` when HTTP status is not ok or `errorMsg` is set.
Feature hooks should pass those errors through `useLocalizedErrorMessage` when
displaying user-facing toasts or inline errors.

## Auth Refresh

Use `authedRequest` for JSON APIs. It retries once after a 401 by calling
`/api/v1/auth/refresh`, which uses the backend HttpOnly refresh cookie and
updates the in-memory/session snapshot access token.

Use `authedFetch` for streaming or upload flows that need a raw `Response`.
It has the same refresh behavior.

## Streaming

Conversation streaming is manually parsed in
`frontend/shared/api/conversation.ts`. The backend sends NDJSON, with one JSON
object per line, rather than SSE text events. `extractJSONDocuments`,
`normalizeStreamEvent`, and `handleStreamEvent` are the parsing and dispatch
points.

### Media Image Preview Events

`media_image_delta` events may carry `b64_json` preview payloads while an image
generation run is still saving the final file. Do not convert those base64
payloads into Markdown image content such as
`![alt](data:image/png;base64,...)`.

Keep the assistant message in its image loading state until the completed event
returns the persisted assistant message content. This prevents Markdown
sanitizers from rendering blocked `data:` placeholders and keeps the stream UI
consistent with the final file-backed image.

```ts
// Good: status events update the loading label; completed content replaces it.
onMediaStatus: updateImageLoadingLabel;

// Bad: base64 previews enter the Markdown renderer and may be blocked.
onMediaImageDelta: (event) => setContent(`![preview](data:image/png;base64,${event.b64_json})`);
```

When adding stream event types, update:

- `frontend/shared/api/conversation.types.ts`
- `frontend/shared/api/conversation.ts`
- the consuming feature hook or component under `features/chat`
- backend event emission and Swagger/API docs when public contract changes

## Adding An Endpoint

For a new backend endpoint:

1. Add or update backend DTOs and route handlers.
2. Regenerate backend Swagger when public API shape changes.
3. Add frontend DTO types in `shared/api/<domain>.types.ts`.
4. Add wrapper functions in `shared/api/<domain>.ts`.
5. Consume the wrapper from a feature hook, not directly from a page file.
6. Add localized error messages for any new public `errorCode` visible in UI.
