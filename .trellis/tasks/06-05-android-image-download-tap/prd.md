# Fix Android Image Download Tap

## Goal

Fix the Android DOUB app behavior where tapping the generated/markdown image download action in chat does nothing. The Android WebView build should provide a working download path for chat images, including protected API-hosted images that require the frontend access token.

## What I Already Know

* User reports that the current DOUB Android client cannot click image download; tapping has no visible effect.
* Chat Markdown images render in `frontend/features/chat/components/markdown/streamdown-components.tsx`.
* The image action toolbar calls `downloadMarkdownImageSource` from `frontend/features/chat/model/markdown-image-source.ts`.
* Current image download implementation fetches the image, creates a blob URL, creates an anchor, sets `download`, and calls `link.click()`.
* Android WebView/Capacitor commonly does not honor programmatic `a.download` for blob URLs, so the tap can appear to do nothing.
* Android wrapper code lives in `android-webview/android/app/src/main/java/cloud/helpking/yunxin/MainActivity.java`.
* The Android package currently depends only on Capacitor core packages; no Filesystem/Share plugin is present.

## Assumptions

* The immediate broken flow is chat generated/markdown image download, not the Files page preview download.
* The fix should preserve desktop/web behavior and add Android-compatible handling without changing backend APIs.
* A working Android fix can use the app wrapper's native download/open/save capability when browser-native download is unreliable.

## Requirements

* Tapping the chat image download action in Android must produce a visible download/save/open result instead of silently doing nothing.
* Protected `/api/v1/files/{id}/content` image URLs must keep using the frontend access token when downloaded.
* Desktop browser behavior must remain compatible.
* Failures should produce a fallback or visible error path rather than a silent no-op.

## Diagnosis

* The button itself is wired: `MarkdownImage` renders a download button whose `onClick` calls `handleDownload()`.
* `handleDownload()` calls `downloadMarkdownImageSource()`, and the helper downloads by creating a `blob:` object URL, assigning it to a temporary `<a download>`, and calling `link.click()`.
* In the Android wrapper, `MainActivity` does not register `WebView.setDownloadListener(...)`, does not use `DownloadManager`, and does not expose a JavaScript bridge/native plugin for saving downloaded image bytes.
* Android official WebView APIs expect the host application to register `setDownloadListener` when content should be downloaded; the current host app does not provide that handler.
* The fallback after a frontend download error is `window.open(resolvedSrc)`, which is also unreliable in the Capacitor WebView shell and gives no visible error feedback.
* Most likely root cause: the frontend click reaches the download helper, but the actual save/open action relies on browser download semantics (`blob:` + `a.download`) that the Android WebView shell does not handle, and the native shell has no download fallback. That produces the observed silent no-op.

## Acceptance Criteria

* [ ] Chat image download still works in normal desktop browser flow.
* [ ] Android WebView chat image download no longer depends solely on `blob:` + `a.download`.
* [ ] Protected chat images still include authorization during download.
* [ ] Lint/type-check for touched frontend code passes.
* [ ] Android Java changes compile, or the changed file is checked for syntax/import consistency if full Gradle build is not feasible.

## Definition of Done

* Tests added/updated where practical for pure frontend helpers.
* Lint / typecheck / build checks run for touched areas where available.
* Existing unrelated dirty files are left untouched.
* Rollback is straightforward: revert the Android download bridge/frontend download helper changes.

## Out of Scope

* Redesigning the image toolbar UI.
* Adding a new backend image download endpoint.
* Changing image generation or image edit behavior.
* Fixing unrelated file preview downloads unless the same small helper can safely cover them.

## Technical Notes

* Relevant files inspected:
  * `frontend/features/chat/components/markdown/streamdown-components.tsx`
  * `frontend/features/chat/model/markdown-image-source.ts`
  * `android-webview/android/app/src/main/java/cloud/helpking/yunxin/MainActivity.java`
  * `android-webview/package.json`
  * `android-webview/android/app/src/main/AndroidManifest.xml`
* Existing uncommitted files before this task include chat stream sync work and i18n files; do not overwrite or include them in this fix unless directly required.
