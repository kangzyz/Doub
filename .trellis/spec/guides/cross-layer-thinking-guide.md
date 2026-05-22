# Cross-Layer Thinking Guide

Use this guide when a change crosses frontend UI, backend API, persistence,
auth, billing, files, RAG, model routing, or streaming.

## Main Flow

```text
Frontend route/page
  -> feature component
  -> feature hook
  -> shared/api wrapper
  -> Go HTTP handler
  -> application service
  -> repository interface
  -> infra persistence/cache/provider adapter
```

Keep responsibilities in that direction. The frontend renders workflows and
calls explicit APIs. The backend owns business rules and persistence.

## Contract Checklist

For API changes, answer these before editing:

- Which backend route and DTO define the contract?
- Does the response still use `errorMsg` + `data`?
- Does the frontend DTO in `shared/api/*.types.ts` match the backend response?
- Are new error codes added to backend `response/error_code.go` and frontend
  locale files?
- Does the endpoint require user auth, admin auth, public auth rate limiting, or
  a public route?
- Does Swagger need regeneration?

## Auth And User Scope

Normal user data must be scoped by authenticated user ID from backend
middleware. Admin-wide access belongs under `/api/v1/admin` and requires
`middleware.AdminOnly`.

Frontend guards and hiding UI controls are not authorization. Backend handlers
and services remain authoritative.

## Streaming And Long Workflows

Conversation, media, file processing, RAG, and tool calls often span multiple
layers:

- Backend emits structured stream events and process trace blocks.
- Frontend parses events in `shared/api/conversation.ts`.
- Feature hooks update UI state.
- Components render trace, usage, thinking, and tool sections.

When adding a new state or event, update backend emission, frontend event types,
normalization, hook handling, UI rendering, and translations together.

## Persistence And Generated Docs

Backend schema changes may require:

- Gorm model updates in `infra/persistence/models`.
- `applySchemaBaseline` and idempotent baseline SQL updates in `postgres.go`.
- Repository interface and implementation updates.
- Service tests or repository tests.

Public API changes may require:

- Swagger annotations and generated docs.
- Frontend DTO and API wrapper updates.
- User-visible i18n updates.

## Common Failure Modes

| Failure | Prevention |
| --- | --- |
| Frontend assumes business rules that backend later rejects | Consume backend policy/status fields instead of duplicating rules |
| Backend route changes but frontend DTO remains old | Update backend DTO, Swagger, frontend DTO, and wrapper in one task |
| Handler imports persistence or provider clients | Add a service or repository method; keep handlers thin |
| New error cannot be localized | Add stable backend `errorCode` and frontend locale messages |
| Stream event renders inconsistently | Update event type, parser, hook, component, and translations together |
