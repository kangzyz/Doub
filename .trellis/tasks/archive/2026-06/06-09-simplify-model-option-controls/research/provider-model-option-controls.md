# Provider Model Option Controls Research

## Scope

Map official provider controls into simple UI presets for the current DOUB Chat model-options feature.

## Sources

- OpenAI Responses API reference: https://platform.openai.com/docs/api-reference/responses/create?api-mode=responses
- OpenAI reasoning guide/latest model guide: https://platform.openai.com/docs/guides/reasoning and https://platform.openai.com/docs/guides/latest-model
- Anthropic extended thinking: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- Anthropic adaptive thinking: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking
- Anthropic effort: https://platform.claude.com/docs/en/build-with-claude/effort
- Google Gemini thinking: https://ai.google.dev/gemini-api/docs/thinking
- Google Gemini generateContent API reference: https://ai.google.dev/api/generate-content
- xAI reasoning: https://docs.x.ai/developers/model-capabilities/text/reasoning
- OpenRouter reasoning tokens: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
- OpenRouter API parameters: https://openrouter.ai/docs/api-reference/parameters

## Findings

### OpenAI

- Responses API exposes `reasoning.effort` for GPT-5 and o-series reasoning models.
- Supported effort values include `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`, but support varies by model family.
- GPT-5.2 guidance says `reasoning.effort` controls reasoning tokens, and `text.verbosity` supports `low`, `medium`, and `high`.
- The app already supports `reasoning.effort`, `reasoning.summary`, `text.verbosity`, `reasoning_effort`, and `verbosity` through adapters and policy.

### Anthropic

- Claude exposes multiple thinking modes depending on model generation.
- Claude Mythos Preview uses adaptive thinking by default; the UI should allow `output_config.effort` intensity but should not expose an explicit off mode for it.
- Claude Opus 4.8 and 4.7 require adaptive thinking: `thinking: { "type": "adaptive" }`; manual `budget_tokens` is rejected.
- Claude Opus/Sonnet 4.6 recommend adaptive thinking plus `effort`; manual `budget_tokens` still works but is deprecated.
- Claude 4.5 and older supported thinking models should stay on the manual `thinking.budget_tokens` mapping rather than adaptive effort.
- Older supported Claude models use manual thinking: `thinking: { "type": "enabled", "budget_tokens": N }`.
- Anthropic `effort` values include `low`, `medium`, `high`, `xhigh`, and `max`, with model-specific availability.
- `display: "omitted"` can reduce time to first text token while preserving thinking signatures; summaries are not free because billing still counts full thinking tokens.
- The app currently maps Anthropic `enable_thinking`, `thinking`, `budget_tokens`, `thinking_display`, `effort`, and `output_config.effort`.

### Google Gemini

- Gemini thinking controls live in `generationConfig.thinkingConfig`.
- Gemini 2.5 uses `thinkingBudget`: `0` disables thinking for models that allow it, `-1` enables dynamic thinking, positive budgets request a token budget.
- Gemini 2.5 Pro cannot disable thinking with `thinkingBudget=0`, so the UI must hide Off for that model family.
- Gemini 3 recommends `thinkingLevel` instead of budget, with enum values including `LOW` and `HIGH`.
- `includeThoughts` asks the API to include thoughts when available.
- The app already supports `generationConfig.thinkingConfig.includeThoughts`, `thinkingBudget`, and `thinkingLevel`.

### xAI

- xAI `grok-4.3` supports `reasoning.effort` values `none`, `low`, `medium`, and `high`; default is `low`.
- `none` disables reasoning. `low`, `medium`, and `high` trade latency/cost for depth.
- xAI warns that `presencePenalty`, `frequencyPenalty`, and `stop` cannot be used with reasoning models.
- `grok-4.20-multi-agent` uses `reasoning.effort` for agent count rather than ordinary reasoning depth, with `low`, `medium`, `high`, and `xhigh`.
- The app already supports `reasoning.effort` for `xai_responses`.

### OpenRouter

