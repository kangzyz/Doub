import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ThemeProvider } from "./theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://about.doub.chat"),
  title: "DOUB Chat | Every model. One quiet place.",
  description:
    "Chat, files, tools, and audit on a single canvas. DOUB Chat is an open-source, self-hosted AI workspace — route any model, keep your own data, read every line. Now on Android.",
  openGraph: {
    title: "DOUB Chat",
    description:
      "Every model. One quiet place. A self-hosted, open-source AI workspace — entirely yours.",
    type: "website",
    siteName: "DOUB Chat",
    images: [{ url: "/og/doub-og.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DOUB Chat",
    description:
      "Every model. One quiet place. A self-hosted, open-source AI workspace — entirely yours.",
    images: ["/og/doub-og.svg"],
  },
  icons: { icon: "/doub-adaptive-favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={[GeistSans.variable, GeistMono.variable].join(" ")}
      suppressHydrationWarning
    >
      <head>
        <script
          // Set the theme class before first paint to avoid a flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('doub-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
