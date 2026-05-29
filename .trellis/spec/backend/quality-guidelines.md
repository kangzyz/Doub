# Backend Quality Guidelines

Backend changes should preserve the existing layered architecture and generated
API documentation.

## Required Checks

Run these before finishing normal backend work:

```bash
cd backend
go test ./...
go vet ./...
go build ./cmd/server
```

Run this after changing routes, DTOs, Swagger annotations, or public API shape:

```bash
cd backend
make swagger
```

`make swagger` updates `backend/docs/swagger.json`, `backend/docs/swagger.yaml`,
and `backend/docs/docs.go`. Keep those generated files in sync when the public
API contract changes.

## Tests To Prefer

- Add focused service tests for domain behavior, policy decisions, routing,
  conversation branching, RAG, or security-sensitive logic. Existing
  examples include `internal/application/user/policy_test.go`,
  `internal/application/channel/service_routing_test.go`, and
  `internal/application/conversation/*_test.go`.
- Add transport tests when middleware, response shape, or request parsing
  changes. Examples include `internal/transport/http/server_test.go` and
  `internal/transport/http/middleware/*_test.go`.
- Add repository tests for persistence behavior that depends on Gorm, indexes,
  conflict clauses, or query shape.

## Review Rules

- Keep changes focused; do not mix feature work with broad refactors.
- Preserve request IDs, audit records, and Swagger docs as operational
  contracts.
- Treat `go vet`, `go test`, and the layering test as architecture gates.
- Do not commit caches, build output, local storage data, `.env` files, or
  generated artifacts unless the project explicitly requires them.
- Prefer direct code that matches current patterns over compatibility layers for
  historical behavior that is no longer used.
