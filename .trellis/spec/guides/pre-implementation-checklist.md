# Pre-Implementation Checklist

Run this checklist before writing code or changing specs.

## 1. Locate Ownership

- Is this backend, frontend, shared, docs, Docker, or a generated artifact?
- Which feature/domain already owns similar behavior?
- Is there an existing route, service, hook, component, API wrapper, or utility
  to extend instead of creating a parallel one?

Useful searches:

```bash
rg "keyword" backend/internal frontend/features frontend/shared
rg --files backend/internal/transport/http frontend/features
```

## 2. Check Layer Boundaries

Backend:

- Handler only binds input, reads auth context, calls services, and returns
  response helpers.
- Application services do not import Gin, Gorm, Redis, or persistence packages.
- Repository interfaces use domain types.
- Infra packages own Gorm, Redis, provider clients, and runtime adapters.
- Domain types stay protocol-free.

Frontend:

- Route pages stay thin.
- Feature hooks own workflow state and side effects.
- Components render state and call callbacks.
- API calls go through `shared/api`.
- Shared modules do not import feature modules.

## 3. Check Contracts

- Does the backend response still use `errorMsg` + `data`?
- Do frontend DTOs match backend DTOs?
- Are new public errors represented by stable `errorCode` values?
- Do visible frontend messages have `en-US` and `zh-CN` translations?
- Does Swagger need regeneration?
- Does a config change need `config.example.yaml`, `config.docker.example.yaml`,
  README, or Docker updates?

## 4. Check Security

- Is user data scoped by authenticated user ID?
- Is the route public, authenticated, or admin-only?
- Are refresh tokens still HttpOnly-only?
- Are secrets, prompts, tool arguments, file contents, API keys, and raw tokens
  kept out of responses, logs, and traces?
- Is outbound URL/file handling covered by existing security helpers and tests?

## 5. Decide Verification

Backend:

```bash
cd backend
go test ./...
go vet ./...
go build ./cmd/server
make swagger
```

Frontend:

```bash
cd frontend
pnpm lint
pnpm build
```

Use `make swagger` after backend API shape changes. Use `pnpm build` for
frontend route, dependency, config, static export, or translation loading
changes.
