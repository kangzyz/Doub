# Shared Guidelines

Read these when a task crosses frontend/backend boundaries, changes
dependencies, updates public contracts, or touches shared TypeScript style.

| File | Read When |
| --- | --- |
| [code-quality.md](./code-quality.md) | Any cross-layer change or generated artifact update |
| [dependencies.md](./dependencies.md) | Adding, removing, or upgrading dependencies |
| [typescript.md](./typescript.md) | Writing TypeScript DTOs, shared utilities, or component types |

Cross-stack validation usually means:

```bash
cd backend
go test ./...
go build ./cmd/server
```

```bash
cd frontend
pnpm lint
pnpm build
```

Add `go vet ./...` and `make swagger` for backend API or operational changes.
