# Cherry Theme Source Research

## Sources

* https://github.com/igeekbb/Cherry-Studio-Claude-theme
* https://github.com/boilcy/cherrycss
* Local cloned references:
  * `.tmp/Cherry-Studio-Claude-theme`
  * `.tmp/cherrycss`

## Cherry-Studio-Claude-theme

The repository is a small Cherry Studio custom CSS theme. It contains `Claude-theme.css` and a README. The theme uses Cherry Studio-specific globals and selectors:

* `:root` variables such as `--color-black-soft`, `--color-white-soft`, `--font-family`.
* `body[theme-mode="dark"]` and `body[theme-mode="light"]`.
* Cherry Studio DOM selectors such as `#content-container`, `#messages`, `.message-content-container`, `.message-user`, and `.inputbar-container`.
* Code styling via broad `code` and `pre code` selectors.

Useful ideas for DOUB:

* Warm Claude-like neutral palette with a soft coral code/accent color.
* Light/dark paired variable sets.
* Chat-message specific token names.

Not directly portable:

* Cherry Studio selectors do not match DOUB's Next.js/Tailwind DOM.
* Broad `p, span, div` color overrides would be too risky in DOUB.
* Remote/nonstandard fonts should not be added by default.

## CherryCSS

CherryCSS is a Cherry Studio theme library. The README positions it as a copy-and-use custom CSS library with preview cards and categorized themes. Its theme data model is:

* `Theme` entries with `id`, `name`, `description`, `lightPreviewUrl`, `darkPreviewUrl`, `css`, optional `colors`, optional `style`.
* `lib/themes/index.ts` merges Chinese-style and other themes, appending a shared `bugfixCss`.
* `lib/themes/themeUtils.ts` detects dominant colors from theme CSS.
* Theme files such as `lib/themes/others/claude.ts` and `lib/themes/chineseStyle/yanYu.ts` are long CSS strings using the same Cherry Studio `body[theme-mode]` and app DOM selectors.

Useful ideas for DOUB:

* Treat visual style as reusable presets backed by CSS variables.
* Keep theme metadata separate from CSS if DOUB later adds a theme gallery.
* The `yan-yu` palette maps well to the user's pasted "深烟雨/清雨" palette.

Not directly portable:

* The repository is a theme-gallery app, not a runtime dependency needed by DOUB.
* It is optimized for Cherry Studio's DOM and custom CSS setting, not DOUB's renderer.
* Its many app-shell rules would increase maintenance risk if copied directly.

## DOUB Mapping

Current DOUB state:

* Theme mode uses `.dark` on `document.documentElement`, plus `data-theme` for presets.
* Chat rendering uses Streamdown with an explicit raw HTML allowed-tags map.
* Existing HTML visual prompt currently tells models to use inline `style`, which conflicts with the new semantic-class contract.

Recommended mapping:

* Use Cherry theme sources only for palette and organization inspiration.
* Implement `.reply` semantic classes in `frontend/app/globals.css` with DOUB variables.
* Update `backend/internal/application/conversation/system_prompt.go` to the user-provided semantic mapping.
* Update `frontend/features/chat/components/markdown/streamdown-render.tsx` so approved classes survive on approved tags.

## Implementation Risks

* If arbitrary `className` is allowed from model output, the model can accidentally or intentionally apply Tailwind utility classes or app-global classes. Use a semantic class allowlist.
* If `style` remains broadly allowed, the prompt and renderer will disagree. The prompt should prohibit it; renderer may still need existing style support for backward compatibility and SVG/KaTeX, but `.reply` classes should not depend on it.
* Block-level raw HTML changes Markdown parsing boundaries. Prompt must tell the model to use real HTML tags inside `.reply`, not Markdown syntax inside raw HTML blocks.
