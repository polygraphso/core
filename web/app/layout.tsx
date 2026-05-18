import type { Metadata } from "next";
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
  metadataBase: new URL("https://poligrafo.ai"),
  title: {
    default: "poligrafo.ai — independent trust grade for AI agents",
    template: "%s · poligrafo.ai",
  },
  description:
    "Behavioral evaluation for MCP servers and the agents that use them. Lab-evaluated. Vendor-independent. Free public grades. CLI for runtime checks.",
  applicationName: "poligrafo",
  keywords: [
    "MCP",
    "AI agents",
    "agent security",
    "MCP server evaluation",
    "behavioral testing",
    "agent trust",
  ],
  openGraph: {
    title: "poligrafo.ai — independent trust grade for AI agents",
    description:
      "Lab-evaluated. Vendor-independent. Continuously checked. Free public grades plus a CLI for runtime checks of MCP servers.",
    url: "https://poligrafo.ai",
    siteName: "poligrafo.ai",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "poligrafo.ai",
    description:
      "Independent, lab-evaluated trust grade for AI agents and MCP servers.",
  },
  robots: { index: true, follow: true },
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
