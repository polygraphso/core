import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://polygraph.so"),
  title: {
    default:
      "polygraph.so — independent behavioral polygraphs for AI agents",
    template: "%s · polygraph.so",
  },
  description:
    "We polygraph AI agents so you don't have to. A behavioral litmus test for MCP servers — a grade backed by evidence anyone can re-run. Free public polygraphs. CLI for sub-second checks.",
  applicationName: "polygraph",
  keywords: [
    "MCP",
    "AI agents",
    "agent security",
    "MCP server evaluation",
    "behavioral testing",
    "agent trust",
    "polygraph",
  ],
  openGraph: {
    title:
      "polygraph.so — independent behavioral polygraphs for AI agents",
    description:
      "We polygraph AI agents so you don't have to. A behavioral litmus test for MCP servers — a grade backed by evidence anyone can re-run.",
    url: "https://polygraph.so",
    siteName: "polygraph.so",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "polygraph.so",
    description:
      "Independent behavioral polygraphs for AI agents and MCP servers.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Parchment — keeps mobile browser chrome on-palette.
  themeColor: "#f5f1e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col paper-grain">{children}</body>
    </html>
  );
}
