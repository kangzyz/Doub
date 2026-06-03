import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_URL = process.env.DOUB_WEB_URL || 'https://doub.chat';
const DIST_DIR = 'dist';
mkdirSync(DIST_DIR, { recursive: true });

const FAVICON_FILENAME = 'doub-adaptive-favicon.ico';

// Portable: resolve relative to this script (repo-root/frontend/public/doub-adaptive-favicon.ico),
// overridable via DOUB_FAVICON. Guarded below, so a missing file is harmless.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const faviconSource = process.env.DOUB_FAVICON || join(scriptDir, '..', '..', 'frontend', 'public', FAVICON_FILENAME);
if (existsSync(faviconSource)) {
  copyFileSync(faviconSource, join(DIST_DIR, FAVICON_FILENAME));
}

writeFileSync(join(DIST_DIR, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="color-scheme" content="dark light">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0C0C10">
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FCFCFD">
    <link rel="icon" href="/${FAVICON_FILENAME}">
    <meta http-equiv="refresh" content="0;url=${TARGET_URL}">
    <title>DOUB</title>
    <style>
      :root { color-scheme: dark light; }
      html, body { height: 100%; margin: 0; }
      body {
        display: flex; align-items: center; justify-content: center;
        background: #0C0C10; color: #F5F5F7;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      @media (prefers-color-scheme: light) {
        body { background: #FCFCFD; color: #18181B; }
      }
      .wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }
      .mark { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
      .dot {
        width: 7px; height: 7px; border-radius: 999px;
        background: #6C5CFF; box-shadow: 0 0 16px 2px rgba(108,92,255,0.6);
        animation: pulse 1.1s ease-in-out infinite;
      }
      @keyframes pulse { 0%,100% { opacity: .35; transform: scale(.85);} 50% { opacity: 1; transform: scale(1);} }
      a { color: inherit; }
      @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
    </style>
    <script>window.location.replace(${JSON.stringify(TARGET_URL)});</script>
  </head>
  <body>
    <div class="wrap">
      <div class="mark">DOUB</div>
      <div class="dot" aria-hidden="true"></div>
      <noscript><a href="${TARGET_URL}">打开 DOUB</a></noscript>
    </div>
  </body>
</html>
`, 'utf8');
console.log(JSON.stringify({ targetUrl: TARGET_URL, favicon: existsSync(faviconSource) }, null, 2));
