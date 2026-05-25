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
  - `capacitor.config.json`: `server.url = "https://doub.vexown.com"`.
  - `scripts/build-web.js`: `targetUrl = "https://doub.vexown.com"`.
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
  - `openExternalUrl(String url)`.

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

### 4. Validation & Error Matrix

| Condition | Expected Handling |
| --- | --- |
| `getBridge()` or `getBridge().getWebView()` is null | Return without throwing; lifecycle must remain safe during early resume |
| CookieManager throws | Swallow the exception and keep the app usable; do not crash login flow |
| Download URL is null or blank | Return from the download handler without enqueueing |
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
- Base: Add a WebView setting inside `configureWebView()` after the bridge
  WebView null check, keeping lifecycle calls unchanged.
- Bad: Update only `scripts/build-web.js`; Capacitor will still load
  `server.url`, so local fallback and native runtime disagree.
- Bad: Remove cookie flushing from pause/stop; Android process reclaim can then
  make login persistence unstable.
- Bad: Edit `android/capacitor.settings.gradle` manually for a dependency
  change; Capacitor can overwrite it on the next update.

### 6. Tests Required

- Static shell build:
  - Run `cd android-webview && npm run build`.
  - Assert `dist/index.html` exists and points at the intended hosted URL.
- Native build:
  - Run `cd android-webview/android && ./gradlew :app:assembleDebug`
    or `.\gradlew.bat :app:assembleDebug` on Windows.
  - Assert the build resolves Capacitor modules and packages resources.
- Manual device or emulator checks when native behavior changes:
  - Login, background, stop, and relaunch; assert the session remains present.
  - Focus a chat input with the soft keyboard open; assert the input is not
    hidden.
  - Download an image and a non-image file; assert DownloadManager notification
    or the external intent fallback works.
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
    "url": "https://doub.vexown.com",
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
const targetUrl = "https://doub.vexown.com";
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

## Design Decisions

### Hosted Shell Instead Of Bundled Frontend

The Android app currently loads `https://doub.vexown.com` through Capacitor
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
