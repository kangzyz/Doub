# Fix Semantic HTML Citations

## Goal

Fix remaining semantic HTML rendering failures in chat answers: approved `.grid` /
`.card` HTML fragments must not intermittently render as markdown code blocks, and
model-authored source/citation labels inside semantic HTML must remain clickable.

## What I Already Know

- A rendered answer can show the first `.card` correctly while a later sibling
  `<div class="card card-b">...</div>` appears inside a `markdown` code block.
- The reproduced content uses blank lines between `.grid` blocks and 4-space
  indentation for nested sibling cards.
- Source labels currently appear as `<span class="badge badge-g">来源</span>`,
  which is visual-only and not clickable.
- Previous fixes added semantic HTML class allowlisting, theme CSS, and a narrow
  normalizer for fenced semantic HTML and blank-line indentation failures.

## Requirements

- Normalize approved semantic HTML fragments so sibling `.grid` / `.card` blocks
  do not become indented markdown code blocks.
- Preserve ordinary source/demo code fences as code.
- Preserve sanitizer safety: no arbitrary HTML execution, no broad
  `dangerouslySetInnerHTML`, no executable tags.
- Ensure source/citation labels generated in semantic HTML are clickable when a
  citation URL is available.
- Update the backend prompt contract so models use real citation anchors instead
  of static source badges.

## Acceptance Criteria

- [ ] The supplied `.grid grid-2` sample renders every `.card` as DOM, not as
  `pre/code`.
- [ ] Static `<span class="badge badge-g">来源</span>` is no longer the prompted
  source citation pattern.
- [ ] Numeric or source citation anchors inside raw HTML continue to render
  through the existing citation link UI.
- [ ] Normal markdown/html code examples without approved semantic classes remain
  code blocks.
- [ ] Frontend lint/type-check/build and relevant backend tests pass.

## Definition of Done

- Implementation is scoped to chat markdown rendering and prompt contract.
- Specs capture the CommonMark/citation gotcha if new behavior is added.
- Local frontend/backend services remain on the existing ports.
- Changes are committed before task wrap-up.

## Out of Scope

- Rewriting old stored messages in the database.
- Adding a new citation storage format or API response field.
- Changing the visual theme system beyond what is needed for citations.

## Technical Notes

- Frontend renderer:
  `frontend/features/chat/components/markdown/streamdown-content.ts`
- Streamdown component/citation handling:
  `frontend/features/chat/components/markdown/streamdown-components.tsx`
- Streamdown sanitizer:
  `frontend/features/chat/components/markdown/streamdown-render.tsx`
- Backend HTML visual prompt:
  `backend/internal/application/conversation/system_prompt.go`
