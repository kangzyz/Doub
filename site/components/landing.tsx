"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

import { SiteHeader } from "./site-header";
import { PixelHeading } from "./pixel-heading";

type Locale = "en" | "zh";

type Chapter = {
  index: string;
  title: string;
  titleAccent: string;
  body: string[];
};

type Copy = {
  heroEyebrow: string;
  heroTitlePrefix: string;
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  heroCta: string;
  heroCtaSecondary: string;
  chapters: Chapter[];
  outroEyebrow: string;
  outroTitle: string;
  outroAccent: string;
  outroLead: string;
  navHome: string;
  navAbout: string;
  navConnect: string;
  supportLabel: string;
  rights: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    heroEyebrow: "An AI workspace · Open source",
    heroTitlePrefix: "",
    heroTitle: "Intelligence,",
    heroAccent: "refined.",
    heroDescription:
      "Bring every model into a place that lasts.",
    heroCta: "Enter DOUB Chat",
    heroCtaSecondary: "Read the source",
    chapters: [
      {
        index: "01",
        title: "Built to",
        titleAccent: "think.",
        body: [
          "Every conversation worth having needs a place to begin, and somewhere to return.",
          "DOUB Chat gives intelligence a room of its own — calm, persistent, and undeniably yours.",
          "Models, files, tools, and people meet on a single canvas. Nothing is lost. Nothing is hidden.",
        ],
      },
      {
        index: "02",
        title: "Built to",
        titleAccent: "last.",
        body: [
          "The internet asks you to refresh, retry, and renew. We built something to keep.",
          "Open source, Apache-licensed, and architecturally small on purpose.",
          "Deploy it once. Trust it for years. Six months from now, the conversation will still make sense.",
        ],
      },
      {
        index: "03",
        title: "Built to be",
        titleAccent: "yours.",
        body: [
          "Your data, your models, your audit log — all under your own roof.",
          "No vendor lock. No quiet defaults that benefit someone else. No tab graveyard.",
          "We add features the way a watchmaker adds gears: only when the machine runs more truly because of them.",
        ],
      },
    ],
    outroEyebrow: "Begin",
    outroTitle: "It begins where",
    outroAccent: "the work does.",
    outroLead:
      "Open the workspace, or read every line of code that runs it.",
    navHome: "Home",
    navAbout: "About",
    navConnect: "Connect",
    supportLabel: "Support",
    rights: "© 2026 DOUB Chat · Apache License 2.0",
  },
  zh: {
    heroEyebrow: "一个 AI 工作台 · 开源",
    heroTitlePrefix: "",
    heroTitle: "智能，",
    heroAccent: "被打磨。",
    heroDescription:
      "将每一个模型，带进一个能留很久的地方。",
    heroCta: "进入 DOUB Chat",
    heroCtaSecondary: "查看源代码",
    chapters: [
      {
        index: "01",
        title: "为了",
        titleAccent: "思考。",
        body: [
          "每一段值得发生的对话，都需要一个起点，和一个可以回去的地方。",
          "DOUB Chat 为智能留出一间安静的屋子——持续、可被信赖，且确定属于你。",
          "模型、文件、工具与人，在同一张画布上相遇。没有什么会丢失。没有什么被隐藏。",
        ],
      },
      {
        index: "02",
        title: "为了",
        titleAccent: "长久。",
        body: [
          "互联网总在让我们刷新、重试、重启。我们做的，是想留下来的东西。",
          "开源、Apache 协议、架构精简——这是有意为之。",
          "部署一次，被信任很多年。半年以后回来，这段对话依然成立。",
        ],
      },
      {
        index: "03",
        title: "为了",
        titleAccent: "属于你。",
        body: [
          "你的数据、你的模型、你的审计日志——都在你自己的屋檐下。",
          "没有厂商锁定。没有悄悄偏向别人的默认。没有越开越多的 Tab。",
          "我们像钟表匠添齿轮一样添加功能：只为让机器走得更准。",
        ],
      },
    ],
    outroEyebrow: "开始",
    outroTitle: "它从",
    outroAccent: "工作开始。",
    outroLead:
      "打开工作台，或者，阅读它的每一行源代码。",
    navHome: "主页",
    navAbout: "关于",
    navConnect: "联系",
    supportLabel: "支持",
    rights: "© 2026 DOUB Chat · Apache License 2.0",
  },
};

