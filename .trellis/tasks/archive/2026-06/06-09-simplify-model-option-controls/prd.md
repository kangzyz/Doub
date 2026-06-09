# Simplify Model Option Controls

## Goal

Make model reasoning configuration usable without asking users to write JSON. The chat composer should expose a provider-aware thinking/reasoning mode selector with a default state, explicit off state, and multiple reasoning intensities.

## What I Already Know

- The current chat composer has a model configuration dialog in `frontend/features/chat/components/sections/chat-model-config.tsx` with a JSON editor and visual field list.
- Current options are plain `ConversationOptions = Record<string, unknown>` and are sent as `options` in message/media stream payloads.
- Options are cached per platform model in browser `localStorage` under `doub-chat:chat-model-options:<platformModelName>`.
- Frontend filters reserved keys such as `model`, `messages`, `input`, `system`, and `stream`.
- Backend filters options again through `filterModelOptions` using runtime settings `chat.model_option_policy_mode`, `chat.model_option_allowed_paths`, `chat.model_option_denied_paths`, and `chat.model_option_native_tool_types`.
- Platform model `capabilitiesJSON.defaultOptions` becomes the default options shown in the chat composer.
- Provider protocols already include OpenAI Responses/Chat Completions, Anthropic Messages, Gemini Generate Content, xAI Responses, and image protocols.
- The user explicitly requires coverage for all currently supported model vendor/protocol combinations, including OpenAI, Anthropic, Google, xAI, and OpenRouter.
- OpenRouter is represented as a vendor/compatible upstream, but current backend transport behavior remains protocol-based. OpenRouter model support must be resolved by protocol plus model family, not by vendor alone.

## Assumptions

- MVP targets chat/text model reasoning controls only.
- A provider-aware preset UI can still generate the same existing JSON options internally rather than introducing a new backend payload shape.
- Admin policy filtering remains the final enforcement layer.

## Open Questions

- None currently.

## Requirements

- Replace the current JSON model configuration dialog with a simple reasoning mode selector.
- Remove the JSON advanced editor from this user-facing chat composer flow.
- MVP covers text/chat models only.
- Do not expose output verbosity controls in this MVP.
- Do not expose creativity/randomness controls in this MVP.
- Controls must be provider/protocol aware.
- The resolver must consider every currently supported text protocol and visible vendor family:
  - OpenAI via `openai_responses` and `openai_chat_completions`
  - Anthropic via `anthropic_messages`
  - Google via `google_generate_content`
  - xAI via `xai_responses`
  - OpenRouter via OpenAI-compatible protocols plus model-family metadata/heuristics
- Unsupported reasoning modes must be hidden for the selected model/protocol rather than shown disabled or auto-downgraded.
- Unknown vendors, custom protocols, and models whose reasoning controls cannot be reliably resolved should show only Default.
- The user-facing interaction should follow the supplied reference: a compact menu anchored near the composer controls, not a large JSON configuration dialog.
- Reasoning/thinking controls should use these user-facing states:
  - Default: depend on model/default platform behavior and write no explicit reasoning option.
  - Off: disable reasoning/thinking where the provider supports an explicit off mode.
  - Float: low-intensity reasoning.
  - Consider: medium-intensity reasoning.
  - Deep: high-intensity reasoning.
  - Exhaustive: ultra-high-intensity reasoning where supported.
- Suggested Chinese labels are based on the supplied reference: 默认、关闭、浮想、斟酌、沉思、穷究.
- Generated options must continue to pass through existing sanitization and backend policy filtering.
- Visible UI text must be localized in zh-CN and en-US.

## Control Definitions

- Default: clear model-option overrides for reasoning. The backend and provider defaults decide behavior.
- Off: write the provider-specific option that disables or minimizes reasoning when supported; otherwise the UI should avoid promising a hard disable.
- Float / low: low-intensity reasoning for faster answers and lower reasoning-token use.
- Consider / medium: balanced reasoning for normal hard questions.
- Deep / high: high-intensity reasoning for complex tasks.
- Exhaustive / ultra: maximum or ultra-high reasoning mode where the provider documents support; otherwise it is hidden.

