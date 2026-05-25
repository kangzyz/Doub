const fs = require("node:fs");
const path = require("node:path");

const targetUrl = "https://doub.vexown.com";
const distDir = path.join(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

fs.mkdirSync(distDir, { recursive: true });

fs.writeFileSync(
  indexPath,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
    <title>DOUB</title>
    <script>
      window.location.replace(${JSON.stringify(targetUrl)});
    </script>
  </head>
  <body>
    <p>Opening <a href="${targetUrl}">DOUB</a>...</p>
  </body>
</html>
`,
  "utf8",
);

console.log(`Wrote ${path.relative(process.cwd(), indexPath)} -> ${targetUrl}`);
