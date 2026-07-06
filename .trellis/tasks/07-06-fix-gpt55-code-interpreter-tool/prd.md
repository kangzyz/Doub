# Fix GPT-5.5 Unsupported Code Interpreter Tool

## Goal

Prevent ordinary GPT-5.5 chat requests from failing with HTTP 400 `Unsupported tool type: code_interpreter` when the selected OpenAI Responses-compatible upstream does not support the hosted code interpreter tool.

## What I Already Know

* The reported upstream error body is `{"detail":"Unsupported tool type: code_interpreter"}`.
* The backend currently auto-injects daily chat native tools for `openai_responses`.
* Before this fix, `openai_responses` daily defaults included `web_search`, `image_generation`, and `code_interpreter`.
* The service already has a fallback path that detects unsupported native tool errors, removes the named tool from `GenerateInput.Options.tools`, and retries.
* `code_interpreter` is marked high risk and is not required for normal text/image/search chat behavior.

## Requirements

* Do not automatically attach OpenAI `code_interpreter` to ordinary `openai_responses` chat requests.
* Preserve the catalog entry and sanitizer for explicit `code_interpreter` use where an upstream supports it.
* Keep existing unsupported-native-tool retry behavior intact.
* Update focused tests that lock the OpenAI daily default tool set.

## Acceptance Criteria

* [x] Filtering nil/default options for `openai_responses` no longer produces `code_interpreter`.
* [x] Explicit `code_interpreter` in `options.tools` can still pass policy when allowed.
* [x] Existing unsupported-tool detection/removal tests still pass.
* [x] Relevant Go package tests pass.

## Definition of Done

* Tests added or updated for the changed behavior.
* Narrow backend verification run completed.
* No unrelated dirty worktree changes reverted or included.

## Technical Approach

Remove `code_interpreter` from the OpenAI Responses daily chat default set in `backend/internal/shared/nativetool/catalog.go`. Keep the OpenAI native tool definition, policy allowlist, and sanitizer unchanged so admins or model capabilities can still opt into it explicitly.

## Decision (ADR-lite)

**Context**: GPT-5.5-compatible upstreams can reject `code_interpreter`, and default auto-injection makes every normal chat request vulnerable to a 400.

**Decision**: Treat hosted code interpreter as explicit opt-in rather than a daily chat default.

**Consequences**: Default chat becomes more compatible. Users who need code interpreter must enable it through model capabilities/options for upstreams that actually support it.

## Out of Scope

* Removing `code_interpreter` from the global allowed-tool configuration.
* Implementing per-model live capability probing for OpenAI native tools.
* Changing frontend native tool controls beyond what backend tests require.

## Technical Notes

* Relevant files inspected:
  * `backend/internal/shared/nativetool/catalog.go`
  * `backend/internal/application/conversation/model_option_policy.go`
  * `backend/internal/application/conversation/model_option_policy_test.go`
  * `backend/internal/application/conversation/service_helpers.go`
  * `backend/internal/application/conversation/service_stream_fallback_test.go`
  * `backend/internal/infra/config/config.go`
* Relevant specs:
  * `.trellis/spec/backend/index.md`
  * `.trellis/spec/backend/ai-and-conversation.md`
  * `.trellis/spec/backend/quality-guidelines.md`
  * `.trellis/spec/shared/code-quality.md`
