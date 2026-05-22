# Backend Security And Auth

Security logic belongs in backend services and middleware. The frontend may
adapt UX, but it must not duplicate authoritative authorization, billing,
provider routing, or file-processing rules.

## Session Model

Access tokens are JWT Bearer tokens. Refresh tokens are issued by
`auth.Handler.writeRefreshTokenCookie` as HttpOnly cookies scoped to
`/api/v1/auth`. Refresh tokens are rotated by `/auth/refresh`.

`backend/internal/transport/http/middleware/auth.go` validates:

- `Authorization: Bearer <token>`
- token type is `access`
- active backend session through `SessionValidator`
- user context values used later by handlers

Use `middleware.MustUserID`, `MustSessionID`, and `MustUserRole` style helpers
instead of trusting client-provided user identity.

## Admin Access

Admin routes are mounted under `/api/v1/admin` in `server.go` and protected by
`middleware.AdminOnly`. The only admin role is the domain constant
`RoleSuperAdmin`.

Do not add broad user data access to normal authenticated routes. User-owned
data must be scoped by authenticated user ID unless the route is explicitly
admin-only.

## Secrets And Production Config

Static config loads from repository-level `config.yaml` or environment
variables in `backend/internal/infra/config/config.go`.

Production validation rejects:

- default or too-short `JWT_SECRET`
- default or too-short `DATA_ENCRYPTION_KEY`
- wildcard or empty CORS origin
- non-HTTPS public API or web URLs

`DATA_ENCRYPTION_KEY` protects upstream API keys, SSO client secrets, MCP
tokens, sensitive settings, and TOTP secrets. Do not log or return encrypted
or plaintext secret values.

## Outbound And File Safety

Use shared security helpers for outbound URL and file safety. Tests under
`backend/internal/shared/security` cover dangerous file types and outbound
policy behavior. Extend those tests when changing upload, extraction, OCR,
webhook, or provider callback behavior.

## Audit

Security-sensitive actions should record audit context with request ID, client
IP, user agent, action, resource, and detail. Existing references include auth
profile changes in `transport/http/auth/handler.go` and audit writer wiring in
`internal/app/app.go`.
