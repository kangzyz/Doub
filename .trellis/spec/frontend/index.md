# Frontend Guidelines

The frontend is a static-export Next.js App Router application. Read this index
before changing files under `frontend/`.

## Pre-Development Checklist

- Locate the owning feature folder before adding UI or state.
- Keep `app/` route files thin; move workflow logic into `features/*`.
- Reuse `components/ui` and existing shared/product components before adding new
  primitives.
- Use `shared/api` wrappers for backend calls.
- Add or update translations for visible text in both `en-US` and `zh-CN`.
- Check whether the change affects static export, routing, auth refresh,
  streaming, or API contracts.

## Spec Files

| File | Read When |
| --- | --- |
| [directory-structure.md](./directory-structure.md) | Adding files, routes, features, or shared modules |
| [component-guidelines.md](./component-guidelines.md) | Building UI components or product screens |
| [hook-guidelines.md](./hook-guidelines.md) | Adding feature hooks, async effects, optimistic state, or browser APIs |
| [state-management.md](./state-management.md) | Deciding where state lives |
| [api-integration.md](./api-integration.md) | Calling backend APIs, adding DTOs, streams, or auth refresh behavior |
| [type-safety.md](./type-safety.md) | Adding TypeScript types, DTOs, or runtime normalization |
| [quality-guidelines.md](./quality-guidelines.md) | Before finishing frontend changes |

## Quality Check

Run lint for normal frontend changes:

```bash
cd frontend
pnpm lint
```

Run a production build for route, dependency, Next config, static export,
translation loading, or broad UI changes:

```bash
cd frontend
pnpm build
```

There is no dedicated frontend test script in `package.json` right now. For
logic-heavy utilities, keep functions small and pure enough to test when a test
runner is introduced.
