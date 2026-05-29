# Cherry Studio HTML Rendering Research

## Source

CherryHQ/cherry-studio main commit inspected: `8d93b382fc82ba819d45f1eb51211b670a315b58`.

Relevant files:

- `src/renderer/src/pages/home/Markdown/Markdown.tsx`
- `src/renderer/src/pages/home/Markdown/CodeBlock.tsx`
- `src/renderer/src/components/CodeBlockView/HtmlArtifactsCard.tsx`
- `src/renderer/src/components/CodeBlockView/HtmlArtifactsPopup.tsx`
- `src/renderer/src/components/MarkdownShadowDOMRenderer.tsx`

## Findings

Cherry Studio uses two different paths:

- Inline message HTML: `react-markdown` with `rehype-raw` is enabled only when the content matches a broad allowed-elements regex. It allows visual tags such as `style`, `div`, `span`, tables, SVG primitives, and `details` / `summary`. It disallows `iframe` and `script`.
- Full HTML artifacts: fenced `html` code blocks are intercepted in `CodeBlock.tsx` and rendered as `HtmlArtifactsCard`. Preview opens a modal with an iframe using `srcDoc={html}` and `sandbox="allow-scripts allow-same-origin allow-forms"`.
- `<style>` tags in inline Markdown are handled by `MarkdownShadowDOMRenderer`, which creates a shadow root and portals the style/component rendering into that root.

## Mapping To DOUB

DOUB currently renders chat content through `frontend/features/chat/components/markdown/streamdown-render.tsx` using `streamdown`.

Streamdown already has a raw HTML pipeline internally: `rehype-raw`, `rehype-sanitize`, and `rehype-harden`. The limiting factor is the default sanitize schema: inline `style` is not allowed by default, so generated visual HTML loses the layout styling.

## Recommended MVP

For DOUB's private-web use case, follow Cherry's product direction but keep a narrower safety boundary:

- Enable limited inline visual HTML in chat Markdown rendering by passing `allowedTags` to `Streamdown`.
- Allow common visual/layout tags and `style` attributes needed for inline CSS layout.
- Continue disallowing dangerous or app-breaking tags by not adding them to the allowed schema: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `form`, `input`, `button`, `textarea`, `select`.
- Do not implement full HTML artifact preview in this task.
- Decide whether shared/public conversation rendering should also enable the relaxed HTML policy.

## Risk Notes

Allowing `style` on AI-generated content can affect layout quality and visual consistency. It is less risky than allowing script execution, but still allows generated content to create oversized blocks, hidden text, aggressive positioning, or visual spoofing. The MVP should favor chat visual layout over arbitrary web page execution.
