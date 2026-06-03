# DOUB site

Marketing landing for **DOUB AI** / **DOUB Chat**, built with Next.js (App Router) and Tailwind v4. The "Aurora Minimal" design system — a deep near-black canvas with indigo→violet→cyan accents, Geist Sans/Mono type, and restrained motion — lives in `app/globals.css`.

## Layout

```
site/
  app/
    layout.tsx       Root layout, Geist Sans + Mono, pre-paint theme script
    page.tsx         English homepage at /
    en/page.tsx      English homepage at /en
    zh/page.tsx      Chinese homepage at /zh
    theme-provider.tsx
    globals.css      Tailwind v4 — Aurora Minimal tokens + utilities
  components/
    landing.tsx      Hero / Providers / Product / Principles / Connect
    site-header.tsx  Floating glass nav with theme + locale switch
    chat-preview.tsx Faux DOUB Chat product window used in the hero
  lib/cn.ts          clsx + tailwind-merge helper
  public/
    logo/ og/ doub-adaptive-favicon.ico
```

## Develop

```
cd site
pnpm install
pnpm dev            # http://localhost:3000
```

## Static export

```
pnpm build
# Output: site/out/
```

`next.config.mjs` sets `output: "export"` and `trailingSlash: true`, so `/en/`, `/zh/` and `/` all generate as plain `index.html` files.
