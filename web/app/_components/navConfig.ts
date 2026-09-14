// The primary-nav model, shared by the desktop mega-menus (DesktopNav) and the
// mobile accordion (MobileNav). Pure data so it can be imported into client
// components — it must not pull in any `server-only` module.
//
// Every href points at a real destination (a page or a verified in-page anchor).
// The meta column carries honest descriptors only (a CLI verb, a format), never
// invented counts or grades — see core/CLAUDE.md on not fabricating metrics.

export interface MenuLink {
  name: string;
  href: string;
  /** Optional right-aligned descriptor (e.g. "npx", "REST"). Never a metric. */
  meta?: string;
  external?: boolean;
}

export interface FeaturedLink {
  /** Short mono glyph shown in the tile (e.g. "◇", "IX", "01"). */
  glyph: string;
  title: string;
  desc: string;
  href: string;
  external?: boolean;
}

export interface SubLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface MegaMenu {
  featuredLabel: string;
  featured: FeaturedLink[];
  listLabel: string;
  list: MenuLink[];
  subLinks?: SubLink[];
  cta: { title: string; desc: string; href: string; external?: boolean };
}

export interface NavItem {
  key: string;
  label: string;
  /** Where the trigger navigates on click / Enter. */
  href: string;
  menu: MegaMenu;
}

const GITHUB = "https://github.com/polygraphso";
const NPM = "https://www.npmjs.com/package/@polygraphso/litmus";
const GLAMA = "https://glama.ai/mcp/servers/polygraphso/litmus";

// $POLYGRAPH on Base. Address hardcoded to match TokenNote/Footer — importing it
// from lib/paymentConfig would pull that module's Sablier ABI fragments into the
// nav bundle (shipped on every page) for no benefit. It's public and stable.
const TOKEN_ADDR = "0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3";
const BANKR = `https://bankr.bot/discover/${TOKEN_ADDR}`;
const BASESCAN = `https://basescan.org/token/${TOKEN_ADDR}`;
const DEXSCREENER = `https://dexscreener.com/base/${TOKEN_ADDR}`;

