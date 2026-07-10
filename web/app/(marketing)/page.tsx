import { EcosystemHero } from "@/app/_components/EcosystemHero";
import { LiveIndexes } from "@/app/_components/LiveIndexes";
import { MonitoredEcosystems } from "@/app/_components/MonitoredEcosystems";
import { WhyItHolds } from "@/app/_components/WhyItHolds";
import { HowMonitoringWorks } from "@/app/_components/HowMonitoringWorks";
import { TokenNote } from "@/app/_components/TokenNote";
import { EcosystemCta } from "@/app/_components/EcosystemCta";

// ISR so grades published after the last deploy surface without a redeploy.
// The § 01 live-index numbers read hosted_runs through the ecosystem loaders.
export const revalidate = 600;

// Ecosystem-first homepage (design direction 2a): lead with continuous
// monitoring (the revenue motion), keep the free public index as the proof/
// on-ramp, and push builder tooling out to /builders. See the workspace map.
export default function Home() {
  return (
    <>
      <EcosystemHero />
      <MonitoredEcosystems />
      <LiveIndexes />
      <WhyItHolds />
      <HowMonitoringWorks />
      <TokenNote />
      <section className="mx-auto max-w-6xl px-6 pb-20 md:pb-28">
        <EcosystemCta
          heading="Put an independent trust layer under your ecosystem."
          body="Tell us what your network ships. We'll stand up a continuous, independent trust index, graded, then re-graded on a cadence, and keep it current as you add to it."
          mailtoSubject="Monitor our ecosystem with polygraph"
          secondaryHref="/ecosystems"
          secondaryLabel="See a live index"
        />
      </section>
    </>
  );
}
