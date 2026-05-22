# DEEIX Chat Development Specs

These specs describe the repository as it exists now: a Next.js frontend in
`frontend/`, a Go API service in `backend/`, and optional runtime services
under `docker/`.

Read the spec layer that matches the files you will change:

| Layer | Use For |
| --- | --- |
| [backend](./backend/index.md) | Go API, Gin routes, application services, repositories, persistence, auth, billing, LLM routing, file/RAG, observability |
| [frontend](./frontend/index.md) | Next.js App Router pages, feature components, hooks, API wrappers, auth session UI, i18n, styling |
| [shared](./shared/index.md) | Cross-stack contracts, dependency policy, TypeScript style, generated artifacts |
| [guides](./guides/index.md) | Pre-implementation checks and cross-layer reasoning |

Core project contracts:

- Backend startup flows through `backend/cmd/server/main.go` ->
  `backend/internal/cli/server.go` -> `backend/internal/app/app.go`.
- Backend requests flow through `transport/http` -> `application` ->
  `repository` interfaces -> `infra` implementations.
- Frontend route files in `frontend/app/` stay thin and delegate real work to
  `frontend/features/*`.
- API responses use the `errorMsg` + `data` envelope defined in
  `backend/internal/shared/response/response.go` and
  `frontend/shared/api/common.types.ts`.
- Auth uses in-memory frontend access tokens plus a backend HttpOnly refresh
  cookie; do not move refresh tokens into frontend storage.

Common verification commands:

```bash
cd backend
go build ./cmd/server
go test ./...
go vet ./...
make swagger
```

```bash
cd frontend
pnpm lint
pnpm build
```

Run `make swagger` after backend route, DTO, or Swagger annotation changes.
Run `pnpm build` for frontend route, dependency, or Next.js configuration
changes.