## Acceptance Criteria

- [x] For OpenAI Responses models, users can choose reasoning mode without editing JSON.
- [x] For Anthropic models, users can enable thinking and choose an effort/intensity mapping appropriate to the model family.
- [x] For Gemini models, users can choose thinking controls that map to `generationConfig.thinkingConfig`.
- [x] For xAI Responses models, users can choose `reasoning.effort` without editing JSON.
- [x] For OpenRouter models, users see reasoning modes only when the selected model/protocol combination can safely map them.
- [x] Unknown/custom vendors or unsupported text protocols fall back to Default only.
- [x] Chat composer no longer exposes the advanced JSON editor for model options.
- [x] Unsupported controls are hidden for the selected model/protocol.
- [x] Existing model option policy filtering remains respected.
- [x] Image generation/edit controls remain out of scope for this MVP.

## Definition of Done

- [x] Tests added/updated where logic is pure enough to test.
- [x] Frontend lint passes.
- [x] Backend tests/build only required if backend policy/API changes are introduced.
- [x] Docs/notes updated if behavior changes.
- [x] Rollback is straightforward because the generated payload still uses the existing `options` shape.

## Out of Scope

- Replacing backend option filtering.
- Persisting per-user option presets server-side.
- Building a full admin UI for custom control schemas in the first MVP.
- Guaranteeing exact model-family support without either provider docs or explicit `capabilitiesJSON` metadata.
- Image generation/edit controls such as size, aspect ratio, quality, and count.
- User-facing controls for output verbosity.
- User-facing controls for creativity/randomness.

## Research References

- [`research/provider-model-option-controls.md`](research/provider-model-option-controls.md) - official provider control mapping and feasible approaches.

## Technical Approach

- Implement a frontend-only normalized reasoning-control layer for the first MVP.
- Replace the chat composer model-options JSON dialog with a compact reasoning mode selector.
- Store selected reasoning mode per platform model using the existing model-options persistence path, but generate only provider-specific option JSON internally.
- Use selected protocol/vendor/model name to derive available modes and hide unsupported modes. Protocol is the primary routing signal; vendor/model-family metadata refines OpenRouter and OpenAI-compatible cases.
- Keep backend filtering unchanged; adjust default allowed option paths only if implementation reveals a needed reasoning path is currently filtered.

## Decision (ADR-lite)

**Context**: Raw JSON model options are powerful but not approachable for normal users. The requested first improvement is specifically about thinking/reasoning strength, not general model-parameter editing.

**Decision**: Ship a text-model-only reasoning mode selector with states Default, Off, Float, Consider, Deep, and Exhaustive. Cover all currently supported text vendor/protocol families, including OpenRouter through OpenAI-compatible protocol handling plus model-family refinement. Remove the user-facing JSON advanced editor from the chat composer. Hide unsupported modes instead of disabling or auto-downgrading them.

**Consequences**: The MVP is simpler and more predictable for end users. Advanced arbitrary option editing is no longer available from the chat composer, but the internal request format and backend policy remain unchanged, so implementation risk stays contained. Unknown/custom models are conservative: they keep Default only instead of exposing uncertain controls.

## Technical Notes

- Relevant frontend files:
  - `frontend/features/chat/components/sections/chat-model-config.tsx`
  - `frontend/features/chat/components/app-chat-area.tsx`
  - `frontend/features/chat/model/conversation-options.ts`
  - `frontend/shared/lib/model-option-policy.ts`
  - `frontend/i18n/messages/{zh-CN,en-US}/chat.json`
- Relevant backend files:
  - `backend/internal/application/conversation/model_option_policy.go`
  - `backend/internal/infra/config/config.go`
  - `backend/internal/infra/llm/openai_responses.go`
  - `backend/internal/infra/llm/openai_chat_completions.go`
  - `backend/internal/infra/llm/anthropic.go`
  - `backend/internal/infra/llm/gemini.go`
- Relevant specs:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/shared/index.md`
