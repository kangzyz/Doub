# Backend Directory Structure

The backend is a Go 1.25 service built with Gin, Gorm, PostgreSQL/pgvector,
Redis, Swagger, Zap, and optional OpenTelemetry. Keep new code inside the
existing layered boundaries.

## Startup And Composition

Startup is deliberately narrow:

- `backend/cmd/server/main.go` sets Swagger version metadata and calls the CLI.
- `backend/internal/cli/server.go` creates the app and defers cleanup.
- `backend/internal/app/app.go` wires configuration, tracing, logger, database,
  Redis, repositories, services, handlers, modules, and background workers.

Only `internal/app` should assemble concrete infrastructure. New domains should
follow the existing constructor chain in `app.NewApp`: repository -> service ->
handler -> HTTP module -> `platformhttp.Modules`.

## Runtime Layers

| Layer | Owns | Examples |
| --- | --- | --- |
| `internal/transport/http` | Gin routing, request binding, auth context, response conversion, Swagger annotations | `auth/router.go`, `usersettings/handler.go`, `server.go` |
| `internal/application` | Use-case orchestration, validation, domain rules, cache decisions, external service coordination | `usersettings/service.go`, `conversation/service_message_send.go` |
| `internal/repository` | Interfaces and repository-level semantic errors | `repository/usersettings.go`, `repository/errors.go` |
| `internal/infra` | Gorm, Redis, LLM, MCP, storage, config, tracing, runtime adapters | `infra/persistence/postgres/usersettings/repository.go`, `infra/config/config.go` |
| `internal/domain` | Protocol-free business types and constants | `domain/usersettings/types.go`, `domain/user/types.go` |
| `internal/shared` | Cross-cutting response, request metadata, security, build info | `shared/response/response.go`, `shared/security/security.go` |
| `internal/pkg` | Dependency-light technical helpers | `pkg/token`, `pkg/logger`, `pkg/traceid` |

`backend/internal/transport/http/layering_test.go` enforces important import
boundaries. Do not import Gin, Gorm, Redis, or persistence implementations into
application, repository, or domain packages.

## HTTP Module Shape

HTTP domains use a repeated shape:

```text
internal/transport/http/<domain>/
  module.go    # Module struct and NewModule
  router.go    # RegisterPublicRoutes, RegisterRoutes, RegisterAdminRoutes
  handler.go   # Gin handlers only
  dto.go       # request, response, Swagger doc DTOs
```

Reference modules:

- `backend/internal/transport/http/auth`
- `backend/internal/transport/http/usersettings`
- `backend/internal/transport/http/conversation`

Handlers should stay thin. They bind input, read authenticated context through
`middleware.MustUserID` and related helpers, call application services, and
return through `response.Success`, `response.SuccessPage`, `response.Error`,
`response.ErrorFrom`, or `response.ErrorWithDetails`.

## Application And Repository Shape

Application packages own service methods and input validation. Keep Gorm models
and SQL out of this layer. The `usersettings` flow is the smallest complete
example:

- `internal/application/usersettings/service.go` validates setting keys and
  values, fills defaults, and calls the repository interface.
- `internal/repository/usersettings.go` defines the interface against domain
  types.
- `internal/infra/persistence/postgres/usersettings/repository.go` implements
  the interface with Gorm and maps model rows back to domain values.
- `internal/domain/usersettings/types.go` defines the protocol-free domain
  shape.

Large domains may split a service by capability, as conversation does with
`service_message_send.go`, `service_cache.go`, `service_file.go`,
`service_tool.go`, and focused tests beside the implementation.

## Avoid

- Adding business logic directly to Gin handlers.
- Importing `internal/infra/persistence`, `gorm.io/gorm`, or Redis clients from
  `internal/application`.
- Adding JSON, form, or Gorm tags to `internal/domain` types.
- Creating compatibility helpers or historical aliases unless an existing
  public contract requires them.
