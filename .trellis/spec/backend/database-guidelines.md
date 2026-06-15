# Database Guidelines

The backend uses Gorm with PostgreSQL and optional pgvector support. Database
access belongs behind repository interfaces.

## Models And Tables

Gorm models live under `backend/internal/infra/persistence/models`. Each model
defines its `TableName`, and tables are grouped by domain prefix:

- `identity_*` for users, sessions, credentials, providers, and auth events.
- `chat_*` for conversations, messages, runs, traces, shares, and context.
- `file_*` for file objects and RAG chunks.
- `llm_*` for upstreams, platform models, routes, and model catalog data.
- `system_settings`, `system_announcements`, `announcement_user_states`,
  `user_settings`, `audit_logs`, and `system_events` for operational state.

Reference: `backend/internal/infra/persistence/models/user.go` and
`backend/internal/infra/persistence/postgres/postgres.go`.

## Migrations And Baselines

The project currently initializes schema through `applySchemaBaseline` and
explicit baseline helpers in `postgres.go`, not a separate migration directory.
When adding schema:

- Add the model to `applySchemaBaseline`.
- Add table comments to the `tableComments` map.
- Add indexes and constraints with idempotent SQL such as
  `CREATE INDEX IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Keep vector setup optional unless the relevant config requires it. See
  `applyVectorBaseline` and `vectorBaselineRequired`.

## Repository Pattern

Repository interfaces live in `backend/internal/repository` and use domain
types, not Gorm models. Implementations live under
`backend/internal/infra/persistence/postgres/<domain>`.

Follow the `usersettings` example:

- Interface: `internal/repository/usersettings.go`
- Domain type: `internal/domain/usersettings/types.go`
- Gorm implementation: `internal/infra/persistence/postgres/usersettings/repository.go`

Use `db.WithContext(ctx)` for queries. Map persistence errors to repository
semantics with helpers like `translateError`; `gorm.ErrRecordNotFound` should
become `repository.ErrNotFound` or `nil` only when the method contract says a
missing optional row is allowed.

## Transactions And Conflicts

Use Gorm transactions where multiple writes must succeed or fail together.
Use `clause.OnConflict` for upserts that rely on database uniqueness, as in
`usersettings.Repo.Upsert`.

Do not put SQL query details into application services or transport handlers.
If an application method needs a new query shape, extend the repository
interface and implement it in the infra package.
