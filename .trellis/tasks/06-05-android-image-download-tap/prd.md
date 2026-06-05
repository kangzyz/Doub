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

* [x] Chat image download still works in normal desktop browser flow.
* [x] Android WebView chat image download no longer depends solely on `blob:` + `a.download`.
* [x] Protected chat images still include authorization during download.
* [x] Lint/type-check for touched frontend code passes.
* [x] Android Java changes compile, or the changed file is checked for syntax/import consistency if full Gradle build is not feasible.

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

## Implementation Notes

* Added optional frontend detection for `window.DoubAndroidDownloads.downloadImage(...)` in `frontend/features/chat/model/markdown-image-source.ts`.
* The frontend passes the resolved HTTP(S) image URL, download filename, optional `Bearer` authorization header, and image MIME hint to the Android bridge before falling back to the existing browser blob download path.
* Added `DoubAndroidDownloads` JavaScript bridge and `WebView.setDownloadListener(...)` in `android-webview/android/app/src/main/java/cloud/helpking/yunxin/MainActivity.java`.
* Android native downloads now enqueue through `DownloadManager`, preserve cookies and trusted Bearer auth headers, sanitize filenames, append image extensions where needed, and fall back to `ACTION_VIEW` if enqueueing fails.
* Updated `.trellis/spec/android-webview/capacitor-shell.md` with the bridge contract and Android download validation rules.

## Verification

* `cd frontend && pnpm lint` passed.
* `cd android-webview && npm run build` passed.
* `cd android-webview/android && .\gradlew.bat :app:assembleDebug` passed.
* `git diff --check` passed for the touched implementation files before the final spec/PRD note update.
* Android emulator manual test passed on AVD `doub_test`:
  * Installed `android-webview/android/app/build/outputs/apk/debug/app-debug.apk`.
  * Launched `cloud.helpking.yunxin/.MainActivity`; app reached the DOUB login WebView.
  * Connected to `webview_devtools_remote_2153` and verified `window.DoubAndroidDownloads.downloadImage` exists.
  * Called `downloadImage("https://doub.chat/DOUB-Chat.png", "doub-android-bridge-test.png", "", "image/png")`; bridge returned `true`.
  * Verified `/sdcard/Download/doub-android-bridge-test.png` exists, size `1764823`, PNG magic `89 50 4E 47 0D 0A 1A 0A`, and visual preview is the expected DOUB image.
  * Verified rejected paths: `blob:` URL returned `false`; `https://example.com/...` with `Bearer fake-token` returned `false`.
