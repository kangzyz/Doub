# Integrate Cherry HTML Reply Theme

## Goal

Integrate Cherry Studio-inspired answer formatting into DOUB so assistant replies can use semantic HTML fragments for denser, more readable output. The model should emit only a constrained semantic HTML vocabulary, while DOUB owns all visual styling through global CSS and the existing Markdown/Streamdown renderer.

## What I Already Know

* The user wants to reference `github.com/igeekbb/Cherry-Studio-Claude-theme` and `github.com/boilcy/cherrycss`.
* The primary goal is output HTML optimization, not a wholesale Cherry Studio UI port.
* The desired prompt contract is: replies are semantic HTML fragments, usually wrapped by `<div class="reply">...</div>`, with only predefined classes used for meaning.
* The supplied contract forbids inline `style`, hard-coded colors, invented classes, `<br>`, and Markdown-only loose formatting. The only stated style exception is progress percentage via `style="--pct:75%"`.
* DOUB already has an HTML visual prompt feature:
  * Frontend toggle: `frontend/features/chat/hooks/use-visual-prompt.ts`.
  * Request field: `htmlVisualPrompt`.
  * Backend prompt injection: `backend/internal/application/conversation/system_prompt.go`.
* The current backend HTML visual prompt is the wrong shape for this task: it encourages inline `style` and explicitly forbids `class`, while the new requirement wants predefined classes and global CSS ownership.
* DOUB's Streamdown renderer already allows safe raw HTML tags and normalizes inline styles, but `className` is currently only allowed for a narrow subset of tags. The new `.reply`, `.grid`, `.card`, `.badge`, `.note`, etc. classes need explicit renderer support.
* The frontend global design system lives in `frontend/app/globals.css`, using `.dark`, `:root[data-theme="..."]`, and CSS variables rather than Cherry Studio's `body[theme-mode]`.
* The app already supports theme presets in `frontend/shared/components/theme-provider.tsx`; this task can style reply HTML with current DOUB variables instead of adding a full new app theme preset.

## Requirements

* Replace or revise the existing `htmlVisualPromptInstruction` so it instructs models to output semantic HTML fragments using the user-provided mapping.
* Keep the existing "visual layout prompt" toggle and request field behavior, but update its meaning from inline styled HTML to semantic `.reply` HTML.
* Add new DOUB app theme preset(s) inspired by the referenced Cherry Studio themes, wired through the existing theme preset system.
* MVP app theme presets are:
  * `claude`: warm neutral Claude-inspired palette from `Cherry-Studio-Claude-theme` / CherryCSS Claude.
  * `yan-yu`: misty rain / deep mist palette from CherryCSS `yan-yu` and the user's pasted "深烟雨/清雨" CSS.
* Add global CSS for the predefined `.reply` semantic vocabulary:
  * Core tags: headings, paragraphs, lists, definition lists, blockquotes, tables, details, inline emphasis, code, footnotes.
  * Layout classes: `.grid`, `.grid-2`, `.grid-3`, `.row`, `.col`, `.card`, `.pros-cons`, `.stats`, `.timeline`.
  * State classes: `.badge`, `.tags`, `.tag`, `.checklist`, `.done`, `.pending`, `.note`, `.warn`, `.tip`.
  * Advanced classes from the supplied mapping where practical: `.tldr`, `.pullquote`, `.formula`, `.filetree`, `.terminal`, `.dialog`, `.flow`, `.progress`.
* Theme reply CSS through existing DOUB variables (`--background`, `--card`, `--foreground`, `--primary`, `--muted`, `--border`, etc.) so it works across current light/dark modes and theme presets.
* Semantic HTML reply styling must be dynamic across all existing and new DOUB theme presets:
  * Existing historical presets (`default`, `azure`, `cobalt`, `graphite`, `lagoon`, `ink`, `ochre`, `sepia`) must also style `.reply` output correctly.
  * Switching theme preset or light/dark mode must update already-rendered historical assistant HTML replies without regenerating messages.
  * `.reply` CSS must be token-driven and avoid fixed theme-specific colors except inside theme variable definitions.
* Extend the HTML renderer allowlist so the approved semantic classes can pass through on the tags that need them.
* Prefer a known-class allowlist over unrestricted model-provided classes.
* Preserve existing Mermaid, code block, KaTeX, image, citation, and external link behavior.
* Add new preset labels and preview palettes to the appearance settings UI and account preference serialization.
* Add focused tests for prompt content and, where practical, class allowlist behavior.

## Acceptance Criteria

