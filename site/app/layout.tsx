import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import {
  GeistPixelCircle,
  GeistPixelGrid,
  GeistPixelLine,
  GeistPixelSquare,
  GeistPixelTriangle,
} from "geist/font/pixel";
import { Instrument_Serif } from "next/font/google";

import { ThemeProvider } from "./theme-provider";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://doub.vexown.com"),
  title: "DOUB Chat | Intelligence, refined.",
  description:
    "Bring every model into a place that lasts. An open-source AI workspace for serious teams — model routing, multimodal chat, files, tools, billing, identity, and operations.",
  openGraph: {
    title: "DOUB Chat",
    description: "Intelligence, refined. Bring every model into a place that lasts.",
    type: "website",
    siteName: "DOUB Chat",
    images: [{ url: "/og/doub-og.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DOUB Chat",
    description: "Intelligence, refined. Bring every model into a place that lasts.",
    images: ["/og/doub-og.svg"],
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={[
        GeistSans.variable,
        GeistMono.variable,
        GeistPixelSquare.variable,
        GeistPixelGrid.variable,
        GeistPixelCircle.variable,
        GeistPixelTriangle.variable,
        GeistPixelLine.variable,
        instrumentSerif.variable,
      ].join(" ")}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
