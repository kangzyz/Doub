# Remove Empty Chat Prompts

## Goal

Remove the role prompt suggestions from the empty chat screen because the current presentation feels awkward, while keeping the empty chat composer clean and preserving suggestion behavior inside existing conversations.

## Requirements

* Empty chat should show the greeting and centered composer only.
* Empty-chat role prompt suggestion rows must no longer render below the composer.
* Clicking/sending normal user input from the empty chat composer must continue to work as before.
* Generated follow-up suggestions inside non-empty conversations must remain unchanged.
* Remove now-unused empty-chat suggestion state, types, and handlers from the affected frontend code.

## Acceptance Criteria

* [x] New empty chat state contains no role prompt suggestion rows or prompt buttons.
* [x] Empty chat greeting and composer layout still render normally.
* [x] No translation lookup for `chat.suggestions.empty.*` is needed by the empty chat screen.
* [x] Existing non-empty conversation suggestion behavior is not intentionally changed.
* [x] Frontend lint/type checks pass or any unrelated existing failures are documented.

## Definition of Done

* Focused frontend code is updated.
* Relevant Trellis/frontend guidelines are consulted before implementation.
* Quality checks are run for the touched frontend package where practical.

## Out of Scope

* Designing a replacement empty-state suggestion pattern.
* Removing generated follow-up suggestions from assistant replies.
* Removing localized suggestion strings unless they become actively harmful.
* Backend/API changes.

## Technical Notes

* Existing empty-chat prompt UI is wired through `frontend/features/chat/components/app-chat-area.tsx`.
* Empty-state rendering lives in `frontend/features/chat/components/sections/chat-empty.tsx`.
* Prior context exists in `.trellis/tasks/05-27-compact-chat-suggestions/prd.md`; this task intentionally supersedes only the static empty-chat prompt portion.
