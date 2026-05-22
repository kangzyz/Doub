# Frontend Type Safety

The project uses TypeScript with `strict: false` in `frontend/tsconfig.json`.
Because the compiler is permissive, new code should be explicit at API and
component boundaries.

## DTO Types

Backend-facing DTOs belong in `frontend/shared/api/*.types.ts`. API functions in
`frontend/shared/api/*.ts` should return those types after envelope parsing.

Examples:

- `shared/api/auth.types.ts`
- `shared/api/conversation.types.ts`
- `shared/api/file.types.ts`
- `shared/api/settings.types.ts`

When backend DTOs change, update frontend DTOs in the same task and check
affected feature components.

## Unknown JSON Boundaries

Treat stream events, trace payload JSON, model capability JSON, and browser
storage values as unknown until normalized. The conversation API wrapper is the
reference: `normalizeTraceBlock`, `normalizeTraceEvent`,
`normalizeProcessTrace`, and `normalizeStreamEvent` safely coerce backend stream
payloads.

Use narrow type guards for user-provided or storage-provided objects, as in
`features/chat/model/conversation-options.ts`.

## React Types

- Use `type` imports for DTOs and React prop types.
- Prefer named prop types for reusable components and complex props.
- Keep hook result types explicit for large feature hooks.
- Use discriminated unions for stream event variants and mode values.

## Imports And Paths

Use the `@/*` path alias defined in `tsconfig.json`. Keep import direction
clear:

- `features/<domain>` may import `shared/*`, `components/ui`, and its own domain
  files.
- `shared/*` should not import from feature folders.
- `components/ui` should stay generic and not import business domains.

## Avoid

- Adding `any` where `unknown` plus a normalizer would work.
- Copying backend structs into feature files instead of centralizing DTOs in
  `shared/api`.
- Hiding shape mismatches with broad casts at component render sites.
