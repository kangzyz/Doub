"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  GitBranch,
  Infinity as InfinityIcon,
  Layers,
  ShieldCheck,
  Smartphone,
  Waypoints,
} from "lucide-react";

import { SiteHeader } from "./site-header";
import { ChatPreview } from "./chat-preview";
import { AndroidDownload } from "./android-download";
import { GithubIcon } from "./icons";
import { DoubLogo } from "./logo";
import { ANDROID } from "../lib/android";

type Locale = "en" | "zh";

type Stat = { value: string; label: string };
type Feature = { title: string; body: string };
type Principle = { index: string; title: string; body: string };

type Copy = {
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  ctaPrimary: string;
  ctaSecondary: string;
  stats: Stat[];
  providerLabel: string;
  providers: string[];
  productEyebrow: string;
  productTitle: string;
  productLead: string;
  features: Feature[];
  principlesEyebrow: string;
  principles: Principle[];
  outroEyebrow: string;
  outroTitle: string;
  outroAccent: string;
  outroLead: string;
  footerTagline: string;
  appLabel: string;
  navHome: string;
  navProduct: string;
  navConnect: string;
  supportLabel: string;
  rights: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    heroEyebrow: "Apache-2.0 · self-hosted · yours to fork",
    heroTitle: "Every model.",
    heroAccent: "One quiet place.",
    heroDescription:
      "Chat, files, tools, and audit on a single canvas. Self-hosted, and entirely yours.",
    ctaPrimary: "Open DOUB",
    ctaSecondary: "View on GitHub",
    stats: [
      { value: "14+", label: "models routed" },
      { value: "100%", label: "self-hosted" },
      { value: "Apache-2.0", label: "open source" },
    ],
    providerLabel: "One canvas. Every model worth using.",
    providers: [
      "GPT-5",
      "Claude",
      "Gemini",
      "Llama",
      "Qwen",
      "DeepSeek",
      "Mistral",
      "Grok",
    ],
    productEyebrow: "The product",
    productTitle: "Everything in one calm place.",
    productLead:
      "Models, files, tools, and people on a single canvas. Nothing lost, nothing hidden.",
    features: [
      {
        title: "Route any model",
        body: "Switch between frontier and local models mid-conversation. One key, one canvas, no tab graveyard.",
      },
      {
        title: "Your data, only yours",
        body: "Your models, your keys, your audit log — all under your own roof. No vendor lock, no quiet defaults.",
      },
      {
        title: "Multimodal native",
        body: "Drop in documents, images, and tools. The conversation keeps its memory and its shape.",
      },
      {
        title: "Built to last",
        body: "Apache-licensed and architecturally small on purpose. Deploy once, trust it for years.",
      },
      {
        title: "Open, yours to fork",
        body: "Fully open source. Audit it, fork it, run it — the code that runs your work is yours to see.",
      },
    ],
    principlesEyebrow: "Why it's built this way",
    principles: [
      {
        index: "01",
        title: "Built to think.",
        body: "Every conversation worth having needs a place to begin, and somewhere to return. DOUB Chat gives intelligence a room of its own.",
      },
      {
        index: "02",
        title: "Built to last.",
        body: "The internet asks you to refresh, retry, and renew. We built something to keep. Six months from now, the conversation still makes sense.",
      },
      {
        index: "03",
        title: "Built to be yours.",
        body: "Your data, your models, your audit log. We add features the way a watchmaker adds gears — only when the machine runs more truly.",
      },
    ],
    outroEyebrow: "Begin",
    outroTitle: "Quietly,",
    outroAccent: "it stays yours.",
    outroLead: "Open the workspace, or read every line of code that runs it.",
    footerTagline: "Self-hosted AI workspace. Entirely yours.",
    appLabel: "Android app",
    navHome: "Home",
    navProduct: "Product",
    navConnect: "Connect",
    supportLabel: "Support",
    rights: "© 2026 DOUB Chat · Apache License 2.0",
  },
  zh: {
    heroEyebrow: "Apache-2.0 · 自托管 · 可自由 fork",
    heroTitle: "所有模型，",
    heroAccent: "一处安放。",
    heroDescription:
      "对话、文件、工具与审计，同在一方画布。自托管，完全属于你。",
    ctaPrimary: "进入 DOUB",
    ctaSecondary: "在 GitHub 查看",
    stats: [
      { value: "14+", label: "已接入模型" },
      { value: "100%", label: "自托管" },
      { value: "Apache-2.0", label: "开源" },
    ],
    providerLabel: "同一张画布，容纳每一个值得用的模型。",
    providers: [
      "GPT-5",
      "Claude",
      "Gemini",
      "Llama",
      "Qwen",
      "DeepSeek",
      "Mistral",
      "Grok",
    ],
    productEyebrow: "产品",
    productTitle: "把一切，放进同一个安静的地方。",
    productLead:
      "模型、文件、工具与人，在同一张画布上相遇。没有什么会丢失，没有什么被隐藏。",
    features: [
      {
        title: "路由任意模型",
        body: "在前沿模型与本地模型之间随时切换。一个密钥，一张画布，不再有标签页坟场。",
      },
      {
        title: "数据只归你",
        body: "你的模型、你的密钥、你的审计日志——都在你自己的屋檐下。没有厂商锁定，没有悄悄偏向别人的默认。",
      },
      {
        title: "原生多模态",
        body: "拖入文档、图片与工具。对话始终保有它的记忆与形状。",
      },
      {
        title: "为长久而造",
        body: "采用 Apache 协议，刻意保持架构精简。部署一次，被信任很多年。",
      },
      {
        title: "开源，随你 fork",
        body: "完全开源。可审计、可分支、可自行运行——运行你工作的代码，你都能看见。",
      },
    ],
    principlesEyebrow: "为何如此构建",
    principles: [
      {
        index: "01",
        title: "为了思考。",
        body: "每一段值得发生的对话，都需要一个起点，和一个可以回去的地方。DOUB Chat 为智能留出一间安静的屋子。",
      },
      {
        index: "02",
        title: "为了长久。",
        body: "互联网总在让我们刷新、重试、重启。我们做的，是想留下来的东西。半年以后回来，这段对话依然成立。",
      },
      {
        index: "03",
        title: "为了属于你。",
        body: "你的数据、你的模型、你的审计日志。我们像钟表匠添齿轮一样添加功能——只为让机器走得更准。",
      },
    ],
    outroEyebrow: "开始",
    outroTitle: "安静地，",
    outroAccent: "始终属于你。",
    outroLead: "打开工作台，或者，阅读它的每一行源代码。",
    footerTagline: "自托管 AI 工作台，完全属于你。",
    appLabel: "安卓 App",
    navHome: "主页",
    navProduct: "产品",
    navConnect: "联系",
    supportLabel: "支持",
    rights: "© 2026 DOUB Chat · Apache License 2.0",
  },
};

