# Capacitor Android WebView Shell

## Scenario: Hosted DOUB Android WebView Shell

### 1. Scope / Trigger

- Scope: `android-webview/` packages the hosted DOUB web app in a Capacitor
  Android shell.
- Trigger: Any change to app identity, hosted entry URL, WebView settings,
  native permissions, download handling, cookie behavior, Gradle versions, or
  APK update metadata must keep this contract synchronized.
- Current source of truth: `android-webview/capacitor.config.json`,
  `android-webview/scripts/build-web.js`,
  `android-webview/android/app/src/main/AndroidManifest.xml`,
  `android-webview/android/app/build.gradle`, and
  `android-webview/android/app/src/main/java/cloud/helpking/doub/MainActivity.java`.

### 2. Signatures

- Package name / app id:
  - `capacitor.config.json`: `appId = "cloud.helpking.doub"`.
  - `android/app/build.gradle`: `namespace = "cloud.helpking.doub"` and
    `applicationId "cloud.helpking.doub"`.
  - `strings.xml`: `package_name` and `custom_url_scheme` use
    `cloud.helpking.doub`.
  - Java package path: `cloud.helpking.doub.MainActivity`.
- Hosted entry:
  - `capacitor.config.json`: `server.url = "https://doub.chat"`.
  - `scripts/build-web.js`: `targetUrl = "https://doub.chat"`.
  - `webDir = "dist"`; `npm run build` writes `dist/index.html` that redirects
    to the same hosted URL.
- Native lifecycle hooks:
  - `MainActivity.onCreate(Bundle savedInstanceState)`.
  - `MainActivity.onResume()`.
  - `MainActivity.onPause()`.
  - `MainActivity.onStop()`.
  - `configureWebView()`.
  - `configureCookies(WebView webView)`.
  - `flushCookies()`.
  - `handleWebViewDownload(String url, String userAgent, String contentDisposition, String mimeType, long contentLength)`.
  - `handleWebViewDownload(String url, String userAgent, String contentDisposition, String mimeType, long contentLength, String authorizationHeader)`.
  - `openExternalUrl(String url)`.
- Frontend-to-native download bridge:
  - JavaScript object: `window.DoubAndroidDownloads`.
  - Method: `downloadImage(url: string, fileName: string, authorizationHeader: string, mimeType: string): boolean`.
  - Frontend owner: `frontend/features/chat/model/markdown-image-source.ts`.
  - Native owner: `MainActivity.AndroidDownloadsBridge`.

### 3. Contracts

- Capacitor runtime:
  - Dependencies are declared in `android-webview/package.json`; the current
    lockfile resolves `@capacitor/android`, `@capacitor/core`, and
    `@capacitor/cli` to `8.3.4`, and `@capacitor/keyboard` to `8.0.3`.
  - `plugins.Keyboard.resizeOnFullScreen = true`.
  - `android.captureInput = false`.
  - `android.allowMixedContent = false`.
  - `android.webContentsDebuggingEnabled = false`.
- Android SDK / Gradle:
  - `minSdkVersion = 24`, `compileSdkVersion = 36`,
    `targetSdkVersion = 36`.
  - Android Gradle Plugin is `com.android.tools.build:gradle:8.13.0`.
  - `capacitor.settings.gradle` and `app/capacitor.build.gradle` are generated
    by Capacitor; prefer regeneration over manual edits.
- Manifest and network:
  - Required permissions: `INTERNET`, `RECORD_AUDIO`,
    `MODIFY_AUDIO_SETTINGS`, `DOWNLOAD_WITHOUT_NOTIFICATION`.
  - `android:usesCleartextTraffic = "false"`.
  - `network_security_config.xml` sets `cleartextTrafficPermitted = "false"`.
  - `MainActivity` is exported only as the launcher activity and uses
    `launchMode = "singleTask"` with `windowSoftInputMode = "adjustResize"`.
  - A `FileProvider` is registered as `${applicationId}.fileprovider` using
    `res/xml/file_paths.xml`.
