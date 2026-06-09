# Fix Partial Semantic HTML Rendering

## Goal

Fix the message renderer so a reply containing multiple valid semantic HTML blocks renders all allowed blocks consistently instead of rendering the first block and showing later blocks as markdown/code preview.

## Requirements

* Render consecutive top-level semantic HTML blocks as one semantic HTML fragment when every block uses allowed tags/classes.
* Preserve existing safety rules: disallow inline styles except the existing progress `--pct` exception, scripts, event handlers, and unknown classes.
* Do not require the model to wrap every response in a single `.reply` root for the UI to render correctly; the renderer should normalize valid fragment sequences.
* Keep user-authored full HTML pages or fenced code blocks in the existing code/preview path.
* Keep source links, badges, cards, timeline items, and other existing semantic components clickable and styled after normalization.

## Acceptance Criteria

* [x] A response containing adjacent blocks such as `<div class="card card-g">...</div><div class="card card-o">...</div>` renders both cards, not only the first one.
* [x] A response containing `.timeline-item` blocks renders inside the semantic HTML surface instead of falling back to markdown/code.
* [x] A response containing raw `<pre><code class="language-mermaid">flowchart ...</code></pre>` inside `.reply` renders through the Mermaid path instead of remaining a code block.
* [x] Long horizontal Mermaid diagrams render at natural readable SVG width in a generous viewport instead of being compressed into a tiny thumbnail.
* [x] Mermaid nodes with long mixed Chinese/English labels keep the full label visible instead of clipping the final characters.
* [x] Mermaid diagrams default to a centered readable position and cannot be dragged infinitely outside the visible SVG extent.
* [x] Raw semantic `<pre class="filetree"><code>...</code></pre>` renders as a file tree instead of an empty markdown code block.
* [x] Raw semantic `<pre><code class="language-yaml">...</code></pre>` examples render with an actual code-block surface instead of unstyled loose text.
* [x] Ordinary fenced Markdown code blocks use the same formal bordered/sunken code-block surface as raw semantic code examples.
* [x] Existing allowed semantic classes still pass sanitization and styling.
* [x] Inline `style="margin-top:16px"` remains rejected or stripped, while `style="--pct:75%"` on progress remains allowed.
* [x] Frontend lint/build and relevant tests pass.

## Definition of Done

* Root cause identified in the frontend parsing/rendering path.
* Parser or renderer updated with focused tests.
* Browser or DOM-level verification covers the user's pasted fragment shape.
* Trellis spec updated if a reusable rendering rule is learned.

## Out of Scope

* Changing the visual theme palette.
* Adding new semantic classes.
* Changing backend model behavior beyond what is required for rendering correctness.
* Supporting arbitrary HTML outside the existing safe semantic subset.

## Technical Notes

* User screenshot shows the first rendered card beside a raw markdown/code panel containing later `<div class="card ...">` blocks.
* Root cause: semantic HTML already inside a closed or streaming `markdown`/`html` fence could fall through as a Streamdown code block, and bare all-HTML fragments without `.reply` did not reliably receive the semantic CSS contract.
* Additional root cause from raw logging: model output can include raw HTML code blocks such as `<pre><code class="language-mermaid">...</code></pre>`. Those blocks bypass Streamdown's fenced-Mermaid plugin and also caused the old indentation normalizer to skip the whole message because it saw `<pre>`, leaving 4-space indented semantic child tags vulnerable to CommonMark code-block parsing.
* Fix: `streamdown-content.ts` now unwraps closed and trailing unclosed semantic fences, preserves real source/demo fences, and wraps bare all-HTML semantic fragments in `.reply`.
* Fix: `streamdown-content.ts` now unwraps semantic HTML that was incorrectly emitted inside raw `markdown`/`html`/`text` `<pre><code>` blocks, converts raw Mermaid code blocks into fenced Mermaid blocks, and applies HTML tag indentation fixes outside raw `<pre>` content instead of skipping the entire message.
* Fix: `streamdown-render.tsx` now strips ordinary semantic HTML inline styles by default; only `.progress-bar` `--pct` and KaTeX renderer spans keep narrow style exceptions.
* Fix: Mermaid visual overrides now use a larger scrollable viewport and intrinsic SVG width instead of `max-h-[280px]` / `max-w-full`, and the Mermaid plugin sets `flowchart.useMaxWidth=false` so long flowcharts remain legible at initial render.
* Fix: Mermaid plugin config now uses HTML labels, CJK-friendly font settings, larger node/rank spacing, and wrapping width; renderer CSS also releases SVG/label overflow so tight text measurement no longer clips long labels.
* Fix: Inline Mermaid pan/zoom remains enabled in chat. The renderer guards pointer moves before they reach Streamdown's built-in pan handler, converting an out-of-range drag into a clamped synthetic move at the visible SVG boundary. It does not write back to the pan element's `style.transform`, because Streamdown stores pan offsets in React state and direct DOM transform edits desynchronize the next drag.
* Fix: `.filetree` and `.flow` raw semantic `<pre>` blocks bypass `CollapsibleCodePre` and keep their semantic CSS, preventing empty markdown code blocks when a file tree contains nested `<span>` nodes.
* Fix: global `.reply` CSS now styles ordinary raw `<pre><code>` blocks with border, sunken background, padding, and preserved whitespace, covering examples such as `data.yaml`.
* Fix: Streamdown fenced code blocks now add the same border, rounded corners, and sunken background on `data-streamdown='code-block-body'`.
* Fix: non-Mermaid `<pre><code class="language-*">` examples inside `.reply` now render through an explicit `data-streamdown='code-block'` / `data-streamdown='code-block-body'` structure. Relying on child component identity or only cloning `data-block="true"` is unstable because raw HTML code and Markdown code can arrive through different component paths.
* Fix: `CollapsibleCodePre` now extracts the single non-blank code child from children arrays and preserves the `<pre>` wrapper when extraction fails. Returning bare children dropped the pre surface when raw HTML parsing inserted whitespace nodes.
* Temporary diagnostic: backend can append raw HTML visual prompt responses to `DOUB_HTML_VISUAL_RAW_LOG` as JSONL, including streamed text, upstream text before citation rewriting, and assistant text after backend rewriting.
* Verification: `pnpm lint`, `pnpm build`, `git diff --check`, and in-memory normalization checks for raw Mermaid, raw semantic HTML code blocks, ordinary source code blocks, and indented cards with adjacent `<pre>` content.