const FEATURE_ICONS = [
  Waypoints,
  ShieldCheck,
  Layers,
  InfinityIcon,
  GitBranch,
] as const;

/* Bento spans, aligned with COPY.features order */
const FEATURE_SPANS = [
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
] as const;

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function CtaPair({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href="https://doub.chat"
        rel="noopener noreferrer"
        target="_blank"
        className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-100"
      >
        {primary}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </a>
      <a
        href="https://github.com/kangzyz/doub-chat"
        rel="noopener noreferrer"
        target="_blank"
        className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border-strong bg-card/40 px-6 text-sm font-medium text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:bg-card"
      >
        <GithubIcon className="size-4" />
        {secondary}
      </a>
    </div>
  );
}

function ModelRail({ providers }: { providers: string[] }) {
  const rail = ["auto", ...providers.slice(0, 4)];
  return (
    <div className="relative mt-6 flex items-center gap-2 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border-strong to-transparent"
      />
      {rail.map((p, i) => (
        <span
          key={p}
          className={
            i === 0
              ? "relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
              : "relative inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
          }
        >
          {i === 0 && <span className="size-1.5 rounded-full bg-primary" />}
          {p}
        </span>
      ))}
    </div>
  );
}

export function Landing({ locale }: { locale: Locale }) {
  const t = COPY[locale];

  return (
    <main className="relative overflow-x-clip bg-background text-foreground">
      <SiteHeader locale={locale} />

      {/* ====================== HERO ====================== */}
      <section className="relative isolate overflow-hidden">
        {/* Aurora field */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-grid" />
          <div className="aurora-blob drift-a left-[-8%] top-[-12%] size-[42rem] bg-primary/45" />
          <div className="aurora-blob drift-b right-[-10%] top-[-6%] size-[34rem] bg-cyan/35" />
          <div className="aurora-blob drift-c left-[28%] top-[18%] size-[36rem] bg-violet/35" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-14 px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:pb-28 lg:pt-44">
          {/* Copy column */}
          <div>
            <motion.a
              href="https://github.com/kangzyz/doub-chat"
              rel="noopener noreferrer"
              target="_blank"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 py-1 pl-1 pr-3 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2 py-0.5 font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                {t.heroEyebrow}
              </span>
              <ArrowUpRight className="size-3.5" aria-hidden />
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 text-[clamp(2.7rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-balance"
            >
              {t.heroTitle}{" "}
              <span className="text-aurora">{t.heroAccent}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl"
            >
              {t.heroDescription}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-9 flex flex-col items-start gap-4"
            >
              <CtaPair primary={t.ctaPrimary} secondary={t.ctaSecondary} />
              <a
                href="#android"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 py-1.5 pl-1.5 pr-3 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2 py-0.5 font-medium text-primary">
                  <Smartphone className="size-3" aria-hidden />
                  {t.appLabel}
                </span>
                <span className="tabular-nums">
                  v{ANDROID.versionName} · {ANDROID.sizeLabel}
                </span>
                <ArrowDown
                  className="size-3.5 transition-transform group-hover:translate-y-0.5"
                  aria-hidden
                />
              </a>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-7"
            >
              {t.stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-2xl font-semibold tracking-tight text-foreground">
                    {s.value}
                  </dd>
                  <dd className="mt-0.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {s.label}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Product preview */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/25 via-violet/15 to-cyan/20 blur-2xl"
            />
            <ChatPreview locale={locale} />
          </motion.div>
        </div>
      </section>

      {/* ====================== PROVIDER STRIP ====================== */}
      <section className="relative border-y border-border bg-card/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-10 sm:px-8">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t.providerLabel}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {t.providers.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-sm text-foreground/80"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== PRODUCT / FEATURES ====================== */}
      <section id="product" className="relative scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
              {t.productEyebrow}
            </p>
            <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl lg:text-5xl">
              {t.productTitle}
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {t.productLead}
            </p>
          </Reveal>

          <div className="mt-14 grid gap-4 lg:grid-cols-6">
            {t.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              const wide = i === 0;
              return (
                <Reveal
                  key={f.title}
                  delay={i * 0.05}
                  className={FEATURE_SPANS[i]}
                >
                  <article className="card-glow group flex h-full flex-col rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-colors hover:border-border-strong sm:p-7">
                    <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-background/60 text-primary transition-colors group-hover:border-primary/40">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                    {wide && <ModelRail providers={t.providers} />}
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================== ANDROID DOWNLOAD ====================== */}
      <AndroidDownload locale={locale} />

      {/* ====================== PRINCIPLES ====================== */}
      <section
        id="principles"
        className="relative scroll-mt-24 border-t border-border bg-card/20"
      >
        <div className="bg-dots opacity-[0.35]" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
              {t.principlesEyebrow}
            </p>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {t.principles.map((p, i) => (
              <Reveal key={p.index} delay={i * 0.08}>
                <div className="flex h-full flex-col bg-background p-7 sm:p-9">
                  <span className="font-mono text-sm text-muted-foreground">
                    {p.index}
                  </span>
                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                    <span className="text-aurora">{p.title}</span>
                  </h3>
                  <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== OUTRO + FOOTER ====================== */}
      <section id="connect" className="relative scroll-mt-24 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="aurora-blob drift-a left-[20%] top-[10%] size-[40rem] bg-primary/35" />
          <div className="aurora-blob drift-c right-[8%] bottom-[-10%] size-[30rem] bg-cyan/30" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 lg:pt-32">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
              — {t.outroEyebrow}
            </p>
            <h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-5xl lg:text-7xl">
              {t.outroTitle}{" "}
              <span className="text-aurora">{t.outroAccent}</span>
            </h2>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {t.outroLead}
            </p>
            <div className="mt-9">
              <CtaPair primary={t.ctaPrimary} secondary={t.ctaSecondary} />
            </div>
          </Reveal>

          {/* Footer meta */}
          <footer className="mt-24 border-t border-border pt-10">
            <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <a
                  href={`/${locale}/`}
                  className="inline-flex items-center gap-2"
                  aria-label="DOUB Chat home"
                >
                  <DoubLogo className="h-5 w-auto text-foreground" />
                  <span className="text-[15px] font-semibold tracking-tight text-muted-foreground">
                    Chat
                  </span>
                </a>
                <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                  {t.footerTagline}
                </p>
                <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <a className="transition-colors hover:text-foreground" href={`/${locale}/`}>
                    {t.navHome}
                  </a>
                  <a className="transition-colors hover:text-foreground" href="#product">
                    {t.navProduct}
                  </a>
                  <a className="transition-colors hover:text-foreground" href="#connect">
                    {t.navConnect}
                  </a>
                  <a
                    className="transition-colors hover:text-foreground"
                    href="https://github.com/kangzyz/doub-chat"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    GitHub
                  </a>
                  <a
                    className="transition-colors hover:text-foreground"
                    href="https://x.com/doubingchat"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    @doubingchat
                  </a>
                  <a
                    className="transition-colors hover:text-foreground"
                    href="https://linux.do"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    LINUX DO
                  </a>
                </nav>
                <p className="mt-5 text-xs text-muted-foreground">
                  <a
                    href="#android"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                  >
                    <Smartphone className="size-3.5" aria-hidden />
                    Android · v{ANDROID.versionName} · APK + SHA-256
                  </a>
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {t.supportLabel}
                </p>
                <a
                  className="mt-1 inline-block text-sm text-foreground transition-colors hover:text-primary"
                  href="mailto:support@doub.chat"
                >
                  support@doub.chat
                </a>
              </div>
            </div>
            <p className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t.rights}
            </p>
          </footer>
        </div>

        {/* Ghost wordmark */}
        <div aria-hidden className="pointer-events-none mt-10 select-none overflow-hidden">
          <p className="mx-auto w-full max-w-[1400px] px-5 text-[clamp(4rem,15vw,13rem)] font-semibold leading-[0.8] tracking-[-0.04em] text-foreground/[0.045]">
            DOUB <span className="text-aurora opacity-[0.4]">Chat</span>
          </p>
        </div>
      </section>
    </main>
  );
}
