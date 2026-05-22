# Backend Guidelines

The backend is a layered Go API service. Read this index before changing any
file under `backend/`.

## Pre-Development Checklist

- Identify the layer you are touching: HTTP transport, application service,
  repository interface, infra adapter, domain type, or shared helper.
- Search for an existing domain with the same shape before adding a new one.
- Keep request and response contracts aligned with Swagger docs and frontend
  `shared/api/*.types.ts`.
- Preserve user scoping and admin-only checks; broad data access belongs only on
  explicit admin routes.
- Decide which verification commands apply before editing.

## Spec Files

| File | Read When |
| --- | --- |
| [directory-structure.md](./directory-structure.md) | Adding a domain, moving code, or crossing backend layers |
| [http-api.md](./http-api.md) | Creating or changing Gin handlers, routes, DTOs, or Swagger annotations |
| [database-guidelines.md](./database-guidelines.md) | Adding models, repositories, indexes, migrations, or Gorm queries |
| [error-handling.md](./error-handling.md) | Adding validation, sentinel errors, response mapping, or public error codes |
| [security-auth.md](./security-auth.md) | Touching auth, sessions, admin access, cookies, secrets, user data, or outbound safety |
| [logging-guidelines.md](./logging-guidelines.md) | Adding logs, traces, request IDs, or operational events |
| [ai-and-conversation.md](./ai-and-conversation.md) | Touching LLM routing, chat streaming, RAG, tools, prompt traces, or model options |
| [quality-guidelines.md](./quality-guidelines.md) | Before finishing backend changes |

## Quality Check

Use the narrowest reliable check first, then broaden when the change touches
shared behavior:

```bash
cd backend
go test ./...
go vet ./...
go build ./cmd/server
```

Run this after route, DTO, or Swagger comment changes:

```bash
cd backend
make swagger
```

`backend/internal/transport/http/layering_test.go` is part of the architecture
contract. If it fails, fix the import direction instead of weakening the test.
