const fs = require("node:fs");
const path = require("node:path");

const targetUrl = "https://doub.chat";
const distDir = path.join(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

fs.mkdirSync(distDir, { recursive: true });

// Branded, on-brand dark loading stub. With server.url set this is rarely shown,
// but when it is (cold cache / offline-then-online), it must not flash white.
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="color-scheme" content="dark light">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0C0C10">
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FCFCFD">
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
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
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </head>
  <body>
    <div class="wrap">
      <div class="mark">DOUB</div>
      <div class="dot" aria-hidden="true"></div>
      <noscript><a href="${targetUrl}">Open DOUB</a></noscript>
    </div>
  </body>
</html>
`;

fs.writeFileSync(indexPath, html, "utf8");

console.log(`Wrote ${path.relative(process.cwd(), indexPath)} -> ${targetUrl}`);