export const NAV_ITEMS: NavItem[] = [
  {
    key: "ecosystems",
    label: "Ecosystems",
    href: "/ecosystems",
    menu: {
      featuredLabel: "The ledger",
      featured: [
        {
          glyph: "◇",
          title: "Ecosystem monitoring",
          desc: "Continuously re-graded trust indexes for a whole network.",
          href: "/ecosystems",
        },
        {
          glyph: "+",
          title: "Request an ecosystem",
          desc: "A curated public page for the tools your network ships.",
          href: "/ecosystems#get-monitored",
        },
      ],
      listLabel: "Live networks",
      list: [
        { name: "Base network", href: "/base" },
        { name: "Virtuals Protocol", href: "/virtuals" },
        { name: "Bankr ecosystem", href: "/bankr" },
        { name: "Uniswap builder skills", href: "/uniswap" },
        { name: "ClawHub registry", href: "/clawhub" },
        { name: "skills.sh directory", href: "/skills-sh" },
      ],
      subLinks: [{ label: "All networks", href: "/ecosystems" }],
      cta: {
        title: "Run your own network",
        desc: "Ecosystem monitoring, continuously re-graded.",
        href: "/ecosystems#get-monitored",
      },
    },
  },
  {
    key: "index",
    label: "Index",
    href: "/mcp-index",
    menu: {
      featuredLabel: "Browse",
      featured: [
        {
          glyph: "IX",
          title: "MCP Security Index",
          desc: "Every graded server, A to F, backed by re-runnable evidence.",
          href: "/mcp-index",
        },
        {
          glyph: "SK",
          title: "Skills, graded",
          desc: "Agent skills scanned for safety on the same open harness.",
          href: "/mcp-index#skills",
        },
      ],
      listLabel: "Get graded",
      list: [
        { name: "Run the harness", href: "/builders#install" },
        { name: "Monitor a server", href: "/monitor" },
      ],
      subLinks: [
        { label: "GitHub", href: GITHUB, external: true },
        { label: "npm", href: NPM, external: true },
        { label: "Glama", href: GLAMA, external: true },
      ],
      cta: {
        title: "Grade a server yourself",
        desc: "Hosted grading is discontinued. Run the open harness locally.",
        href: "/builders#install",
      },
    },
  },
  {
    key: "builders",
    label: "Builders",
    href: "/builders",
    menu: {
      featuredLabel: "Get started",
      featured: [
        {
          glyph: "01",
          title: "Install & run",
          desc: "Run polygraph in your agent, or grade a server from your terminal.",
          href: "/builders#install",
        },
        {
          glyph: "02",
          title: "Gate your CI",
          desc: "Fail a build when a tool grades D/F.",
          href: "/builders#gate",
        },
        {
          glyph: "03",
          title: "Get a badge",
          desc: "Show your live grade where developers look.",
          href: "/builders#badge",
        },
        {
          glyph: "04",
          title: "Manual setup",
          desc: "One config, every MCP client.",
          href: "/builders#manual",
        },
      ],
      listLabel: "Reference",
      list: [
        { name: "litmus CLI", href: "/builders#install", meta: "npx" },
        { name: "API docs", href: "/docs/api", meta: "REST" },
        { name: "GitHub Action", href: "/builders#gate", meta: "v1" },
        { name: "Brand kit", href: "/brand-kit", meta: "svg" },
      ],
      subLinks: [
        { label: "GitHub", href: GITHUB, external: true },
        { label: "npm", href: NPM, external: true },
        { label: "Glama", href: GLAMA, external: true },
      ],
      cta: {
        title: "Grade a server",
        desc: "npx @polygraphso/litmus litmus <server>",
        href: "/builders#install",
      },
    },
  },
  {
    key: "methodology",
    label: "Methodology",
    href: "/methodology",
    menu: {
      featuredLabel: "The method",
      featured: [
        {
          glyph: "◎",
          title: "How grading works",
          desc: "Behavioral tests, reproducible, evidence anyone can re-run.",
          href: "/methodology#what",
        },
        {
          glyph: "≡",
          title: "The A–F scale",
          desc: "What each grade means, and how thresholds are set.",
          href: "/methodology#rubric",
        },
      ],
      listLabel: "Read more",
      list: [
        { name: "Checks & probes", href: "/methodology#checks" },
        { name: "Reproducibility", href: "/methodology#reproducibility" },
        { name: "Threat model & limits", href: "/methodology#limits" },
        { name: "Skills grading", href: "/methodology#skills" },
      ],
      subLinks: [
        { label: "Versioning", href: "/methodology#versioning" },
        { label: "See also", href: "/methodology#see-also" },
        { label: "Blog", href: "/blog" },
      ],
      cta: {
        title: "Read the methodology",
        desc: "Independent, reproducible, no pay-for-grade.",
        href: "/methodology",
      },
    },
  },
  {
    key: "token",
    label: "$POLYGRAPH",
    // Trigger click → the on-site funding explainer (TokenNote, id="funding").
    href: "/#funding",
    menu: {
      featuredLabel: "The token",
      featured: [
        {
          glyph: "◈",
          title: "How it funds grading",
          desc: "Bankr's community launched it; we claim the dev fees and the work stays free to read.",
          href: "/#funding",
        },
        {
          glyph: "▤",
          title: "Transparency & revenue",
          desc: "Team vesting, treasury, and booked revenue, read live onchain.",
          href: "/transparency",
        },
        {
          glyph: "⇄",
          title: "Acquire on Bankr",
          desc: "View and swap $POLYGRAPH on Base.",
          href: BANKR,
          external: true,
        },
      ],
      listLabel: "On-chain",
      list: [
        { name: "Transparency & revenue", href: "/transparency", meta: "onchain" },
        { name: "Contract", href: BASESCAN, meta: "Basescan", external: true },
        { name: "Price chart", href: DEXSCREENER, meta: "chart", external: true },
        { name: "Pay with $POLYGRAPH", href: "/pricing", meta: "pricing" },
      ],
      subLinks: [
        { label: "Why we're paid in the token", href: "/blog/paid-in-the-token" },
        {
          label: "Funding open source",
          href: "/blog/open-source-needs-new-funding-mechanisms",
        },
        { label: "Funding note", href: "/#funding" },
      ],
      cta: {
        title: "View $POLYGRAPH on Bankr",
        desc: "It funds the work; it doesn't move a grade.",
        href: BANKR,
        external: true,
      },
    },
  },
];
