# Official Native Tool Notes

## OpenAI Responses Web Search

- Source: https://developers.openai.com/api/docs/guides/tools-web-search
- Current Responses API integrations should use the hosted `web_search` tool.
- `web_search_preview` is still accepted for legacy integrations, but the docs
  recommend migrating to `web_search`.
- A normal Responses request declares the tool in `tools`, for example
  `{ "type": "web_search" }`.
- With `tool_choice: "auto"`, search is optional; the model can decide whether
  a web search is needed for the prompt.

## Gemini Google Search Grounding

- Source: https://ai.google.dev/gemini-api/docs/google-search
- The REST tool shape is `{ "google_search": {} }` in the request `tools`
  array.
- When `google_search` is enabled, Gemini handles prompt analysis, search query
  generation, result processing, final answer generation, and grounding metadata
  automatically.
- The model can decide whether Google Search can improve the answer and execute
  one or more search queries when needed.