function CtaPair({
  primary,
  secondary,
  locale,
}: {
  primary: string;
  secondary: string;
  locale: Locale;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href="https://doub.chat"
        rel="noopener noreferrer"
        target="_blank"
        className="group inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 active:translate-y-px"
      >
        {primary}
        <ArrowUpRight
          className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden
        />
      </a>
      <a
        href="https://github.com/kangzyz/doub-chat"
        rel="noopener noreferrer"
        target="_blank"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card/40 px-5 text-sm font-medium text-foreground backdrop-blur transition hover:border-primary/40 hover:bg-card"
      >
        {secondary}
        <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <span className="sr-only">locale {locale}</span>
    </div>
  );
}

function ChapterBlock({ chapter }: { chapter: Chapter }) {
  return (
    <section className="relative border-t border-border/60">
      <div className="mx-auto grid w-full max-w-7xl px-5 sm:px-8 lg:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 xl:gap-24">
        {/* Sticky title side */}
        <div className="relative lg:py-0">
          <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:items-center">
            <div className="py-20 lg:py-0">
              <p className="font-mono text-xs tracking-[0.24em] text-muted-foreground uppercase">
                — Chapter {chapter.index}
              </p>
              <h2 className="mt-6 text-5xl leading-[0.98] font-medium tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-8xl">
                <span className="block">{chapter.title}</span>
                <span className="block font-serif italic text-primary">
                  {chapter.titleAccent}
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Scrolling paragraphs side */}
        <div className="space-y-28 py-20 sm:space-y-36 lg:space-y-[40vh] lg:py-[20vh]">
          {chapter.body.map((p, idx) => (
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-25%" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl font-serif text-2xl leading-[1.45] text-foreground/85 sm:text-3xl sm:leading-[1.4]"
            >
              <span className="font-mono text-xs tracking-[0.24em] text-muted-foreground uppercase">
                §{chapter.index}.{idx + 1}
              </span>
              <span className="mt-4 block">{p}</span>
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Landing({ locale }: { locale: Locale }) {
  const t = COPY[locale];

  return (
    <main className="relative bg-background text-foreground">
      <SiteHeader locale={locale} />

      {/* HERO */}
      <section
        id="signal"
        className="relative isolate flex min-h-[100svh] w-full items-center overflow-hidden"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-glow absolute inset-0 opacity-60" />
        </div>
        <div
          aria-hidden
          className="bg-grain pointer-events-none absolute inset-0 -z-10"
        />

        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 pt-32 pb-24 sm:px-8 sm:pt-40 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-20 lg:px-10 lg:pt-32 lg:pb-32">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs tracking-[0.18em] text-muted-foreground uppercase backdrop-blur"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              {t.heroEyebrow}
            </motion.p>

            <div className="flex flex-col gap-1 leading-[0.92]">
              <PixelHeading
                as="h1"
                mode="multi"
                autoPlay
                cycleInterval={220}
                staggerDelay={70}
                className="text-[clamp(3rem,9vw,8rem)] font-medium tracking-tight text-foreground"
              >
                {t.heroTitle}
              </PixelHeading>
              <p
                aria-hidden
                className="font-serif text-[clamp(2.75rem,8vw,7rem)] italic text-primary leading-[1.02]"
              >
                {t.heroAccent}
              </p>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-10 max-w-xl font-serif text-2xl leading-[1.4] text-foreground/75 sm:text-3xl"
            >
              {t.heroDescription}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.95 }}
              className="mt-12"
            >
              <CtaPair primary={t.heroCta} secondary={t.heroCtaSecondary} locale={locale} />
            </motion.div>
          </div>

          {/* Hero visual — concentric rings on warm card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto hidden aspect-square w-full max-w-[460px] lg:block"
          >
            <div className="absolute inset-0 rounded-[40px] border border-border/60 bg-gradient-to-br from-card via-card/85 to-accent/40 shadow-[0_40px_100px_-40px] shadow-primary/40" />
            <div className="bg-grain absolute inset-0 rounded-[40px] opacity-50" />

            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
              className="absolute inset-8 rounded-full border border-dashed border-primary/30"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="absolute inset-20 rounded-full border border-primary/25"
            />
            <div className="absolute inset-28 rounded-full bg-gradient-to-br from-primary/45 via-primary/15 to-transparent blur-2xl" />
            <div className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_70px] shadow-primary/60" />

            <div className="absolute top-6 left-6 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              D · O · U · B
            </div>
            <div className="absolute right-6 bottom-6 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              built to last
            </div>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 1.4 }}
          className="absolute bottom-10 left-1/2 hidden -translate-x-1/2 text-center sm:block"
        >
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
            ↓ Read the chapters
          </p>
        </motion.div>
      </section>

      {/* CHAPTERS */}
      <div id="about">
        {t.chapters.map((c) => (
          <ChapterBlock key={c.index} chapter={c} />
        ))}
      </div>

      {/* OUTRO */}
      <section
        id="connect"
        className="relative w-full overflow-hidden border-t border-border/60"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 50%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
          }}
        />
        <div className="bg-grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-12 px-5 py-32 sm:px-8 sm:py-40 lg:px-10 lg:py-48">
          <p className="font-mono text-xs tracking-[0.24em] text-muted-foreground uppercase">
            — {t.outroEyebrow}
          </p>

          <h2 className="text-5xl leading-[0.98] font-medium tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
            <span className="block">{t.outroTitle}</span>
            <span className="block font-serif italic text-primary">
              {t.outroAccent}
            </span>
          </h2>

          <p className="max-w-2xl font-serif text-2xl leading-[1.4] text-foreground/75 sm:text-3xl">
            {t.outroLead}
          </p>

          <CtaPair primary={t.heroCta} secondary={t.heroCtaSecondary} locale={locale} />

          {/* Bottom meta strip */}
          <div className="mt-24 grid w-full gap-10 border-t border-border/60 pt-10 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:gap-6">
              <a className="transition hover:text-foreground" href={`/${locale}/`}>{t.navHome}</a>
              <a className="transition hover:text-foreground" href={`/${locale}/#about`}>{t.navAbout}</a>
              <a className="transition hover:text-foreground" href={`/${locale}/#connect`}>{t.navConnect}</a>
              <a className="transition hover:text-foreground" href="https://github.com/kangzyz/doub-chat" rel="noopener noreferrer" target="_blank">GitHub</a>
              <a className="transition hover:text-foreground" href="https://x.com/doubingchat" rel="noopener noreferrer" target="_blank">@doubingchat</a>
              <a className="transition hover:text-foreground" href="https://linux.do" rel="noopener noreferrer" target="_blank">LINUX DO</a>
            </div>
            <div className="grid gap-1 text-right text-sm">
              <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{t.supportLabel}</p>
              <a className="text-foreground transition hover:text-primary" href="mailto:support@vexown.com">support@vexown.com</a>
            </div>
          </div>

          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">{t.rights}</p>
        </div>

        {/* Giant ghost wordmark */}
        <div aria-hidden className="pointer-events-none -mt-12 overflow-hidden select-none">
          <p className="mx-auto w-full max-w-[1400px] px-5 text-[clamp(5rem,16vw,14rem)] leading-[0.85] font-medium tracking-tighter text-foreground/[0.06]">
            DOUB <span className="font-serif italic text-primary/25">Chat</span>
          </p>
        </div>
      </section>
    </main>
  );
}
