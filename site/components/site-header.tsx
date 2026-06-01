"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Languages, Moon, Sun } from "lucide-react";

import { useTheme } from "../app/theme-provider";
import { cn } from "../lib/cn";
import { GithubIcon } from "./icons";
import { DoubLogo } from "./logo";

type Locale = "en" | "zh";

type SiteHeaderProps = {
  locale: Locale;
};

const NAV: Record<Locale, { label: string; href: string }[]> = {
  en: [
    { label: "Product", href: "#product" },
    { label: "Get the app", href: "#android" },
    { label: "Open source", href: "#principles" },
    { label: "Connect", href: "#connect" },
  ],
  zh: [
    { label: "产品", href: "#product" },
    { label: "获取应用", href: "#android" },
    { label: "开源", href: "#principles" },
    { label: "联系", href: "#connect" },
  ],
};

export function SiteHeader({ locale }: SiteHeaderProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const altLocale: Locale = locale === "en" ? "zh" : "en";
  const altLabel = locale === "en" ? "中文" : "EN";
  const enterLabel = locale === "en" ? "Enter" : "进入";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full border px-2 pl-3 transition-all duration-300 sm:pl-4",
          scrolled
            ? "border-border-strong bg-background/80 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            : "border-border bg-background/40 backdrop-blur-md",
        )}
      >
        {/* Brand */}
        <a
          href={`/${locale}/`}
          className="group inline-flex items-center gap-2 rounded-full pr-2"
          aria-label="DOUB Chat home"
        >
          <DoubLogo className="h-[17px] w-auto text-foreground transition-opacity group-hover:opacity-80" />
          <span className="text-[15px] font-semibold tracking-tight text-muted-foreground">
            Chat
          </span>
        </a>

        {/* Center nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV[locale].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <a
            aria-label="GitHub repository"
            title="GitHub"
            href="https://github.com/kangzyz/doub-chat"
            rel="noopener noreferrer"
            target="_blank"
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground sm:inline-flex"
          >
            <GithubIcon className="size-[17px]" />
          </a>
          <a
            aria-label={altLabel === "中文" ? "切换到中文" : "Switch to English"}
            title={altLabel}
            href={`/${altLocale}/`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
          >
            <Languages className="size-4" aria-hidden />
            <span className="tabular-nums">{altLabel}</span>
          </a>
          <button
            aria-label={isDark ? "Use light mode" : "Use dark mode"}
            title="Theme"
            type="button"
            onClick={toggle}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
          >
            {isDark ? (
              <Sun className="size-[18px]" aria-hidden />
            ) : (
              <Moon className="size-[18px]" aria-hidden />
            )}
          </button>
          <a
            href="https://doub.chat"
            rel="noopener noreferrer"
            target="_blank"
            className="group ml-1 inline-flex h-9 items-center gap-1 rounded-full bg-foreground px-3.5 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-100 sm:px-4"
          >
            {enterLabel}
            <ArrowUpRight
              className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </a>
        </div>
      </nav>
    </header>
  );
}
