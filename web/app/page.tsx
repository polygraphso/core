import { Hero } from "./_components/Hero";
import { Problem } from "./_components/Problem";
import { HowWeTest } from "./_components/HowWeTest";
import { ChecksSoFar } from "./_components/ChecksSoFar";
import { Timeline } from "./_components/Timeline";
import { ProofAndFunding } from "./_components/ProofAndFunding";
import { GradesUpdates } from "./_components/GradesUpdates";
import { Footer } from "./_components/Footer";

// launch/2026-06 homepage: ProofAndFunding (the token/funding section)
// returns at launch — this branch IS the launch-day state and merges then.
export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <HowWeTest />
      <ChecksSoFar />
      <Timeline />
      <ProofAndFunding />
      <GradesUpdates />
      <Footer />
    </main>
  );
}
