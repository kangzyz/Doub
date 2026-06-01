"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { motion, useReducedMotion } from "motion/react";

import { ANDROID, SHA256_SHORT } from "../lib/android";
import { DoubLogo } from "./logo";

type Locale = "en" | "zh";

const T: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    accent: string;
    lead: string;
    version: string;
    build: string;
    size: string;
    updated: string;
    download: string;
    copyLink: string;
    copied: string;
    mirror: string;
    manifest: string;
    scan: string;
    scanSub: string;
    trust: string;
    androidOnly: string;
    routed: string;
    user: string;
    assistant: string;
    placeholder: string;
  }
> = {
  en: {
    eyebrow: "On Android",
    title: "Take DOUB",
    accent: "with you.",
    lead: "The same workspace, in your pocket. An Android build of doub.chat — a thin WebView, fully yours.",
    version: "Version",
    build: "Build",
    size: "Size",
    updated: "Updated",
    download: "Download APK",
    copyLink: "Copy link",
    copied: "Copied",
    mirror: "Mirror",
    manifest: "manifest",
    scan: "Scan to install",
    scanSub: "Point your Android camera here",
    trust: "Open source · Apache-2.0 · verify the hash before you install",
    androidOnly: "Android only — a WebView wrapper. No iOS build.",
    routed: "Routed · Opus 4.8",
    user: "Summarize this PDF and keep the key risks.",
    assistant: "Done — 3 risks flagged, sources linked.",
    placeholder: "Message…",
  },
  zh: {
    eyebrow: "安卓端",
    title: "带着 DOUB",
    accent: "一起走。",
    lead: "同一个工作台，装进口袋。doub.chat 的安卓版本——一个轻量 WebView，完全属于你。",
    version: "版本",
    build: "构建",
    size: "大小",
    updated: "更新",
    download: "下载 APK",
    copyLink: "复制链接",
    copied: "已复制",
    mirror: "备用镜像",
    manifest: "更新清单",
    scan: "扫码安装",
    scanSub: "用安卓手机的相机扫一扫",
    trust: "开源 · Apache-2.0 · 安装前请校验哈希",
    androidOnly: "仅限安卓 —— 一个 WebView 封装，暂无 iOS 版本。",
    routed: "已路由 · Opus 4.8",
    user: "总结这份 PDF，保留关键风险。",
    assistant: "完成——已标出 3 处风险并附来源。",
    placeholder: "发消息…",
  },
};

