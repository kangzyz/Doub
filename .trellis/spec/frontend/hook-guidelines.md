# Frontend Hook Guidelines

Feature hooks own data loading, local workflow state, optimistic updates, and
browser side effects. Components should mostly render hook state and call hook
callbacks.

## Local Pattern

Reference hooks:

- `features/files/hooks/use-files-page.ts`
- `features/chat/hooks/use-chat-data.ts`
- `features/chat/hooks/use-chat-runtime.ts`
- `features/settings/hooks/use-settings-chat.ts`

Common shape:

- Create explicit result types for large hooks.
- Use `React.useState` for render state and `React.useRef` for mutable request
  sequence, mounted flags, and latest item snapshots.
- Wrap callbacks with `React.useCallback` when passed to child components.
- Use `React.useMemo` for derived lists and lookup maps that affect rendering.
- Guard async effects with cancellation flags or request sequence refs.
- Resolve access tokens through `resolveAccessToken` or auth context helpers.

## API And Errors

Hooks should call functions from `shared/api`, not raw endpoint strings in
components. Display errors through `useLocalizedErrorMessage`, `toast`, or
feature-specific inline error state.

For optimistic updates, use existing list helpers such as
`shared/lib/optimistic-list.ts` and restore previous state on failure. The file
manager hook is the reference for optimistic delete, rename, and RAG opt-out.

## Browser APIs

Only client components and hooks may touch `window`, `localStorage`,
`navigator`, media capture, or timers. Guard those accesses with
`typeof window !== "undefined"` where module code may run during render setup.

Clean up timers, event listeners, stream readers, and mounted flags in effect
cleanup functions.

## Streaming Scroll Controllers

Chat auto-follow logic must be interruptible by explicit user scroll input.
When a hook schedules `requestAnimationFrame` work to keep a live conversation
at the bottom, wheel/touch/keyboard scroll intent should cancel pending
auto-follow frames and clear any programmatic-scroll guard so the next `scroll`
event is treated as user-owned. During a live generation, do not re-arm
auto-follow merely because the viewport is still inside a generous "near
bottom" affordance threshold; re-arm only when the user is pinned to the actual
bottom or explicitly clicks the scroll-to-latest action.

```tsx
// Good: user scroll intent cancels a queued auto-follow before it can snap back.
viewport.addEventListener("wheel", markUserScrollIntent, { passive: true });
autoFollowRef.current = liveGeneration && userScrollIntent
  ? isPinnedToBottom(viewport)
  : isNearBottom(viewport);

// Bad: a queued scroll-to-bottom runs after the wheel event and traps the user.
if (autoFollowRef.current) {
  requestAnimationFrame(scrollToLatest);
}
```

## Avoid

- Large API/data effects inside route files or presentational components.
- Multiple components racing to fetch the same feature state independently.
- Swallowing errors silently when the user needs feedback.
- Keeping backend-authored business rules in hook state when the backend already
  exposes structured status or policy.
