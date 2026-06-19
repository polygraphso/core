import { Hero } from "./_components/Hero";
import { Problem } from "./_components/Problem";
import { HowWeTest } from "./_components/HowWeTest";
import { Install } from "./_components/Install";
import { ChecksSoFar } from "./_components/ChecksSoFar";
import { Timeline } from "./_components/Timeline";
import { TokenNote } from "./_components/TokenNote";
import { GradesUpdates } from "./_components/GradesUpdates";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <HowWeTest />
      <Install />
      <ChecksSoFar />
      <Timeline />
      <TokenNote />
      <GradesUpdates />
    </main>
  );
}