- WebView behavior:
  - `onCreate` sets `SOFT_INPUT_ADJUST_RESIZE` to keep chat inputs usable above
    the soft keyboard.
  - `onResume` calls `configureWebView()` and `flushCookies()`.
  - `onPause` and `onStop` call `flushCookies()` before delegating to super.
  - `configureWebView()` must null-check `getBridge()` and `getWebView()`.
  - Cookies are explicitly enabled, third-party cookies are accepted for the
    Capacitor WebView, and cookies are flushed to reduce login loss after
    backgrounding or process reclaim.
  - JavaScript, DOM storage, database storage, and gesture-free media playback
    are enabled.
  - Downloads are handled via `DownloadManager`; if enqueueing fails, the app
    opens the URL with an external `ACTION_VIEW` intent.
- Chat image downloads in the Android shell must not rely on `blob:` object URLs
  or `<a download>` alone. The frontend should prefer
  `window.DoubAndroidDownloads.downloadImage(...)` when present, passing:
  - `url`: the resolved HTTP(S) image URL, usually `/api/v1/files/{id}/content`
    resolved against `resolveApiBaseURL()`.
  - `fileName`: a sanitized image filename from the Markdown `src`/`alt`.
  - `authorizationHeader`: either `""` or a full `Bearer <token>` header value
    for protected DOUB API file content.
  - `mimeType`: an image MIME hint such as `image/*` or `image/png`.
- Native bridge validation must reject non-HTTP(S) URLs and must only attach a
  non-empty `Authorization` header to trusted HTTPS DOUB file downloads. Do not
  pass bearer tokens to arbitrary Markdown image hosts.
- The bridge returns `false` when the native side rejects the request before
  enqueueing; the frontend then falls back to the browser download path.

### 4. Validation & Error Matrix

| Condition | Expected Handling |
| --- | --- |
| `getBridge()` or `getBridge().getWebView()` is null | Return without throwing; lifecycle must remain safe during early resume |
| CookieManager throws | Swallow the exception and keep the app usable; do not crash login flow |
| Download URL is null or blank | Return from the download handler without enqueueing |
| Bridge URL is `blob:`, `data:`, `file:`, or another non-HTTP(S) scheme | Return `false`; frontend uses browser fallback |
| Bridge carries `Authorization` for a non-trusted host or non-HTTPS URL | Return `false`; never enqueue a request that leaks the token |
| Download filename is absent | Use `doub-download` |
| Image MIME lacks an image extension | Append `.png` to preserve gallery/file handling |
| DownloadManager is unavailable or enqueue throws | Fall back to external `ACTION_VIEW` intent |
| External URL open fails | Show a long toast saying the download link cannot be opened |
| Cleartext HTTP is introduced | Reject unless `server.cleartext`, manifest, and network security config are changed intentionally |
| WebView debugging is enabled | Reject for production builds unless the task explicitly scopes a debug-only variant |

### 5. Good/Base/Bad Cases

- Good: Change the hosted URL by updating both `capacitor.config.json` and
  `scripts/build-web.js`, run `npm run build`, and verify `dist/index.html`
  redirects to the same URL.
- Good: For protected chat images, frontend calls
  `DoubAndroidDownloads.downloadImage(resolvedUrl, fileName, "Bearer ...",
  "image/*")`; native validates the trusted HTTPS host and enqueues
  `DownloadManager` with the `Authorization` header.
- Base: Add a WebView setting inside `configureWebView()` after the bridge
  WebView null check, keeping lifecycle calls unchanged.
- Base: For public HTTP(S) image URLs, frontend can still call the bridge with
  an empty authorization header, or fall back to the browser blob download path
  outside Android.
- Bad: Update only `scripts/build-web.js`; Capacitor will still load
  `server.url`, so local fallback and native runtime disagree.
- Bad: Remove cookie flushing from pause/stop; Android process reclaim can then
  make login persistence unstable.
- Bad: Edit `android/capacitor.settings.gradle` manually for a dependency
  change; Capacitor can overwrite it on the next update.
- Bad: Fetch a protected image into a frontend `blob:` URL and click a temporary
  `<a download>` in Android WebView; the WebView shell may silently ignore it and
  the native download listener cannot recover the original auth-protected URL.

### 6. Tests Required

- Static shell build:
  - Run `cd android-webview && npm run build`.
  - Assert `dist/index.html` exists and points at the intended hosted URL.
