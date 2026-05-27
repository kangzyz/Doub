# Allow Limited Inline HTML Rendering

## Goal

Let DOUB render AI-generated inline HTML visual layouts inside chat answers, so prompts that ask for compact visual cards, side-by-side comparisons, flow-like layouts, and dense information grouping can display better than plain Markdown.

## What I Already Know

- The user wants to open "some" inline HTML rendering support and is currently the only user of this web deployment.
- The desired use case is visual/layout HTML with inline CSS, not full arbitrary web app execution.
- DOUB chat rendering currently uses `StreamdownRender` in `frontend/features/chat/components/markdown/streamdown-render.tsx`.
- `streamdown` already supports raw HTML internally but sanitizes output. Default sanitization strips useful inline layout CSS such as `style`.
- Cherry Studio's inline message path uses `react-markdown + rehype-raw`, allows broad visual tags, and blocks `iframe` / `script`.
- Cherry Studio's full HTML artifact path uses fenced `html` code blocks and iframe preview; this is more than the requested MVP.

## Requirements

- Allow inline HTML visual/layout snippets in chat Markdown rendering.
- Preserve inline `style` for approved visual/layout tags.
- Include common visual tags: `div`, `span`, `p`, `section`, `article`, `details`, `summary`, list tags, table tags, headings, inline emphasis tags, and safe SVG primitives if supported by Streamdown's sanitizer.
- Continue blocking executable or app-embedding tags by not adding them to the allowed schema: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `form`, `input`, `button`, `textarea`, `select`.
- Keep the change scoped to rendering. Do not change backend message storage or model prompting in this task.
- Keep Markdown, code, math, Mermaid, image, and link behavior working as before.
- Apply the relaxed inline HTML policy to both private chat rendering and public/shared conversation rendering.

## Acceptance Criteria

- [ ] A message containing `<div style="display:flex; gap:8px"><span style="border:1px solid #ddd">A</span><span>B</span></div>` renders as a visible horizontal layout instead of losing all style.
- [ ] A message containing `<details><summary>更多</summary><div style="padding:8px">内容</div></details>` renders as a native collapsible block.
- [ ] `script` and `iframe` tags are not rendered as executable/embedded content.
- [ ] Existing Markdown features still render: code blocks, tables, links, images, Mermaid, and math.
- [ ] Shared/public conversation pages render the same allowed inline HTML visual layout as the private chat page.
- [ ] Frontend lint passes.

## Definition Of Done

- Relevant frontend specs are read before implementation.
- Implementation is narrowly scoped to chat Markdown rendering.
- Lint/type quality checks are run as appropriate.
- Any meaningful security boundary or rendering convention learned during implementation is considered for `.trellis/spec/` update.

## Technical Approach

Use Streamdown's built-in `allowedTags` prop to extend the sanitizer for a small set of visual HTML tags and attributes. This keeps the existing `raw + sanitize + harden` pipeline instead of bypassing it.

The first implementation should avoid `dangerouslySetInnerHTML` and avoid iframe/artifact rendering. It should add a single shared allowed-tags policy near `StreamdownRender` and pass it to Streamdown so all call sites, including public share rendering, inherit the same controlled policy.

## Decision (ADR-lite)

**Context**: DOUB currently strips inline style from raw HTML because Streamdown's default sanitizer is conservative. The user wants richer visual layouts and accepts a looser boundary for a private deployment.

**Decision**: Relax Streamdown sanitization with a controlled visual HTML allowlist instead of fully disabling sanitization or adding full HTML artifact iframe support.

**Consequences**: AI output can influence more of the chat layout, including inline styles. Script execution and embedded iframes remain blocked. Full standalone HTML app preview remains out of scope and can be added later as an artifact feature.

## Out Of Scope

- Executing JavaScript from assistant messages.
- Rendering iframes or full HTML pages inline.
- Adding an HTML artifact/code-preview UI.
- Backend schema changes.
- Prompt-template changes.
- Admin/settings UI for toggling this behavior.

## Open Questions

- None.

## Research References

- [`research/cherry-studio-html-rendering.md`](research/cherry-studio-html-rendering.md) - Cherry Studio uses direct inline HTML for message snippets and iframe preview for full HTML artifacts.

## Technical Notes

- `frontend/features/chat/components/markdown/streamdown-render.tsx` owns the main `Streamdown` usage.
- `frontend/features/share/components/public-share-page.tsx` also renders messages through `StreamdownRender`; the user chose to enable the relaxed policy for share pages too.
- Frontend spec index: `.trellis/spec/frontend/index.md`.
