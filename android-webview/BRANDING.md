# DOUB Android wrapper — brand styling

The Capacitor shell loads `https://doub.chat` directly (`capacitor.config.json` →
`server.url`). These resources style the native chrome around it to match the web
app's "Aurora Minimal" identity (near-black canvas, indigo/violet/cyan accents).

## What's branded

| Surface | Files | Notes |
|---|---|---|
| **Splash / launch** | `res/values/styles.xml` (`AppTheme.NoActionBarLaunch`), `res/drawable/splash_icon.xml` (AnimatedVectorDrawable) + `res/drawable/splash_logo.xml`, `splashBackground` in `res/values{,-night}/colors.xml` | Uses androidx **core-splashscreen**. Background is DayNight (near-white / near-black). The mark is the **DOUB "D"** filled with the brand red→blue gradient (from `logo-color.svg`) — a monogram, because the full wordmark gets clipped/shrunk by the system splash's circular icon mask. It **animates** (scale 0.62→1 + fade-in, `windowSplashScreenAnimationDuration=520`). |
| **No white flash** | `AppTheme.NoActionBar` → `android:windowBackground = @color/splashBackground` | Brand window background shows before the WebView paints. |
| **Launcher icon** | `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml`, `res/drawable-v24/ic_launcher_foreground.xml`, `res/drawable/ic_launcher_background.xml` | Adaptive (API 26+): near-black + subtle indigo aurora background, **DOUB "D"** foreground filled with the same red→blue gradient as the splash, plus a `<monochrome>` layer for Android 13 themed icons. |
| **System bars** | `AppTheme.NoActionBar` (`statusBarColor`/`navigationBarColor` + `windowLightStatusBar`/`windowLightNavigationBar` = `@bool/lightSystemBars`), `res/values{,-night}/bools.xml` | DayNight light/dark icon contrast. |
| **Loading stub** | `scripts/build-web.js` → `dist/index.html` | Dark, branded fallback (rarely shown with `server.url`); no white flash. |

Preserved untouched: the hard-won **text-selection toolbar** fixes
(`colorBackgroundFloating` light/night, no `DarkActionBar`, `forceDarkAllowed=false`).

## Build / verify

Verified: `assembleDebug` builds cleanly and the resource pipeline compiles all of the
splash/icon/theme XML. **Requires JDK 21** (Capacitor 8 compiles with Java 21 source level —
JDK 17 fails with `invalid source release: 21`) and the Android SDK (platform 36, build-tools 36).

```bash
cd android-webview
npm install                                # first time: pulls @capacitor/* (needed by Gradle)
node scripts/build-web.js                  # regenerate dist/index.html
npx cap sync android                       # generate the Capacitor native projects
cd android
./gradlew assembleDebug                     # -> app/build/outputs/apk/debug/app-debug.apk
# (release: ./gradlew assembleRelease — needs a signingConfig; debug is auto-signed)
# or open android-webview/android in Android Studio and Run
```

Requires `JAVA_HOME` = JDK 21 and `local.properties` `sdk.dir` (or `ANDROID_HOME`). Behind a
proxy, set `systemProp.https.proxyHost/Port` in `~/.gradle/gradle.properties`.

Check: cold-start splash (light + dark), launcher icon on the home screen, and that the
status/nav bar icons are legible in both modes.

## Known caveats

- **Legacy PNG launcher icons** (`res/mipmap-*/ic_launcher*.png`) still show the **old blue
  "X"** on **API 24–25** (pre-adaptive-icon). Regenerate them from the DOUB mark if you
  need those old devices to match (or raise `minSdk` to 26).
- **target SDK 36** enforces **edge-to-edge** on Android 15+, so `statusBarColor` /
  `navigationBarColor` are ignored there — only the light/dark icon flags apply. The web
  content draws behind the bars (the web app handles its own insets).
- **System mode vs web theme:** the bars follow the **system** light/dark, but the web app
  has its own in-app theme toggle. If a user sets the web app light while the system is dark
  (or vice-versa), the bar icons can mismatch. The proper fix is driving the bars from the
  web app (e.g. the Capacitor `StatusBar` plugin) — a larger change, intentionally not done here.
