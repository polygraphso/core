import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand kit",
  description:
    "Logos, colors, and typography for polygraph.so. SVGs are source-of-truth; PNGs are ready-to-use exports.",
  alternates: { canonical: "/brand-kit" },
  openGraph: {
    title: "Brand kit · polygraph.so",
    description:
      "Logos, colors, and typography for polygraph.so. SVGs are source-of-truth; PNGs are ready-to-use exports.",
    url: "/brand-kit",
  },
};

function Section({
  num,
  label,
  children,
  id,
}: {
  num: string;
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16 first:mt-0 scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
          {num}
        </span>
        <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight">
          {label}
        </h2>
      </div>
      <div className="space-y-4 text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}

function DownloadLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      download
      className="font-mono text-[11.5px] text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
    >
      {children}
    </a>
  );
}

const CORE_COLORS = [
  { name: "Ink", hex: "#161512", token: "--color-ink" },
  { name: "Parchment", hex: "#f5f1e5", token: "--color-parchment" },
  { name: "Oxblood", hex: "#7a1f2b", token: "--color-oxblood" },
  { name: "Ink muted", hex: "#5c5550", token: "--color-ink-muted" },
  { name: "Ink faint", hex: "#8a8378", token: "--color-ink-faint" },
  { name: "Rule", hex: "#d9d2c2", token: "--color-rule" },
];

const GRADE_COLORS = [
  { name: "Grade A", hex: "#2f5132", token: "--color-grade-a" },
  { name: "Grade B", hex: "#4f6b36", token: "--color-grade-b" },
  { name: "Grade C", hex: "#a86b19", token: "--color-grade-c" },
  { name: "Grade D", hex: "#b85024", token: "--color-grade-d" },
  { name: "Grade F", hex: "#7a1f2b", token: "--color-grade-f" },
];

function Swatch({
  name,
  hex,
  token,
}: {
  name: string;
  hex: string;
  token: string;
}) {
  return (
    <div className="border hairline bg-parchment-50">
      <div className="h-16" style={{ background: hex }} />
      <div className="px-3 py-2.5 space-y-0.5">
        <div className="font-sans text-[13px] text-ink">{name}</div>
        <div className="font-mono text-[11px] text-ink-muted tabular uppercase">
          {hex}
        </div>
        <div className="font-mono text-[10.5px] text-ink-faint">{token}</div>
      </div>
    </div>
  );
}

export default function BrandKitPage() {
  return (
      <article className="mx-auto max-w-3xl">
        <header className="mb-14">
          <p className="section-label mb-4">Brand kit · assets &amp; basics</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Brand kit
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Logos, colors, and type for polygraph.so. SVGs are the
            source-of-truth; PNGs are ready-to-use exports. Use the marks as-is
            — don&rsquo;t recolor or redraw them.
          </p>
        </header>

        <Section num="01" label="Logo" id="logo">
          <p>
            The logomark is a polygraph trace — calm baseline, spike cluster,
            calm baseline — with an oxblood pulse at the left. The wordmark
            pairs it with &ldquo;polygraph.so&rdquo; set in Source Serif 4.
          </p>
          <figure className="border hairline bg-parchment grid sm:grid-cols-2">
            <div className="flex items-center justify-center p-10 border-b sm:border-b-0 sm:border-r hairline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/mark.svg"
                alt="polygraph logomark"
                width={112}
                height={112}
              />
            </div>
            <div className="flex items-center justify-center p-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/wordmark.svg"
                alt="polygraph.so wordmark"
                className="w-full max-w-[260px] h-auto"
              />
            </div>
          </figure>

          <dl className="mt-2 space-y-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <dt className="font-sans text-ink w-24 shrink-0">Logomark</dt>
              <dd className="flex flex-wrap gap-x-4 gap-y-1">
                <DownloadLink href="/brand/mark.svg">SVG</DownloadLink>
                <DownloadLink href="/brand/mark.png">PNG 1024</DownloadLink>
                <DownloadLink href="/brand/mark-512.png">PNG 512</DownloadLink>
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <dt className="font-sans text-ink w-24 shrink-0">Wordmark</dt>
              <dd className="flex flex-wrap gap-x-4 gap-y-1">
                <DownloadLink href="/brand/wordmark.svg">SVG</DownloadLink>
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <dt className="font-sans text-ink-muted w-24 shrink-0">
                Social preview
              </dt>
              <dd className="flex flex-wrap gap-x-4 gap-y-1">
                <DownloadLink href="/brand/social-preview.svg">SVG</DownloadLink>
                <DownloadLink href="/brand/social-preview.png">
                  PNG 1280×640
                </DownloadLink>
              </dd>
            </div>
          </dl>
        </Section>

        <Section num="02" label="Color" id="color">
          <p>
            The core palette: warm parchment ground, ink text, oxblood accent.
            Hex values and CSS variables match{" "}
            <code className="font-mono text-[0.92em] text-ink">
              web/app/globals.css
            </code>
            .
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CORE_COLORS.map((c) => (
              <Swatch key={c.token} {...c} />
            ))}
          </div>
          <p className="pt-2">
            The grade scale — the letters A&ndash;F carry their own muted,
            journal-appropriate colors.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {GRADE_COLORS.map((c) => (
              <Swatch key={c.token} {...c} />
            ))}
          </div>
        </Section>

        <Section num="03" label="Typography" id="type">
          <p>
            Three families: a transitional serif for display, a humanist sans
            for body and UI, and a mono for labels and code.
          </p>
          <div className="border hairline bg-parchment-50">
            <div className="p-6 border-b hairline">
              <div className="section-label mb-3">
                Source Serif 4 · display / headings
              </div>
              <p className="font-serif text-3xl text-ink leading-tight">
                Independent trust grades for AI tools
              </p>
            </div>
            <div className="p-6 border-b hairline">
              <div className="section-label mb-3">
                IBM Plex Sans · body / UI
              </div>
              <p className="font-sans text-lg text-ink leading-relaxed">
                A behavioral evaluation of an MCP server — what it does when
                exercised the way an agent would, not what its README says.
              </p>
            </div>
            <div className="p-6">
              <div className="section-label mb-3">
                IBM Plex Mono · labels / code
              </div>
              <p className="font-mono text-base text-ink">
                npx polygraphso check &lt;server&gt;
              </p>
            </div>
          </div>
        </Section>

        <Section num="04" label="See also" id="see-also">
          <ul className="list-none space-y-1">
            <li>
              <a
                href="/"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                polygraph.so — the polygraphs
              </a>
            </li>
            <li>
              <a
                href="/methodology"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                Methodology — the litmus test
              </a>
            </li>
            <li>
              <a
                href="/docs/api"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                HTTP API — query published polygraphs
              </a>
            </li>
          </ul>
        </Section>
      </article>
  );
}
