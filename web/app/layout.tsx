import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site";
import { JsonLd } from "@/app/_components/JsonLd";
import { WindDownBanner } from "@/app/_components/WindDownBanner";
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
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "polygraph.so: an independent trust layer for AI tools",
    template: "%s · polygraph.so",
  },
  // Kept under ~155 chars: SERP snippets truncate past that, and the old
  // 278-char version lost its independence claim to the ellipsis.
  description:
    "Independent A-to-F behavioral security grades for MCP servers, agents, and skills, backed by evidence anyone can re-run. Nobody can pay for a grade.",
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
  // No title/description/url here: those fall back to each page's own
  // metadata, so subpages stop inheriting the homepage's og/twitter copy
  // (pre-2026-07 every subpage shared one og:title and og:url).
  openGraph: {
    siteName: "polygraph.so",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
  verification: {
    other: {
      "talentapp:project_verification":
        "2626516e5949995e1f2465ca00631341262f9e478e95f210086d950d55e1bd88a5a836619dae5bef591b7d80cbfeeefc858c13480e5db5a5683820493fd17629",
    },
  },
};

// Entity grounding for search engines and LLMs: who publishes this site and
// where else it lives. Sitewide by design — Organization/WebSite are the two
// types Google reads from any page.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#org`,
      name: "polygraph",
      url: SITE_ORIGIN,
      // Google's logo feature needs a determinable size >=112px; the 32x32-viewBox
      // SVG fails that check, so point at the 512px raster from the brand kit.
      logo: `${SITE_ORIGIN}/brand/mark-512.png`,
      description:
        "Independent, lab-evaluated trust grades for MCP servers, agents, and skills. Behavioral grades backed by evidence anyone can re-run; nobody can pay for a grade.",
      email: "hello@polygraph.so",
      sameAs: ["https://x.com/polygraphso", "https://github.com/polygraphso"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      name: "polygraph.so",
      url: SITE_ORIGIN,
      publisher: { "@id": `${SITE_ORIGIN}/#org` },
    },
  ],
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
        <JsonLd data={siteJsonLd} />
        {/* Above every masthead — public, marketing, and the dashboard shell. */}
        <WindDownBanner />
        {children}
      </body>
    </html>
  );
}
