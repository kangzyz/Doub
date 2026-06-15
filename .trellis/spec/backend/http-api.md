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

## Scenario: System Announcements API And Versioned User State

### 1. Scope / Trigger

Use this contract when changing site announcements, admin announcement
management, user dismiss/close behavior, or announcement persistence. This path
is cross-layer: backend routes expose announcement DTOs, PostgreSQL stores
announcement records and per-user state, and the frontend consumes both shared
and admin announcement API wrappers.

### 2. Signatures

- User HTTP:
  - `GET /api/v1/announcements`
  - `POST /api/v1/announcements/:id/dismiss-today`
  - `POST /api/v1/announcements/:id/close`
- Admin HTTP:
  - `GET /api/v1/admin/announcements?page=&page_size=&q=&status=&type=&pinned=`
  - `POST /api/v1/admin/announcements`
  - `PATCH /api/v1/admin/announcements/:id`
  - `DELETE /api/v1/admin/announcements/:id`
- User state body:
  `AnnouncementStateRequest{ updatedAt time.Time json:"updatedAt" }`
- Write body:
  `title`, `contentMarkdown`, `status`, `type`, `pinned`, `priority`,
  `startsAt`, `expiresAt`
- DB:
  `system_announcements` and `announcement_user_states`
- Repository:
  `repository.AnnouncementRepository`
- Frontend wrappers:
  `shared/api/announcements.ts` and `features/admin/api/announcements.ts`

### 3. Contracts

- Announcement responses use camelCase JSON fields:
  `id`, `title`, `contentMarkdown`, `status`, `type`, `pinned`, `priority`,
  `startsAt`, `expiresAt`, `createdByUserID`, `createdAt`, `updatedAt`,
  `closedAt`.
- User listing returns only active announcements whose time window contains
  `now`. Announcements dismissed until a future time are hidden.
- User listing may include closed announcements with `closedAt` populated, but
  the frontend should only reopen a dialog when the version is unread. The
  version key is `announcement.updated_at`.
- Dismiss and close requests must send the announcement `updatedAt` value seen
  by the client. Persistence keys user state by
  `(announcement_id, user_id, announcement_updated_at)`, so editing an
  announcement creates a new version and does not inherit stale close/dismiss
  state.
- Admin listing is paginated through `response.PageData` and sorted by
  `pinned DESC, priority DESC, updated_at DESC, id DESC`.
- Admin create defaults blank `status` to `active` and blank `type` to
  `general`.
- `startsAt` and `expiresAt` are nullable. PATCH must distinguish omitted
  fields from explicit `null`.
- Soft-deleted announcements and state rows must not appear in active queries.
- Swagger must be regenerated after route or DTO changes.

### 4. Validation & Error Matrix

- Missing or zero authenticated user/admin actor -> `repository.ErrInvalidInput`
  or auth middleware failure.
- Invalid `:id` path parameter -> HTTP 400.
- Blank or over-120-character title -> `ErrInvalidAnnouncement` -> HTTP 400.
- Blank or over-20000-character content on create/update ->
  `ErrInvalidAnnouncement` -> HTTP 400.
- Status outside `active|inactive` -> `ErrInvalidAnnouncement` -> HTTP 400.
- Type outside `critical|warning|info|normal|general` ->
  `ErrInvalidAnnouncement` -> HTTP 400.
- `expiresAt <= startsAt` when both are set -> `ErrInvalidAnnouncement` ->
  HTTP 400.
- Dismiss/close with missing `updatedAt`, zero ID, or a non-future
  `dismissedUntil` -> `repository.ErrInvalidInput` -> HTTP 400.
- Missing announcement for update/delete/state change -> `ErrAnnouncementNotFound`
  or `repository.ErrNotFound` -> HTTP 404.
- Unexpected repository failure -> HTTP 500.

### 5. Good/Base/Bad Cases

- Good: an admin creates an active pinned announcement with a valid window; the
  user API returns it first while the window is open.
- Good: a user closes version A, an admin edits the announcement, and version B
  can display because the user state key includes `announcement_updated_at`.
- Base: a user chooses dismiss today; the announcement is hidden until the
  saved `dismissed_until` time is no longer in the future.
- Base: admin PATCH sends `"startsAt": null` to clear the start window and omits
  `expiresAt` to leave it unchanged.
- Bad: client code stores close state by announcement ID only; it would suppress
  important edits forever.
- Bad: handler returns raw Gin JSON instead of the shared envelope.

### 6. Tests Required

- Service tests should cover create/update validation, default status/type,
  invalid windows, dismiss validation, close validation, and repository
  not-found mapping.
- Repository tests should cover active time-window filtering, dismissed/closed
  state version joins, admin sorting/filtering, soft delete, and upsert conflict
  on `(announcement_id, user_id, announcement_updated_at)` when a DB test harness
  is available.
- HTTP or Swagger checks should cover all announcement routes and camelCase DTO
  fields.
- Frontend lint/build must pass after changing announcement DTOs, wrappers,
  admin page behavior, dialog host behavior, or announcement i18n keys.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not key user close state only by announcement ID.
Where("announcement_id = ? AND user_id = ?", announcementID, userID)
```

#### Correct

```go
// Versioned state lets edited announcements display again.
Where("announcement_id = ? AND user_id = ? AND announcement_updated_at = ?", announcementID, userID, announcementUpdatedAt)
```

#### Wrong

```typescript
// Do not call fetch directly from the admin page.
await fetch(`/api/v1/admin/announcements/${id}`, { method: "PATCH" });
```

#### Correct

```typescript
// Use the typed wrapper so auth refresh and envelopes stay consistent.
await updateAdminAnnouncement(accessToken, id, payload);
```

## Avoid

- Returning raw Gin JSON shapes from handlers except for health/version/static
  runtime endpoints already handled in `server.go`.
- Calling Gorm, Redis, Docker, or provider clients from handlers.
- Reading or trusting user IDs from the request body when authenticated context
  already provides them.
