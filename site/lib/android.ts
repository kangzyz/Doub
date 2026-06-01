/**
 * Android release metadata — baked from the live manifest at build time.
 * Source of truth: https://doub.chat/downloads/update.json
 *
 * The site is a static export (`output: "export"`), so we mirror the manifest
 * values here rather than fetching at runtime. When a new APK ships, update the
 * fields below (versionName / versionCode / size / sha256 / publishedLabel) to
 * match update.json and redeploy.
 */
export const ANDROID = {
  appName: "DOUB",
  versionName: "4.3",
  versionCode: 418,
  packageName: "cloud.helpking.yunxin",
  sizeBytes: 3033161,
  sizeLabel: "2.9 MB",
  sizeExactLabel: "3,033,161 B",
  /** Derived from publishedAt (unix 1780316954 → 2026-06). */
  publishedLabel: "2026-06",
  sha256:
    "e2f267acc018815f576a2e304288fb5f65823b8c9d6c7bb6416eeebb73335c96",
  apkUrl: "https://doub.chat/downloads/DOUB-release.apk",
  /** Differently-branded fallback channel; always label it as a mirror. */
  legacyApkUrl: "https://hui.helpking.cloud/downloads/YunXin-release.apk",
  manifestUrl: "https://doub.chat/downloads/update.json",
  qrSrc: "/downloads/doub-android-qr.svg",
} as const;

/** Middle-truncated hash for compact display; full value stays in title/copy. */
export const SHA256_SHORT = `${ANDROID.sha256.slice(0, 10)}…${ANDROID.sha256.slice(-6)}`;
