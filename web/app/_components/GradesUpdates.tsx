import { MinimalSignup } from "./MinimalSignup";

// Quiet down-page signup — one field, "notify me about new polygraphs."
// Lives here as its own block because the matrix section it used to live
// inside (§04) is pulled until real polygraphs exist.
export function GradesUpdates() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="border hairline bg-parchment-50 p-6 md:p-10 grid md:grid-cols-12 gap-6 md:gap-10 items-center">
        <div className="md:col-span-7">
          <h2 className="font-serif text-2xl md:text-3xl leading-tight text-ink">
            Get notified when polygraphs publish.
          </h2>
          <p className="mt-2 text-ink-muted">
            One email when polygraphs for the servers you care about land. No
            drip campaign, no &ldquo;hey just checking in.&rdquo;
          </p>
        </div>
        <div className="md:col-span-5">
          <MinimalSignup source="grades-updates" cta="Notify me" />
        </div>
      </div>
    </section>
  );
}
