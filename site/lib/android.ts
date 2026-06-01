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
  versionName: "4.2",
  versionCode: 417,
  packageName: "cloud.helpking.yunxin",
  sizeBytes: 26275080,
  sizeLabel: "25.1 MB",
  sizeExactLabel: "26,275,080 B",
  /** Derived from publishedAt (unix 1780233444 → 2026-06). */
  publishedLabel: "2026-06",
  sha256:
    "1f8c5725da3a26fc6c82c5853c2663b5684ec27426532ae9d780afb3f9a66c76",
  apkUrl: "https://doub.chat/downloads/DOUB-release.apk",
  /** Differently-branded fallback channel; always label it as a mirror. */
  legacyApkUrl: "https://hui.helpking.cloud/downloads/DOUB-release.apk",
  manifestUrl: "https://doub.chat/downloads/update.json",
  qrSrc: "/downloads/doub-android-qr.svg",
} as const;

/** Middle-truncated hash for compact display; full value stays in title/copy. */
export const SHA256_SHORT = `${ANDROID.sha256.slice(0, 10)}…${ANDROID.sha256.slice(-6)}`;
