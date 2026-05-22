# Backend Error Handling

Backend errors should be meaningful inside the service and stable at the API
boundary.

## Service Errors

Use package-level sentinel errors or small typed errors in application packages
for domain decisions. Examples:

- `internal/application/auth/errs.go`
- `internal/application/channel/errs.go`
- `internal/application/usersettings/service.go` defines `ErrValidation` and
  `IsValidationError`.

Handlers should use `errors.Is` or `errors.As` to map known cases to the right
HTTP status. Keep this mapping close to the handler so API behavior is visible
at the transport boundary.

## Response Helpers

Use `backend/internal/shared/response`:

- `InvalidRequestBody` for malformed or invalid JSON binding.
- `Error` for simple status + message mapping.
- `ErrorFrom` when returning an application validation error.
- `ErrorWithCode` or `ErrorWithDetails` when the response needs a stable code
  or details payload.
- `Success` and `SuccessPage` for successful responses.

`response.Error` and `ErrorFrom` normalize public messages and infer stable
`errorCode` values through `error_code.go`. Add new stable codes there when a
frontend workflow needs localized handling.

## Public Message Rules

- Avoid returning raw internal errors for 5xx paths; use a generic public
  message and log operational detail separately.
- Preserve safe validation detail for 4xx errors when it helps the frontend.
- Do not expose API keys, provider secrets, prompts, file contents, token
  values, or raw upstream request bodies in `errorMsg` or `details`.
- Include request IDs through the response helper path, not hand-built JSON.

## Frontend Contract

Frontend error localization reads `errorCode` first and falls back to
`errorMsg`. If you introduce a new public `errorCode`, add matching locale
messages under `frontend/i18n/messages/en-US/errors.json` and
`frontend/i18n/messages/zh-CN/errors.json` when the UI surfaces it.
