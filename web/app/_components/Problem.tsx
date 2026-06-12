import { SectionHeader } from "./SectionHeader";

export function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader number="§ 01" label="The problem" />
      <div className="grid md:grid-cols-12 gap-10 md:gap-16">
        <div className="md:col-span-8">
          {/* The hero subhead now states the problem — this section keeps
              only the headline and the three sharp points beside it. */}
          <p className="font-serif text-2xl md:text-[28px] leading-snug text-ink max-w-3xl">
            The MCP ecosystem grew faster than anyone&rsquo;s ability to polygraph it.
          </p>
          <p className="mt-6 text-ink-muted text-lg leading-relaxed max-w-2xl">
            You need evidence anyone can check.
          </p>
        </div>
        <aside className="md:col-span-4">
          <ul className="border-l hairline pl-5 space-y-4 text-ink-muted">
            <li className="flex items-baseline gap-3 text-sm leading-relaxed">
              <span className="font-mono text-ink-faint shrink-0">a.</span>
              <span>README claims aren&rsquo;t evidence. Behavior is.</span>
            </li>
            <li className="flex items-baseline gap-3 text-sm leading-relaxed">
              <span className="font-mono text-ink-faint shrink-0">b.</span>
              <span>
                Popular doesn&rsquo;t mean safe.{" "}
                <em>Top-of-leaderboard</em> can still leak secrets.
              </span>
            </li>
            <li className="flex items-baseline gap-3 text-sm leading-relaxed">
              <span className="font-mono text-ink-faint shrink-0">c.</span>
              <span>
                The labs shipping the agents are the wrong place to ask
                &ldquo;is it safe?&rdquo;
              </span>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
