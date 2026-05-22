# Frontend Quality Guidelines

Frontend work should preserve static export behavior, API contracts, and the
existing dense product UI style.

## Required Checks

For normal frontend changes:

```bash
cd frontend
pnpm lint
```

For routing, dependency, Next.js config, message loading, or significant UI
changes:

```bash
cd frontend
pnpm build
```

`predev` and `prebuild` run version and icon sync checks. Do not bypass failures
without understanding whether `VERSION`, generated icon manifests, or package
scripts are out of sync.

## UI Review

- Check desktop and narrow viewport behavior when changing layouts.
- Keep text inside buttons, table cells, settings rows, and sidebars from
  overflowing or overlapping.
- Preserve keyboard and screen-reader labels for icon-only controls.
- Use loading, empty, error, syncing, disabled, and optimistic failure states
  that match nearby features.
- Ensure visible copy comes from next-intl messages, not hardcoded strings,
  except for product names, protocol labels, or data values.
- For pixel, animated, or decorative font effects, verify the implementation
  uses the Cult UI `PixelHeading` component from
  `pixel-heading-character`; do not approve one-off CSS/canvas/SVG text effects.

## API Review

- Confirm frontend DTOs match backend DTOs and `errorMsg`/`data` envelope shape.
- Use `authedRequest` or `authedFetch`; do not create one-off refresh handling.
- Add localized error messages for new public `errorCode` values surfaced to
  users.
- When a backend API contract changes, update Swagger and frontend types in the
  same task.

## Static Export Review

The app is configured with `output: "export"`. Avoid runtime-only Next server
features for product APIs. Keep business API behavior in the Go backend.
