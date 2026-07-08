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
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://polygraph.so"),
  title: {
    default: "polygraph.so: an independent trust layer for AI tools",
    template: "%s · polygraph.so",
  },
  description:
    "An independent trust layer for the MCP servers, agents, and skills your ecosystem runs on. We grade AI tools behaviorally and publish evidence anyone can re-run, then keep the grade current with continuous, per-network monitoring. Free public grades; nobody can pay for a grade.",
  applicationName: "polygraph",
  keywords: [
    "MCP",
    "AI agents",
    "Agent Skills",
    "agent security",
    "MCP server evaluation",
    "behavioral testing",
    "ecosystem monitoring",
    "agent trust",
    "polygraph",
  ],
  openGraph: {
    title: "polygraph.so: an independent trust layer for AI tools",
    description:
      "Independent, continuously re-graded trust indexes for the MCP servers, agents, and skills a network ships. Behavioral grades backed by evidence anyone can re-run. Nobody can pay for a grade.",
    url: "https://polygraph.so",
    siteName: "polygraph.so",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "polygraph.so",
    description:
      "An independent trust layer for AI tools: behavioral grades for MCP servers and skills, kept current with per-network monitoring. Grades anyone can re-run; nobody can pay for one.",
  },
  robots: { index: true, follow: true },
  verification: {
    other: {
      "talentapp:project_verification":
        "2626516e5949995e1f2465ca00631341262f9e478e95f210086d950d55e1bd88a5a836619dae5bef591b7d80cbfeeefc858c13480e5db5a5683820493fd17629",
    },
  },
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
      <body className="min-h-full flex flex-col paper-grain">
        {children}
      </body>
    </html>
  );
}
