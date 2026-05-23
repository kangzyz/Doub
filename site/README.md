# DOUB site

Marketing landing for **DOUB AI** / **DOUB Chat**, built with Next.js (App Router) and Tailwind v4. Visual tokens (colors, radius, fonts) are aligned with the main `frontend/` workspace so future shared UI work stays in step.

## Layout

```
site/
  app/
    layout.tsx       Root layout, Geist + Instrument Serif fonts
    page.tsx         English homepage at /
    en/page.tsx      English homepage at /en
    zh/page.tsx      Chinese homepage at /zh
    theme-provider.tsx
    globals.css      Tailwind v4 with shared DOUB tokens
  components/
    landing.tsx      Hero / Products / Connect sections
    site-header.tsx  Fixed top bar with theme + locale switch
    text-animate.tsx Cult-ui inspired motion text (calmInUp / shiftInUp / rollIn / …)
  lib/cn.ts          clsx + tailwind-merge helper
  public/
    logo/ og/ favicon.ico
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