function PhoneMock({ locale }: { locale: Locale }) {
  const t = T[locale];
  return (
    <div className="relative mx-auto w-[248px] sm:w-[272px]">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/25 via-violet/15 to-cyan/20 blur-2xl"
      />
      <div className="relative rounded-[2.4rem] border border-border-strong bg-card/80 p-2 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div className="overflow-hidden rounded-[1.9rem] border border-border bg-background">
          {/* Status bar */}
          <div className="relative flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-medium text-muted-foreground">
            <span className="tabular-nums">19:04</span>
            <span
              aria-hidden
              className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-foreground/15"
            />
            <span className="flex items-center gap-1" aria-hidden>
              <span className="h-2 w-3 rounded-[2px] border border-current opacity-70" />
              <span className="h-2 w-2 rounded-full border border-current opacity-70" />
            </span>
          </div>

          {/* App header */}
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <DoubLogo className="h-3 w-auto text-foreground" />
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground">
              <span className="size-1 rounded-full bg-cyan" />
              {t.routed}
            </span>
          </div>

          {/* Conversation */}
          <div className="space-y-2.5 px-3.5 py-3.5">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[11px] leading-relaxed text-background">
                {t.user}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet">
                <span className="size-1 rounded-full bg-primary-foreground" />
              </span>
              <p className="max-w-[82%] rounded-2xl rounded-tl-md border border-border bg-card px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
                {t.assistant}
              </p>
            </div>
          </div>

          {/* Composer */}
          <div className="mx-3.5 mb-2 flex items-center gap-2 rounded-xl border border-border bg-card/60 px-2.5 py-1.5">
            <span className="flex-1 truncate text-[11px] text-muted-foreground">
              {t.placeholder}
            </span>
            <span className="inline-flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet text-primary-foreground">
              <Send className="size-3" aria-hidden />
            </span>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2">
            <span className="h-1 w-20 rounded-full bg-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AndroidDownload({ locale }: { locale: Locale }) {
  const t = T[locale];
  const reduce = useReducedMotion();
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState<"sha" | "link" | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) {
      setIsAndroid(true);
    }
  }, []);

  const copy = async (text: string, key: "sha" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  const meta: { label: string; value: string }[] = [
    { label: t.version, value: ANDROID.versionName },
    { label: t.build, value: String(ANDROID.versionCode) },
    { label: t.size, value: ANDROID.sizeLabel },
    { label: t.updated, value: ANDROID.publishedLabel },
  ];

  return (
    <section id="android" className="relative scroll-mt-24 overflow-hidden border-t border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-dots opacity-[0.3]" />
        <div className="aurora-blob drift-b right-[-6%] top-[-10%] size-[32rem] bg-primary/25" />
        <div className="aurora-blob drift-c left-[-8%] bottom-[-12%] size-[28rem] bg-cyan/20" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Phone column (first on mobile) */}
          <motion.div
            className="order-first lg:order-last"
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <PhoneMock locale={locale} />

            {/* QR — desktop only */}
            {!isAndroid && (
              <div className="mx-auto mt-8 flex max-w-xs items-center gap-4 rounded-2xl border border-border bg-card/50 p-3.5 backdrop-blur-sm">
                <span className="inline-flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ANDROID.qrSrc}
                    alt="QR code linking to the DOUB Android APK download"
                    width={64}
                    height={64}
                    className="size-full"
                  />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.scan}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.scanSub}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Copy + manifest column */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
              — {t.eyebrow}
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              {t.title} <span className="text-aurora">{t.accent}</span>
            </h2>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              {t.lead}
            </p>

            {/* Manifest card */}
            <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
              {meta.map((m) => (
                <div key={m.label} className="bg-card/60 px-4 py-3.5 backdrop-blur-sm">
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {m.label}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* SHA-256 */}
            <button
              type="button"
              onClick={() => copy(ANDROID.sha256, "sha")}
              title={ANDROID.sha256}
              aria-label={`Copy SHA-256 checksum: ${ANDROID.sha256}`}
              className="group mt-3 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-border bg-card/40 px-3.5 py-2.5 text-left transition-colors hover:border-border-strong"
            >
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                SHA-256
              </span>
              <span className="truncate font-mono text-xs text-foreground/80">
                {SHA256_SHORT}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                {copied === "sha" ? (
                  <>
                    <Check className="size-3.5 text-cyan" aria-hidden />
                    {t.copied}
                  </>
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
              </span>
            </button>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={ANDROID.apkUrl}
                rel="noopener noreferrer"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-100"
              >
                <Download className="size-4" aria-hidden />
                {t.download}
                <span className="text-background/60">· {ANDROID.sizeLabel}</span>
              </a>
              <button
                type="button"
                onClick={() => copy(ANDROID.apkUrl, "link")}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-card/40 px-6 text-sm font-medium text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:bg-card"
              >
                {copied === "link" ? (
                  <Check className="size-4 text-cyan" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copied === "link" ? t.copied : t.copyLink}
              </button>
            </div>

            {/* Channels + trust */}
            <div className="mt-5 space-y-2 text-xs text-muted-foreground">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <a
                  href={ANDROID.legacyApkUrl}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  {t.mirror} · helpking.cloud
                  <ArrowUpRight className="size-3" aria-hidden />
                </a>
                <span aria-hidden className="text-border-strong">·</span>
                <a
                  href={ANDROID.manifestUrl}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  {t.manifest}
                  <ArrowUpRight className="size-3" aria-hidden />
                </a>
              </p>
              <p className="flex items-center gap-1.5">
                <Smartphone className="size-3.5 shrink-0" aria-hidden />
                {t.androidOnly}
              </p>
              <p className="text-pretty">{t.trust}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