- OpenRouter is a vendor/compatible upstream in this app, not a dedicated backend adapter.
- Current backend protocols are still the adapter source of truth. OpenRouter routes usually use OpenAI-compatible request shapes through `openai_chat_completions` or `openai_responses`.
- OpenRouter documents a unified `reasoning` configuration object for reasoning-capable models.
- Supported OpenRouter `reasoning` fields include:
  - `effort`: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`
  - `max_tokens`: explicit reasoning-token budget
  - `exclude`: use reasoning but omit reasoning tokens from the response
  - `enabled`: enable default reasoning behavior, inferred from `effort` or `max_tokens`
- OpenRouter routes many underlying model families, so the UI should combine vendor/protocol/model-family checks rather than treating every OpenRouter model as having identical reasoning support.

## Proposed Normalized UI Controls

### Reasoning / Thinking

- A single menu/selector with these states:
  - Default: write no explicit reasoning option; rely on model/backend/provider defaults.
  - Off: disable or minimize reasoning where the provider supports it.
  - Float: low-intensity reasoning.
  - Consider: medium-intensity reasoning.
  - Deep: high-intensity reasoning.
  - Exhaustive: ultra-high reasoning where supported.

Suggested provider mapping:

| Provider/protocol | Off | Fast | Balanced | Deep | Max |
| --- | --- | --- | --- | --- | --- |
| OpenAI Responses | `reasoning.effort=none` when model supports it, otherwise remove reasoning | `low` or `minimal` | `medium` | `high` | `xhigh` only if policy/model allows |
| OpenAI Chat Completions | `thinking=false` or omit reasoning | `reasoning_effort=low` | `reasoning_effort=medium` | `reasoning_effort=high` | no default max unless model metadata says supported |
| Anthropic newer Claude | omit `thinking` | `thinking.type=adaptive`, `effort=low` | `adaptive`, `effort=medium` | `adaptive`, `effort=high` | `adaptive`, `effort=max` or `xhigh` only for supported model classes |
| Anthropic older Claude | omit `thinking` | `thinking.type=enabled`, low budget | enabled, medium budget | enabled, high budget | enabled, high budget with larger `max_tokens`; avoid unsupported `max` effort |
| Gemini 2.5 | `thinkingBudget=0` when model allows | `thinkingBudget=1024` | `thinkingBudget=-1` | larger positive budget | largest conservative positive budget |
| Gemini 3 | omit/low as provider default | `thinkingLevel=LOW` | default/high | `thinkingLevel=HIGH` | no separate max |
| xAI Responses | `reasoning.effort=none` | `low` | `medium` | `high` | `xhigh` only for multi-agent models |
| OpenRouter-compatible | `reasoning.effort=none` where supported | `minimal` or `low` | `medium` | `high` | `xhigh` where supported |

Output verbosity and sampling/creativity controls are intentionally excluded from the MVP.

## Repo Constraints

- Frontend entry point: `frontend/features/chat/components/sections/chat-model-config.tsx`.
- Current JSON editor already has a visual column, but it only reflects existing JSON fields. It does not present provider-aware preset controls when the JSON is empty.
- Options are stored per platform model in browser `localStorage`.
- Backend filters options by `chat.model_option_policy_mode` and allowed/denied paths before adapters receive them.
- Existing policy defaults already allow many common paths, but the default allowlist may need additions for `thinkingConfig.*`, `reasoning.effort`, `text.verbosity`, and provider-specific paths.
- The app's visible vendor list includes OpenAI, Anthropic, Google, xAI, and OpenRouter, while backend transport support is protocol-based. Reasoning support should be resolved from protocol first, then vendor/model family metadata as a refinement.

## Feasible Approaches

### Approach A: Provider-Aware Preset Layer (Recommended)

Add a normalization utility that derives controls from selected protocol/vendor/model name and writes provider-specific reasoning presets into the existing options object. Remove the chat composer JSON editor from the user-facing flow.

Pros:
- Fastest path to a friendly UI.
- Low backend risk because it still emits the existing `options` JSON.
- Preserves admin policy filtering.

Cons:
- Needs careful provider/model-name heuristics for Claude/Gemini version differences.
- Removes ad hoc per-request advanced overrides from the chat composer.

### Approach B: Admin-Configurable Control Schemas

Store control definitions in model `capabilitiesJSON`, allowing admins to define exact buttons per platform model.

Pros:
- Precise per deployment and per model.
- Avoids hardcoding every provider nuance.

Cons:
- More admin burden.
- Users still depend on admins to configure good defaults.

### Approach C: Backend-Normalized Model Options API

Expose an API that returns supported normalized controls and applies normalized selections server-side.

Pros:
- Central source of truth and easier future policy checks.
- Better for multi-client parity.

Cons:
- Larger cross-layer change.
- Requires new DTO/API contracts and more testing.

## Recommendation

Start with Approach A plus a small metadata escape hatch: use provider/protocol defaults first, then allow `capabilitiesJSON.modelOptionControls` to override or disable specific reasoning controls later. This keeps the MVP simple while leaving room for model-specific precision.
