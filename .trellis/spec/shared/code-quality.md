# Shared Code Quality

Use these rules when a change crosses frontend, backend, docs, or runtime
configuration.

## Keep Contracts Explicit

Cross-stack contracts are maintained through:

- Backend DTOs and Swagger annotations in `backend/internal/transport/http`.
- Generated Swagger files in `backend/docs`.
- Frontend DTOs in `frontend/shared/api/*.types.ts`.
- The shared response envelope `errorMsg`, optional `errorCode`, optional
  `details`, optional `requestId`, and `data`.

When backend API shape changes, update the frontend API wrapper and DTO type in
the same task.

## Keep Boundaries Clear

- Frontend owns UI, client workflow state, message rendering, and admin/user
  screens.
- Backend owns auth, authorization, provider routing, file processing,
  memory, RAG, audit logs, persistence, and operational policy.
- Docker owns optional local OCR/extraction/runtime dependencies.

Do not duplicate backend business rules in frontend code. Frontend code should
consume backend DTOs, capability JSON, policy fields, and structured statuses.

## Generated Artifacts

Generated artifacts are allowed only when they are part of the project contract:

- `backend/docs/swagger.json`
- `backend/docs/swagger.yaml`
- `backend/docs/docs.go`
- `frontend/shared/generated/lobehub-icon-manifest.ts`

Do not commit caches, `.next`, `out`, storage data, `.env` files, pycache, or
temporary local files.

## Change Discipline

- Keep tasks focused; avoid unrelated refactors.
- Prefer existing helpers and patterns over new abstractions.
- Add abstractions only when they reduce real duplication or match an existing
  local pattern.
- Preserve request IDs, audit behavior, auth refresh behavior, and error code
  localization when changing cross-layer flows.
