# HTTP API Guidelines

HTTP code uses Gin under `/api/v1`. Public, authenticated, and admin-only
routes are grouped in `backend/internal/transport/http/server.go`.

## Route Registration

Register domain routes from module methods, not from `server.go` directly:

- Public auth-like routes use `RegisterPublicRoutes`.
- Authenticated user routes use `RegisterRoutes` or `RegisterProtectedRoutes`.
- Superadmin routes are registered under `/admin` after `middleware.AdminOnly`.

Use the existing `auth/router.go`, `usersettings/router.go`, and
`conversation/router.go` files as references.

## Handler Pattern

Handlers should:

- Bind request input with `c.ShouldBindJSON`, query/path parsing helpers, or
  existing DTO converters.
- Read auth context with `middleware.MustUserID`, `MustSessionID`,
  `MustRequestID`, and `ResolveSessionAuditContext`.
- Call an application service.
- Map known domain/application errors to HTTP statuses.
- Return the shared envelope through `internal/shared/response`.

The `usersettings` handler is the compact reference:
`backend/internal/transport/http/usersettings/handler.go`.

## Response Contract

All API responses use `response.Envelope`:

- Success: `errorMsg` is empty and `data` contains the payload.
- Failure: `errorMsg`, `errorCode`, optional `details`, optional `requestId`,
  and `data: null`.
- Paginated responses use `response.PageData[T]` with `total` and `results`.

The frontend mirrors this contract in `frontend/shared/api/common.types.ts` and
`frontend/shared/api/http-client.ts`. Do not introduce alternate envelopes such
as snake_case fields.

## Swagger

Handlers with public API impact should include Swagger comments near the
handler. DTO files often define `*ResponseDoc` wrappers for documented envelope
shapes, as in `usersettings/dto.go` and `auth/dto.go`.

After route, DTO, or Swagger annotation changes, run:

```bash
cd backend
make swagger
```

## Avoid

- Returning raw Gin JSON shapes from handlers except for health/version/static
  runtime endpoints already handled in `server.go`.
- Calling Gorm, Redis, Docker, or provider clients from handlers.
- Reading or trusting user IDs from the request body when authenticated context
  already provides them.
