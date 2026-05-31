import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { ChatFontProvider } from "@/features/layouts/components/providers/chat-font-provider";
import { SelectionToolbar } from "@/features/layouts/components/sections/selection-toolbar";
import { WorkspaceShell } from "@/features/layouts/components/sections/workspace-shell";
import { AppI18nProvider } from "@/i18n/app-i18n-provider";
import { DevtoolsBrandBanner } from "@/shared/components/devtools-brand-banner";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { WebVitals } from "@/shared/observability/web-vitals";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const webVitalsEnabled = process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG === "true";
const initialDocumentStyle = {
  backgroundColor: "#171717",
  colorScheme: "dark",
} as const;
const initialBodyStyle = {
  backgroundColor: "#171717",
} as const;
const themeBootstrapStyle = `
:where(html.dark-safe, html.dark-safe body, html.dark-safe #__next, html.dark-safe #root, html.dark-safe #app, html.dark-safe [data-nextjs-root]) {
  background: #171717;
  color: #dedbd2;
  color-scheme: dark;
}
:where(html.dark-safe.light, html.dark-safe.light body, html.dark-safe.light #__next, html.dark-safe.light #root, html.dark-safe.light #app, html.dark-safe.light [data-nextjs-root]) {
  background: #faf9f4;
  color: #5a5347;
  color-scheme: light;
}
@media (prefers-color-scheme: light) {
  :where(html.dark-safe:not(.dark), html.dark-safe:not(.dark) body, html.dark-safe:not(.dark) #__next, html.dark-safe:not(.dark) #root, html.dark-safe:not(.dark) #app, html.dark-safe:not(.dark) [data-nextjs-root]) {
    background: #faf9f4;
    color: #5a5347;
    color-scheme: light;
  }
}
:where(html.dark-safe.dark, html.dark-safe.dark body, html.dark-safe.dark #__next, html.dark-safe.dark #root, html.dark-safe.dark #app, html.dark-safe.dark [data-nextjs-root]) {
  background: #171717;
  color: #dedbd2;
  color-scheme: dark;
}
`;
const themeInitScript = `
(function() {
  try {
    var root = document.documentElement;
    var theme = "system";
    var preset = "default";
    var storedTheme = null;
    var storedPreset = null;
    try {
      storedTheme = window.localStorage.getItem("theme");
    } catch (_) {}
    try {
      storedPreset = window.localStorage.getItem("theme-preset");
    } catch (_) {}
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      theme = storedTheme;
    }
    if (
      storedPreset === "default" ||
      storedPreset === "azure" ||
      storedPreset === "cobalt" ||
      storedPreset === "graphite" ||
      storedPreset === "lagoon" ||
      storedPreset === "ink" ||
      storedPreset === "ochre" ||
      storedPreset === "sepia"
    ) {
      preset = storedPreset;
    }
    var resolvedTheme = theme === "dark" ? "dark" : "light";
    if (theme === "system") {
      try {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch (_) {
        resolvedTheme = "light";
      }
    }
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.dataset.theme = preset;
    root.style.backgroundColor = resolvedTheme === "dark" ? "#171717" : "#faf9f4";
    root.style.color = resolvedTheme === "dark" ? "#dedbd2" : "#5a5347";
    root.style.colorScheme = resolvedTheme;
  } catch (_) {}
})();
`;

export const metadata: Metadata = {
  title: "DOUB Chat",
  description: "DOUB Chat is a multi-model AI conversation system.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark-safe" style={initialDocumentStyle} suppressHydrationWarning>
      <head>
        <style id="doub-theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeBootstrapStyle }} />
        <Script
          id="doub-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full min-h-svh overflow-hidden antialiased`}
        style={initialBodyStyle}
      >
        <AppI18nProvider>
          <ThemeProvider>
            <ChatFontProvider>
              <WorkspaceShell>{children}</WorkspaceShell>
              <Toaster />
              <SelectionToolbar />
              {webVitalsEnabled ? <WebVitals /> : null}
              <DevtoolsBrandBanner />
            </ChatFontProvider>
          </ThemeProvider>
        </AppI18nProvider>
      </body>
    </html>
  );
}
