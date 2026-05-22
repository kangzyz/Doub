# Dependency Guidelines

Dependencies are split between the Go backend and the Next.js frontend. Add new
dependencies only when existing project tools cannot reasonably solve the
problem.

## Backend

Backend dependencies are declared in `backend/go.mod`. Core direct dependencies
include:

- `github.com/gin-gonic/gin` for HTTP transport.
- `gorm.io/gorm` and `gorm.io/driver/postgres` for persistence.
- `github.com/go-redis/redis/v8` for cache/rate-limit/runtime caches.
- `go.uber.org/zap` for logging.
- `go.opentelemetry.io/*` for optional tracing.
- `github.com/swaggo/*` for Swagger generation.
- AWS S3, document parsing, crypto, MIME, and file-processing dependencies used
  by storage and extraction features.

Run `go mod tidy` only when dependency changes require it. Do not add direct
dependencies that bypass existing infra adapters for LLM, MCP, storage,
embedding, tracing, config, or persistence.

## Frontend

Frontend dependencies are declared in `frontend/package.json` and installed with
`pnpm@10.17.0`.

Core dependencies include:

- `next`, `react`, and `react-dom`.
- `next-intl` for i18n.
- `lucide-react`, Radix/Base UI packages, and shadcn-style components.
- `streamdown`, KaTeX, Mermaid, Monaco, PDF/DOCX preview tooling, Recharts, and
  Motion for rich product UI.
- `tailwindcss`, `tailwind-merge`, and `class-variance-authority` for styling.

Respect existing `pnpm.overrides`. Run `pnpm install` after package changes and
commit the lockfile update when dependency changes are intentional.

## Version Sync

Both backend Make targets and frontend package scripts use
`../scripts/sync-version.mjs`. Frontend `predev`/`prebuild` and backend
`make build` call version checks. Do not remove those checks; fix the version
source or generated state when they fail.
