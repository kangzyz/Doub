# Backend Logging And Observability

The backend uses Zap for logging and OpenTelemetry for optional tracing.

## Logger Setup

`backend/internal/infra/observability/logger/logger.go` creates the platform
logger via `internal/pkg/logger`. `internal/app/app.go` creates one logger and
passes it into services, middleware, and long-running workflows.

Do not create ad hoc global loggers in feature packages. Accept `*zap.Logger`
through constructors or setter methods, matching services such as auth,
channel, conversation, and compact.

## Request Logs

`backend/internal/transport/http/middleware/logging.go` writes access logs with:

- method and path
- start/end time
- latency
- status and response size
- client IP
- request ID
- trace ID
- user ID
- user agent

`/healthz` is intentionally skipped. Preserve that behavior for noisy probes.

## Service Logs

Use structured fields for operational events. Conversation logging is the
reference for trace-aware service fields:

- `zap.String("trace_id", traceid.FromContext(ctx))`
- IDs such as `conversation_id`, `user_id`, `run_id`
- provider protocol, upstream name, token counts, and safe status labels

Never log prompts, file contents, tool arguments, API keys, refresh tokens,
authorization headers, TOTP secrets, encrypted secret blobs, or raw webhook
bodies.

## Tracing

OpenTelemetry is initialized in `app.NewApp` through
`infra/observability/tracing`. HTTP instrumentation skips `/healthz`.

For long backend workflows, start spans through `platformtracing.Start` and
record errors with `platformtracing.RecordError`. The conversation send path in
`application/conversation/service_message_send.go` is the main reference.
