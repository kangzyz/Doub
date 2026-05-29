# Review Leftover Local Changes

## Goal

Review the remaining uncommitted local files after the Perplexity citation task and either commit anything that is project-useful or remove changes that are generated, local-only, or malformed.

## What I Already Know

* The remaining paths are `site/README.md`, `site/next-env.d.ts`, `.claude/settings.local.json`, `_commit.ps1`, and `_fix.ps1`.
* `site/README.md` contains malformed README formatting and accidental Chinese text inside a file tree.
* `site/next-env.d.ts` changed only because local Next generated a dev route type path.
* `.claude/settings.local.json` is local permission configuration.
* `_commit.ps1` and `_fix.ps1` are temporary helper scripts for previous local commit attempts.

## Requirements

* Revert useless tracked file changes.
* Remove useless untracked helper/config files.
* Do not touch unrelated project files.
* Commit only Trellis task cleanup metadata if the working tree cleanup itself has no project code changes to commit.

## Acceptance Criteria

* [x] `site/README.md` and `site/next-env.d.ts` no longer appear as modified.
* [x] `.claude/settings.local.json`, `_commit.ps1`, and `_fix.ps1` are removed.
* [x] No project-useful code/docs change is discarded.
* [x] Git status only shows expected Trellis task bookkeeping before finish.

## Definition of Done

* Cleanup is verified with `git status --short`.
* Trellis task is archived and session journal recorded if needed.
* Any resulting commits are pushed to `origin/main`.

## Out of Scope

* Reworking the `site/` package.
* Adding repository ignore rules unless cleanup shows a recurring tracked problem.

## Technical Notes

* This task is a cleanup/classification task, not a product behavior change.
