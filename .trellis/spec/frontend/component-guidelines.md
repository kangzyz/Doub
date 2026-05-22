# Frontend Component Guidelines

Components should match the existing product UI: dense, utilitarian, and built
for repeated use rather than marketing-style presentation.

## Component Placement

- Put reusable primitives in `components/ui`.
- Put cross-feature product components in `shared/components`.
- Put domain-specific UI in `features/<domain>/components`.
- Keep route files in `app/` as small wrappers around feature components.

Use existing UI primitives first. References include `components/ui/button.tsx`,
`dialog.tsx`, `sheet.tsx`, `table.tsx`, `tabs.tsx`, `switch.tsx`,
`select.tsx`, `input.tsx`, and `textarea.tsx`.

## Client Components

Add `"use client"` to components that use hooks, browser APIs, context,
toasts, `next/navigation`, localStorage, or event handlers. Keep pure route
wrappers server-renderable when possible.

## Styling

- Use Tailwind utility classes and `cn` from `frontend/lib/utils.ts`.
- For variants, follow the `class-variance-authority` pattern in
  `components/ui/button.tsx`.
- Prefer `lucide-react` icons for common actions.
- For icon-only buttons, provide `aria-label`.
- Keep cards and panels compact; settings and admin pages use rows, sections,
  tables, dialogs, sheets, tabs, switches, selects, and toolbars.
- Avoid nested cards and decorative page sections that make operational screens
  harder to scan.

## Typography Effects

Do not invent custom font effects, pixel text effects, scrambling headings,
canvas/SVG text shaders, or one-off font cycling animations. When a feature
needs a pixel-style animated heading or similar font effect, use the Cult UI
Pixel Heading (Char) component as the project standard:

- Source: https://www.cult-ui.com/docs/components/pixel-heading-character
- Component import after installation:
  `import { PixelHeading } from "@/components/ui/pixel-heading-character"`
- Supported modes: `uniform`, `multi`, `wave`, and `random`.
- Use `autoPlay` only when the surrounding screen can tolerate constant motion.
- Use the `as` prop for semantic heading level instead of wrapping the component
  in a separate heading tag.
- Preserve the component's accessibility behavior; do not remove labels,
  focus/keyboard handling, or `aria-label` support.

Before using it in product UI, install or copy the Cult UI component and apply
the required Geist Pixel font setup from the Cult UI documentation. The current
layout already registers Geist Sans/Mono through `next/font/google`; pixel
variants must be added deliberately rather than approximated with arbitrary CSS
or local font hacks.

Wrong:

```tsx
<h1 className="animate-pulse tracking-widest [text-shadow:4px_4px_0_var(--primary)]">
  DOUB
</h1>
```

Correct:

```tsx
<PixelHeading as="h1" mode="wave" className="text-6xl">
  DOUB
</PixelHeading>
```

## Text And I18n

Use `next-intl` translations for visible UI text. Add keys to both
`frontend/i18n/messages/en-US/*.json` and
`frontend/i18n/messages/zh-CN/*.json`, and register new message namespaces in
`frontend/i18n/messages.ts` when needed.

Do not hard-code long UI copy in components. Product names, protocol labels,
model names, and data values may remain inline when they are not translatable
application text.

## Feature UI Examples

- `features/chat/components/app-chat-area.tsx` coordinates feature hooks and
  renders chat states.
- `features/files/components/app-files.tsx` renders the file manager around the
  `useFilesPage` hook.
- `features/settings/components/sections/settings-chat.tsx` uses shared
  settings layout components, switches, selects, dialogs, and toasts.
