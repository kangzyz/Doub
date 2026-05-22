# TypeScript Guidelines

TypeScript is used only in the frontend. The compiler currently has
`strict: false`, so rely on clear local types and runtime normalization at API
boundaries.

## Local Style

- Use the `@/*` alias for imports from `frontend/`.
- Prefer `type` imports for DTOs and prop types.
- Use explicit result types for exported API functions and large hooks.
- Keep shared utilities in `shared/lib` pure and dependency-light.
- Use `cn` from `frontend/lib/utils.ts` for class merging.

## DTOs And API Types

Put backend-facing types in `frontend/shared/api/*.types.ts`. API wrapper files
should translate backend envelopes into typed return values.

Do not place DTO definitions inside feature components when the shape is shared
with backend or another feature.

## Runtime Normalization

Use `unknown` plus narrow conversion helpers for:

- stream event payloads
- trace block payloads
- model option JSON
- localStorage values
- user-provided JSON configuration

`frontend/shared/api/conversation.ts` and
`frontend/features/chat/model/conversation-options.ts` are the main references.

## Component And Hook Types

For reusable UI, define named prop types when props are more than a few fields.
For feature hooks, define a result type when the hook returns many values, as in
`features/files/hooks/use-files-page.ts`.

Avoid broad casts in render code. Normalize the value earlier, then pass a typed
shape to components.
