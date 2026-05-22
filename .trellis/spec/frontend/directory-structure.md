# Frontend Directory Structure

The frontend is a Next.js 16 App Router application with React 19,
TypeScript, Tailwind CSS, shadcn/ui-style primitives, Radix/Base UI,
lucide-react icons, next-intl, Streamdown, KaTeX, Mermaid, Recharts, and Motion.

## Top-Level Folders

| Folder | Owns |
| --- | --- |
| `app/` | App Router routes and root layout only |
| `features/` | Domain UI, hooks, model helpers, context, and feature types |
| `components/ui/` | Reusable UI primitives and shadcn-style components |
| `components/animate-ui/`, `components/reactbits/` | Imported visual primitives used by feature UI |
| `shared/api/` | Backend API wrappers and DTO types |
| `shared/auth/` | Access token/session snapshot helpers and auth guards |
| `shared/components/` | Cross-feature product components |
| `shared/hooks/` | Cross-feature hooks |
| `shared/lib/` | Pure utilities and display helpers |
| `i18n/` | Locale config, provider, message loading, and JSON messages |
| `public/` | Static assets served by the static export/runtime |

## Route Files Stay Thin

Route pages under `app/` should delegate to feature components. Example:
`frontend/app/(project)/chat/page.tsx` only wraps `AppChatArea` in `Suspense`.

The root layout in `frontend/app/layout.tsx` installs providers and shell
components: `AppI18nProvider`, `ThemeProvider`, `ChatFontProvider`,
`WorkspaceShell`, `Toaster`, optional `WebVitals`, and the devtools banner.

Do not put complex data loading, API calls, or workflow state directly in route
files.

## Feature Folder Shape

Use the existing domain shape:

```text
features/<domain>/
  components/
    sections/
    message/ or preview/ when useful
  hooks/
  model/
  types/
  utils/
  context/
```

Examples:

- `features/chat` owns the conversation workspace, composer, streaming hooks,
  message rendering, branch state, attachments, MCP tool selection, and trace UI.
- `features/files` owns file list/detail state, preview, extraction, upload,
  delete, rename, and RAG opt-out UI.
- `features/settings` owns user settings sections, settings hooks, profile
  helpers, and preferences.
- `features/admin` owns admin workflows and should not bleed into user-facing
  feature components.

## Static Export

`frontend/next.config.ts` uses `output: "export"` and `images.unoptimized`.
Do not add Next API routes, server actions, or runtime-only server features for
business APIs. The Go backend owns API behavior and can serve the exported
frontend from `server.frontend_dist_dir`.
