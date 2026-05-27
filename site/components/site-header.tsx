"use client";

import { ArrowUpRight, Languages, Moon, Sun } from "lucide-react";
import { useTheme } from "../app/theme-provider";

type SiteHeaderProps = {
  locale: "en" | "zh";
};

export function SiteHeader({ locale }: SiteHeaderProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const altLocale = locale === "en" ? "zh" : "en";
  const altLabel = locale === "en" ? "中文" : "EN";
  const contactLabel = locale === "en" ? "Contact" : "联系";

  return (
    <header className="fixed inset-x-0 top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-20 sm:px-8 lg:px-10">
        <a
          href={`/${locale}/`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 backdrop-blur-md transition hover:border-primary/40 hover:bg-card sm:h-11"
        >
          <span className="size-2 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
          <span className="font-serif text-lg italic tracking-tight text-foreground sm:text-xl">
            DOUB
          </span>
          <span className="hidden text-xs tracking-[0.18em] text-muted-foreground sm:inline">
            AI
          </span>
        </a>
        <div className="flex items-center gap-2">
          <a
            aria-label={altLabel}
            title={altLabel}
            href={`/${altLocale}/`}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border/50 bg-card/70 text-muted-foreground backdrop-blur-md transition hover:border-primary/40 hover:text-foreground"
          >
            <Languages className="size-4" aria-hidden />
          </a>
          <button
            aria-label={isDark ? "Use light mode" : "Use dark mode"}
            title="Theme"
            type="button"
            onClick={toggle}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border/50 bg-card/70 text-muted-foreground backdrop-blur-md transition hover:border-primary/40 hover:text-foreground"
          >
            {isDark ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
          </button>
          <a
            className="hidden h-9 items-center gap-2 rounded-full border border-border/50 bg-card/70 px-4 text-sm font-medium text-foreground backdrop-blur-md transition hover:border-primary/40 hover:bg-primary/5 sm:inline-flex"
            href="mailto:support@doub.chat"
          >
            {contactLabel}
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
