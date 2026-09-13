import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request a grade",
  description:
    "Hosted grading is discontinued. Existing published grades remain on the site. To grade a server yourself, run the open harness.",
  alternates: { canonical: "/request" },
  openGraph: {
    title: "Request a grade · polygraph.so",
    description:
      "Hosted grading is discontinued. Existing published grades remain on the site.",
    url: "/request",
  },
};

export default function RequestPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="section-label mb-4">Hosted grading · discontinued</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          Hosted grading is discontinued.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
          We are no longer accepting grade requests or running the operator-hosted
          battery. Existing published grades stay on the site, with the same
          evidence and the same one-command re-run.
        </p>
      </header>

      <p className="text-ink-muted leading-relaxed max-w-xl">
        To grade a server yourself, run the open harness:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink">
        <code>npx -y -p @polygraphso/litmus polygraphso-litmus litmus &lt;server&gt;</code>
      </pre>
      <p className="mt-6 text-ink-muted leading-relaxed max-w-xl">
        Setup and examples:{" "}
        <a href="/builders#install" className="text-ink border-b hairline border-dotted hover:text-oxblood">
          builders
        </a>
        . Browse what is already published on the{" "}
        <a href="/mcp-index" className="text-ink border-b hairline border-dotted hover:text-oxblood">
          index
        </a>
        .
      </p>
    </div>
  );
}
