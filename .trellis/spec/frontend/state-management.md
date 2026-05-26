# Frontend State Management

The frontend uses React state, feature hooks, contexts, URL search params, and
small shared helpers. It does not currently use Redux, Zustand, or React Query.

## Where State Belongs

| State Type | Location |
| --- | --- |
| Route selection and deep links | URL/search params via `next/navigation` |
| Auth session snapshot and current user | `shared/auth` and `AuthSessionProvider` |
| Chat workspace workflow | `features/chat/hooks` and `features/chat/context` |
| Sidebar recents | `features/recent/context` and related hooks |
| File manager list/detail/upload state | `features/files/hooks/use-files-page.ts` |
| Settings form state | `features/settings/hooks` plus backend user/system settings |
| Cross-feature display helpers | `shared/lib` pure functions |

Backend-owned business state should stay authoritative on the backend. Frontend
state may be optimistic, but it must reconcile with backend responses.

## Auth State

Access tokens are normally kept client-side in memory/session snapshot helpers.
The refresh token is an HttpOnly cookie set by the backend. Use
`authedRequest`, `authedFetch`, and `resolveAccessToken`; do not store refresh
tokens in localStorage or expose them to React state.

`shared/auth/session.ts` may persist the short-lived `accessToken` and
`sessionID` snapshot to localStorage under `doub-chat:session-snapshot:v1` as a
WebView/browser process-recovery fallback. It must never persist refresh tokens,
must guard browser storage access with `typeof window !== "undefined"` plus
`try/catch`, and must remove the key when both fields are empty.

`shared/auth/auth-session-context.tsx` loads and refreshes the current user
profile and listens for profile update events.

## Persistent Browser State

Use localStorage only for the auth recovery snapshot described above and client
preferences that are safe to lose or recreate, such as cached model options in
`features/chat/components/app-chat-area.tsx`. Guard access with
`typeof window !== "undefined"` and catch storage failures.

## Optimistic State

Use `shared/lib/optimistic-list.ts` helpers for list mutations. Keep previous
state available so failed mutations can restore UI. The file manager hook shows
the expected pattern for delete, rename, and RAG opt-out.

## Avoid

- Adding a global state library for one feature.
- Treating frontend state as the source of truth for authorization, billing,
  model routing, file processing, or provider behavior.
- Duplicating backend policy logic instead of consuming backend DTOs and policy
  fields.
