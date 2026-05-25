# Android WebView Guidelines

The Android WebView shell lives under `android-webview/`. It is a Capacitor
Android wrapper around the hosted DOUB web app, not a second frontend
implementation.

## Pre-Development Checklist

- Treat `android-webview/capacitor.config.json` as the app-level Capacitor
  source of truth.
- Treat `android-webview/android/app/src/main/java/cloud/helpking/doub/MainActivity.java`
  as the native WebView behavior owner.
- Keep the package identity synchronized between `capacitor.config.json`,
  `android/app/build.gradle`, `strings.xml`, and Java package paths.
- Preserve HTTPS-only loading unless a task explicitly changes the deployment
  contract and updates the network security policy.
- Check whether a change affects login persistence, keyboard resize, downloads,
  microphone permissions, or APK distribution metadata.
- Do not edit generated Capacitor files unless the change is intentionally
  regenerated with Capacitor tooling.

## Spec Files

| File | Read When |
| --- | --- |
| [capacitor-shell.md](./capacitor-shell.md) | Changing the Android wrapper, WebView settings, app identity, downloads, manifest permissions, or build flow |

## Quality Check

For WebView shell changes:

```bash
cd android-webview
npm run build
```

For native Android changes, also run:

```bash
cd android-webview/android
./gradlew :app:assembleDebug
```

On Windows PowerShell, use:

```powershell
cd android-webview\android
.\gradlew.bat :app:assembleDebug
```

If distribution metadata is touched, compare `frontend/app/downloads/*.json`
and `frontend/public/downloads/*.json` and keep duplicated manifests in sync.
