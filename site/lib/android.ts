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
  versionName: "4.3.1",
  versionCode: 419,
  packageName: "cloud.helpking.yunxin",
  sizeBytes: 3055230,
  sizeLabel: "2.9 MB",
  sizeExactLabel: "3,055,230 B",
  /** Derived from publishedAt (unix 1780648370 → 2026-06). */
  publishedLabel: "2026-06",
  sha256:
    "e014e802ac8bb9db77200187979f48d7fbad531627152440f8d31621949204e2",
  apkUrl: "https://doub.chat/downloads/DOUB-release.apk",
  /** Differently-branded fallback channel; always label it as a mirror. */
  legacyApkUrl: "https://hui.helpking.cloud/downloads/YunXin-release.apk",
  manifestUrl: "https://doub.chat/downloads/update.json",
  qrSrc: "/downloads/doub-android-qr.svg",
} as const;

/** Middle-truncated hash for compact display; full value stays in title/copy. */
export const SHA256_SHORT = `${ANDROID.sha256.slice(0, 10)}…${ANDROID.sha256.slice(-6)}`;
