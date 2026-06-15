# Native Tools Default Integration

## Context

The chat runtime already lets model capabilities declare provider-native tools
such as OpenAI `web_search` and Gemini `google_search`. In practice, users still
received "cannot access the internet" answers because model default options and
cached reasoning options were normalized down to only reasoning fields, dropping
`tools`.

Provider-native tools should behave like official model capabilities, not like
manual reasoning controls. Users should not need to open the reasoning/model
configuration dropdown to enable web search for ordinary chat.

## Goals

- Preserve default-enabled native tool payloads when initializing chat options,
  including when an older local cache only contains reasoning settings.
- Keep provider-native tools out of the reasoning/model configuration dropdown.
- Keep ordinary parameter controls and reasoning modes working.
- Align OpenAI Responses web search with the current `web_search` tool shape.
- Align Gemini search grounding with the current `google_search` tool shape.
- Keep backend model option policy authoritative for which provider-native tool
  payloads are allowed through.

## Non-Goals

- Do not add a new user-facing web-search toggle in the composer.
- Do not change MCP tool selection behavior.
- Do not change route, auth, persistence, or public HTTP response contracts.
- Do not force every response to search; provider docs still allow the model to
  decide when a search is useful unless an upstream-specific forced tool choice
  is explicitly configured elsewhere.

## Acceptance Criteria

- A model capability with default-enabled OpenAI `web_search` keeps
  `options.tools` through chat option initialization and reasoning normalization.
- Existing cached options like `{ "reasoning": { "effort": "high" } }` no
  longer suppress default-enabled native tools for the selected model.
- The reasoning/model configuration dropdown no longer lists native tool
  checkboxes or labels.
- Backend filtering allows Gemini `google_search` for `gemini_generate_content`
  and `google_image_generation` while still sanitizing the payload.
- Focused frontend lint and backend tests pass or any unrelated failures are
  explicitly documented.

