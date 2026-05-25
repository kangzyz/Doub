const BANNER = String.raw`
 ____   ___  _   _ ____     ____ _   _    _  _____
|  _ \ / _ \| | | | __ )   / ___| | | |  / \|_   _|
| | | | | | | | | |  _ \  | |   | |_| | / _ \ | |
| |_| | |_| | |_| | |_) | | |___|  _  |/ ___ \| |
|____/ \___/ \___/|____/   \____|_| |_/_/   \_\_|
`;

const BANNER_SCRIPT = `
(() => {
  const key = "__DOUB_CHAT_DEVTOOLS_BANNER__";
  if (globalThis[key]) return;
  globalThis[key] = true;
  const banner = ${JSON.stringify(BANNER)};
  console.log("%c" + banner, "color:#111827;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700;line-height:1.15");
  console.log(
    "%c  %c  %c  %c  %c  %c  %c  %c  ",
    "background:#000000",
    "background:#111111",
    "background:#262626",
    "background:#404040",
    "background:#737373",
    "background:#a3a3a3",
    "background:#d4d4d4",
    "background:transparent"
  );
  console.log("%cOfficial: https://kang.vexown.com  |  Repository: https://github.com/kangzyz/Doub  |  License: Apache License 2.0", "color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace");
})();
`;

export function DevtoolsBrandBanner() {
  return (
    <script
      id="doub-devtools-brand"
      dangerouslySetInnerHTML={{ __html: BANNER_SCRIPT }}
    />
  );
}
