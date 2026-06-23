import { Hero } from "./_components/Hero";
import { Problem } from "./_components/Problem";
import { HowWeTest } from "./_components/HowWeTest";
import { Install } from "./_components/Install";
import { ChecksSoFar } from "./_components/ChecksSoFar";
import { EmbedYourGrade } from "./_components/EmbedYourGrade";
import { Timeline } from "./_components/Timeline";
import { TokenNote } from "./_components/TokenNote";
import { GradesUpdates } from "./_components/GradesUpdates";

// The checks browser (ChecksSoFar) and the hero's latest-grade card (HeroPolygraph)
// read published rows from hosted_runs at render time via the Supabase admin client —
// not `fetch`, so they get no per-request cache. Without a route revalidate window the
// homepage is statically generated at deploy and frozen: grades published afterwards
// only appear on the next deploy. ISR-regenerate on a timer so newly published grades
// surface without a redeploy. Matches the /mcp/[...ref] pages' 600s window.
export const revalidate = 600;

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <HowWeTest />
      <Install />
      <ChecksSoFar />
      <EmbedYourGrade />
      <Timeline />
      <TokenNote />
      <GradesUpdates />
    </main>
  );
}
