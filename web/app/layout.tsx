import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/SiteHeader";
import { Footer } from "./_components/Footer";

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
    default: "polygraph.so — behavioral polygraphs for AI agents",
    template: "%s · polygraph.so",
  },
  description:
    "We polygraph AI tools so you don't have to. A behavioral litmus test for MCP servers — a grade backed by evidence anyone can re-run. No graded party pays us. Free public polygraphs; CLI for sub-second checks.",
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
    title: "polygraph.so — behavioral polygraphs for AI agents",
    description:
      "We polygraph AI tools so you don't have to. A behavioral litmus test for MCP servers — a grade backed by evidence anyone can re-run.",
    url: "https://polygraph.so",
    siteName: "polygraph.so",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "polygraph.so",
    description:
      "Behavioral polygraphs for AI agents and MCP servers — grades anyone can re-run. No graded party pays us.",
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
        <SiteHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