- Native build:
  - Run `cd android-webview/android && ./gradlew :app:assembleDebug`
    or `.\gradlew.bat :app:assembleDebug` on Windows.
  - Assert the build resolves Capacitor modules and packages resources.
- Frontend shell bridge compile check:
  - Run `cd frontend && pnpm lint`.
  - Assert `window.DoubAndroidDownloads` is optional, typed locally, and the
    normal browser download path still exists when the bridge is absent.
- Manual device or emulator checks when native behavior changes:
  - Login, background, stop, and relaunch; assert the session remains present.
  - Focus a chat input with the soft keyboard open; assert the input is not
    hidden.
  - Download a protected chat image; assert DownloadManager starts and the saved
    file opens as an image.
  - Download a public image and a non-image file; assert DownloadManager
    notification or the external intent fallback works.
  - Exercise microphone or audio features after permission/manifest changes.
- Distribution metadata:
  - If APK update manifests change, keep `frontend/app/downloads/update.json`,
    `frontend/app/downloads/yunxin-update.json`,
    `frontend/public/downloads/update.json`, and
    `frontend/public/downloads/yunxin-update.json` synchronized.

### 7. Wrong vs Correct

#### Wrong

```json
{
  "server": {
    "url": "http://example.local",
    "cleartext": true
  },
  "android": {
    "allowMixedContent": true,
    "webContentsDebuggingEnabled": true
  }
}
```

This breaks the current HTTPS-only production shell contract and weakens the
release WebView security posture.

#### Correct

```json
{
  "server": {
    "url": "https://doub.chat",
    "cleartext": false
  },
  "android": {
    "captureInput": false,
    "allowMixedContent": false,
    "webContentsDebuggingEnabled": false
  }
}
```

Keep the hosted URL HTTPS-only and mirror it in `scripts/build-web.js`:

```javascript
const targetUrl = "https://doub.chat";
```

#### Wrong

```java
private void configureWebView() {
    WebView webView = getBridge().getWebView();
    webView.getSettings().setJavaScriptEnabled(true);
}
```

This can crash if the Capacitor bridge is not ready.

#### Correct

```java
private void configureWebView() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
        return;
    }
    configureCookies(webView);
    webView.getSettings().setJavaScriptEnabled(true);
}
```

Always keep native WebView configuration lifecycle-safe and cookie-aware.

#### Wrong

```typescript
const blobURL = URL.createObjectURL(await response.blob());
const link = document.createElement("a");
link.href = blobURL;
link.download = "image.png";
link.click();
```

This is fine as a browser fallback, but it must not be the only Android path:
the native WebView shell cannot reliably turn that `blob:` URL into a saved
file.

#### Correct

```typescript
window.DoubAndroidDownloads?.downloadImage?.(
  resolvedImageURL,
  fileName,
  accessToken ? `Bearer ${accessToken}` : "",
  "image/*",
);
```

Prefer the native bridge on Android so protected file-content downloads keep the
original HTTP(S) URL and authorization header.

## Design Decisions

### Hosted Shell Instead Of Bundled Frontend

The Android app currently loads `https://doub.chat` through Capacitor
`server.url`. `dist/index.html` is generated only as a fallback redirect for the
Capacitor `webDir` contract. Do not copy the Next.js frontend build into
`android-webview/dist` unless the product decision changes from hosted shell to
offline/bundled app.

### Login Persistence Is Native-Owned

The frontend still owns auth UI and backend API calls, but Android login
persistence depends on native WebView cookie configuration. Keep
`setAcceptCookie(true)`, `setAcceptThirdPartyCookies(webView, true)`, and
`CookieManager.flush()` in lifecycle paths unless replacing them with an
equivalent Android-specific persistence strategy.

## Common Mistakes

- Treating `frontend/app/downloads/*.json` as the Android source app id. Those
  files are APK update manifests; the current Android source app id is
  `cloud.helpking.doub`.
- Assuming browser notification APIs imply native notification support. Native
  Android notification behavior requires explicit Capacitor/plugin or Java
  implementation and manifest permissions.
- Adding a WebView JavaScript bridge without documenting the request/response
  payloads here. Any bridge is a cross-layer contract and must include method
  names, payload fields, validation, and tests.
