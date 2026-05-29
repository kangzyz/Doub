# Fix Perplexity Source Citation Links

## Goal

When an OpenAI Chat Completions compatible upstream returns citation sources in a custom top-level `sources` field, preserve those source URLs as internal citations so assistant answers that contain numeric markers such as `[1]` render as clickable citation links.

## What I Already Know

* The upstream Perplexity-compatible service returns `sources` at the response root for non-streaming `/v1/chat/completions` responses.
* In streaming mode, the same service returns root `sources` on the final `chat.completion.chunk`.
* The payload does not use OpenAI-standard `choices[0].message.annotations`, top-level `citations`, or `search_sources`.
* The app already rewrites numeric citation markers into Markdown reference links via `appendCitationReferenceDefinitions(content, citations)`, but that only works if upstream URLs land in `GenerateOutput.Citations`.
* `backend/internal/infra/llm/openai_responses.go` already has generic citation URL extraction for `citations`, `sources`, `urls`, and nested annotation-like structures.
* `backend/internal/infra/llm/openai_chat_completions.go` currently does not apply that extraction for Chat Completions responses or chunks.

## Requirements

* Parse top-level `sources` from non-streaming Chat Completions responses into `GenerateOutput.Citations`.
* Parse top-level `sources` from streaming Chat Completions chunks, including final chunks whose `delta` is empty and `finish_reason` is set.
* Reuse the existing generic citation extraction/deduplication behavior where possible.
* Keep existing text, reasoning, tool call, and usage parsing behavior unchanged.
* Preserve existing behavior for standard Chat Completions responses without `sources`.

## Acceptance Criteria

* [x] A non-streaming Chat Completions payload with root `sources: [{ "url": "https://example.com/a", "title": "A" }]` produces `GenerateOutput.Citations == ["https://example.com/a"]`.
* [x] A streaming final Chat Completions chunk with root `sources` appends those URLs to `GenerateOutput.Citations`.
* [x] Duplicate URLs are not repeated.
* [x] Existing backend LLM adapter tests pass.
* [x] Existing conversation citation rewriting continues to turn `[1]` into a clickable Markdown reference when citations are present.

## Definition of Done

* Focused backend tests cover non-streaming and streaming Chat Completions root `sources`.
* Relevant Go tests are run.
* No unrelated dirty files are modified.

## Technical Approach

Use the existing `parseResponseCitations` helper from the LLM package in the Chat Completions parser paths. Append extracted URLs to `result.Citations` in both `parseChatCompletionsOutput` and `applyChatStreamEvent`, using `appendUniqueStrings` to preserve deduplication.

## Decision (ADR-lite)

**Context**: The upstream is OpenAI-compatible but exposes Perplexity source URLs in a custom root `sources` field.

**Decision**: Normalize these URLs at the backend LLM adapter boundary into `GenerateOutput.Citations` instead of adding frontend-specific handling for raw upstream fields.

**Consequences**: The existing conversation rendering pipeline remains the single place that converts citation markers to clickable Markdown references. This also keeps future compatible upstreams with similar root citation fields working through the same parser.

## Out of Scope

* Changing the upstream Perplexity proxy output shape.
* Adding OpenAI `message.annotations` support to the proxy itself.
* Redesigning frontend Markdown citation rendering.
* Showing a separate source list when the assistant text does not contain numeric citation markers.

## Technical Notes

* Likely implementation file: `backend/internal/infra/llm/openai_chat_completions.go`.
* Likely tests: `backend/internal/infra/llm/request_tools_test.go`.
* Existing citation rewrite: `backend/internal/application/conversation/service_citations.go`.