* [ ] Enabling the visual layout prompt sends instructions that mention `.reply`, predefined semantic classes, no inline `style`, and CSS-owned visuals.
* [ ] The old inline-style-oriented prompt guidance is removed or no longer used for this mode.
* [ ] `claude` and `yan-yu` appear in Settings > Appearance and persist across reload/account preference sync.
* [ ] `claude` and `yan-yu` define both light and dark CSS variable sets.
* [ ] `.reply` semantic HTML adapts when switching among existing presets and the new presets.
* [ ] `.reply` semantic HTML adapts when toggling light/dark/system mode, including already-rendered historical messages.
* [ ] Assistant output containing `<div class="reply"><div class="grid grid-2"><div class="card card-b">...</div></div></div>` renders with the intended class names preserved.
* [ ] Invented or unsafe class names are not relied on and, if sanitized in renderer code, are filtered out.
* [ ] The global CSS covers the supplied high-frequency mapping and remains responsive on narrow viewports.
* [ ] Existing Markdown/code/Mermaid rendering still works.
* [ ] Relevant frontend type/lint checks and backend Go tests for changed packages pass.

## Definition Of Done

* Tests added or updated where behavior changes.
* Frontend lint/type-check and targeted backend tests pass, or failures are documented.
* Research notes are persisted under this task.
* Implementation stays scoped to chat rendering, global reply CSS, and prompt injection.
* No direct copy of Cherry Studio DOM-specific selectors is shipped into DOUB unless adapted to DOUB's DOM and variables.

## Out Of Scope

* Building a full CherryCSS theme marketplace inside DOUB.
* Adding live custom CSS editing or a CherryCSS marketplace.
* Porting Cherry Studio application chrome selectors such as `#content-container`, `.inputbar-container`, `.message-content-container`, or `body[theme-mode]` directly.
* Adding remote font downloads.
* Changing model routing, conversation persistence schema, or admin settings unrelated to the existing visual prompt.

## Technical Approach

Selected scope: add two app theme presets (`claude`, `yan-yu`) as well as reply HTML optimization. Reuse the existing visual prompt toggle and request field; change the backend prompt to the semantic `.reply` contract; add DOUB-native global CSS for reply classes; update Streamdown HTML allowlists to pass only approved semantic classes; wire the two Cherry-inspired presets into DOUB's existing theme provider, appearance preferences, settings UI preview cards, and i18n labels. Reply HTML styling must be based on theme-level CSS variables so old and new theme presets, light mode, dark mode, and already-rendered historical messages all update on theme switch.

## Decision Candidates

**Approach A: Reply-only Semantic HTML Theme (Recommended)**

* How: prompt + renderer allowlist + global CSS only.
* Pros: directly matches the user's "only format mapping, CSS owns chat style" requirement; low blast radius.
* Cons: does not add a full app theme selector for Cherry/Claude/烟雨 palettes.

**Approach B: Add App Theme Presets Too**

* How: add DOUB theme presets inspired by Claude/烟雨 and also add reply HTML CSS.
* Pros: broader visual integration.
* Cons: more files, settings UI and i18n changes, higher risk, less directly tied to output HTML optimization.
* Decision: selected by user.

**Approach C: Custom CSS Import/Editor**

* How: build CherryCSS-like custom CSS management.
* Pros: flexible for many themes.
* Cons: significantly larger product feature and security surface; out of scope for the stated output-format goal.

## Research References

* [research/cherry-theme-sources.md](research/cherry-theme-sources.md) - Summary of the two referenced Cherry Studio theme sources and how their patterns map to DOUB.

## Technical Notes

* `backend/internal/application/conversation/system_prompt.go` currently contains the prompt contract to revise.
* `backend/internal/application/conversation/system_prompt_test.go` already tests the HTML visual prompt branch.
* `frontend/features/chat/components/markdown/streamdown-render.tsx` controls allowed raw HTML tags and component normalization.
* `frontend/app/globals.css` is the natural place for global `.reply` styles because the frontend already centralizes tokens there.
* `frontend/shared/components/theme-provider.tsx` owns the `ThemePreset` union, preset normalization, and available preset list.
* `frontend/features/settings/utils/appearance-preferences.ts` validates persisted preset values for account sync.
* `frontend/features/settings/components/sections/settings-general.tsx` owns theme preview cards and labels.
* `frontend/i18n/messages/*/settings.json` and `frontend/i18n/messages/*/guide.json` contain visible preset labels.
* `.reply` styles should define semantic reply tokens such as `--reply-card`, `--reply-fg`, `--reply-muted`, and `--reply-accent-*` from existing DOUB variables. Theme-specific overrides should only redefine these tokens through `:root[data-theme="..."]` / `.dark[data-theme="..."]`, not through message-local classes or inline style.
* User-supplied pasted CSS already sketches a dark "烟雨" palette and a semantic `.reply` class system; the implementation should adapt the semantic class system to DOUB variables rather than hard-code that palette globally.

## Confirmed Decisions

* MVP theme presets: `claude` and `yan-yu`.
* `.reply` output is theme-live: historical HTML messages inherit the currently active DOUB preset and color mode.
