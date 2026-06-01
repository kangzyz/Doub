# Releasing the DOUB Android app

The Android app is a thin **Capacitor WebView shell** that loads `https://doub.chat`
remotely (`capacitor.config.json` → `server.url`). It is distributed as a **side-loaded
APK** via `https://doub.chat/downloads/DOUB-release.apk`, with version metadata in
`https://doub.chat/downloads/update.json`.

---

## 0. About APK size (~4 MB is correct; ~21 MB means something got bundled)

A correct release APK is **only a few MB**, because:

- the web app is **not bundled** — it loads remotely via `server.url`;
- `android/app/src/main/assets/public/` should contain **only** the redirect stub
  (`index.html` ~2 KB + `cordova.js` + `cordova_plugins.js`), ~2 KB total;
- there are **no native `lib/*.so`** and **no Firebase** (no `google-services.json`).

If your build is ~20 MB, check `android/app/src/main/assets/public/` **after `cap sync`** —
if it contains a full built frontend (JS chunks, images), then the real web app was
copied into `dist/` and bundled. Don't do that for this app: `scripts/build-web.js`
intentionally writes a tiny redirect stub. Keep it.

```powershell
# sanity check after cap sync — should be ~2 KB, 3 files
Get-ChildItem android\app\src\main\assets\public -Recurse | Measure-Object Length -Sum
```

---

## 1. One-time setup on the build machine

### 1.1 Java **21** (required)
Capacitor 8 compiles its Java at **source level 21** — JDK 17 fails with
`invalid source release: 21`.

```powershell
winget install EclipseAdoptium.Temurin.21.JDK    # or: choco install temurin21 -y
# set JAVA_HOME (machine), e.g.:
[Environment]::SetEnvironmentVariable("JAVA_HOME","C:\Program Files\Eclipse Adoptium\jdk-21...-hotspot","Machine")
```

### 1.2 Android SDK (API 36)
Easiest: install **Android Studio** (bundles the SDK manager). CLI-only alternative:

```powershell
# download commandlinetools-win-*.zip from developer.android.com, unzip to:
#   C:\Android\Sdk\cmdline-tools\latest\
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat --licenses
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat "platform-tools" "platforms;android-36" "build-tools;36.0.0"
[Environment]::SetEnvironmentVariable("ANDROID_HOME","C:\Android\Sdk","Machine")
```

Then point Gradle at the SDK (per checkout, **not committed**):

```
# android/local.properties
sdk.dir=C:/Android/Sdk
```

### 1.3 Node 18+ (for `cap sync` + the web stub).

### 1.4 (If behind a proxy) — configure Java tools, npm, and sdkmanager
Gradle does **not** use the Windows system proxy. Add to `%USERPROFILE%\.gradle\gradle.properties`:

```
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=10808
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=10808
```
For sdkmanager add `--proxy=http --proxy_host=127.0.0.1 --proxy_port=10808`;
for npm `set HTTPS_PROXY=http://127.0.0.1:10808`.

---

## 2. Signing — use the **SAME** keystore as previous releases ⚠️

Android only installs an update if the new APK is signed with the **same key** as the
installed app. **Use the existing DOUB release keystore** (the one that signed v4.2).
**Do not generate a new keystore** — a new key makes the update un-installable for every
existing user (they'd have to uninstall first).

The repo's `release` build type has **no `signingConfig`**, so `assembleRelease` produces
an **unsigned** APK by default. Pick one:

### Option A (recommended): wire the keystore into Gradle
Create `android/keystore.properties` (**git-ignored — never commit it**):

```
storeFile=C:/secure/doub-release.keystore
storePassword=********
keyAlias=doub
keyPassword=********
```

Add to `android/app/build.gradle` (top + inside `android { }`):

```gradle
def ksProps = new Properties()
def ksFile = rootProject.file("keystore.properties")
if (ksFile.exists()) { ksProps.load(new FileInputStream(ksFile)) }

android {
    // ...
    signingConfigs {
        release {
            if (ksFile.exists()) {
                storeFile file(ksProps['storeFile'])
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```
Then `gradlew assembleRelease` outputs a **signed** `app-release.apk`.

### Option B: sign the unsigned APK manually
```powershell
$bt = "C:\Android\Sdk\build-tools\36.0.0"
& "$bt\zipalign.exe" -p -f 4 app-release-unsigned.apk app-release-aligned.apk
& "$bt\apksigner.bat" sign --ks doub-release.keystore --ks-key-alias doub `
    --out DOUB-release.apk app-release-aligned.apk
& "$bt\apksigner.bat" verify --print-certs DOUB-release.apk
```

---

## 3. Build a release

```powershell
cd android-webview

# 1) Bump the version (MUST increase versionCode every release)
#    edit android/app/build.gradle defaultConfig:
#       versionCode 418        // > the previous (417 for v4.2)
#       versionName "4.3"

# 2) (first time) install deps, then regenerate the web stub + sync native project
npm install
node scripts/build-web.js
npx cap sync android

# 3) build the signed release (Option A) — or assembleRelease then sign (Option B)
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21...-hotspot"
.\gradlew.bat assembleRelease
# output: app/build/outputs/apk/release/app-release.apk
```

Verify before publishing: install on a real phone **over** the currently-installed app
(it must update without uninstall — proves the signature matches), and check the splash /
launcher icon / no top "DOUB" title bar.

---

## 4. Publish

```powershell
$apk = "android\app\build\outputs\apk\release\app-release.apk"
"size (bytes): $((Get-Item $apk).Length)"
(Get-FileHash -Algorithm SHA256 $apk).Hash.ToLower()
```

1. Upload `app-release.apk` as **`DOUB-release.apk`** to:
   - primary: `https://doub.chat/downloads/DOUB-release.apk`
   - mirror:  `https://hui.helpking.cloud/downloads/DOUB-release.apk`
2. Update **`update.json`** on both channels — keep keys in sync with the build:

```jsonc
{
  "versionCode": 418,              // == build.gradle versionCode
  "versionName": "4.3",            // == build.gradle versionName
  "packageName": "cloud.helpking.doub",   // (note: applicationId is cloud.helpking.doub)
  "appName": "DOUB",
  "apkUrl": "https://doub.chat/downloads/DOUB-release.apk",
  "legacyApkUrl": "https://hui.helpking.cloud/downloads/DOUB-release.apk",
  "sha256": "<sha256 from above>",
  "size": 4300000,                 // == file size in bytes
  "publishedAt": 1780000000,       // unix seconds
  "force": false,
  "requiresFreshInstall": false,
  "releaseNotes": "DOUB 4.3 更新记录\n\n- ...",
  "notes": "DOUB 4.3 ..."
}
```

> The marketing site (`site/`) reads these same figures — after publishing, update
> `site/lib/android.ts` (versionName, versionCode, sizeLabel, sha256, publishedLabel)
> so the download page stays accurate.

---

## 5. Quick checklist

- [ ] `versionCode` increased; `versionName` set (build.gradle == update.json)
- [ ] `assets/public` is the ~2 KB stub (web app **not** bundled)
- [ ] Signed with the **existing** release keystore (`apksigner verify --print-certs`)
- [ ] Installs **over** the current app on a device (no uninstall needed)
- [ ] No top "DOUB" title bar; splash + launcher icon correct
- [ ] APK uploaded to both channels; `update.json` updated on both
- [ ] `site/lib/android.ts` updated
