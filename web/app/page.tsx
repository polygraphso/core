import { Hero } from "./_components/Hero";
import { Problem } from "./_components/Problem";
import { RecentGrades } from "./_components/RecentGrades";
import { HowWeTest } from "./_components/HowWeTest";
import { Install } from "./_components/Install";
import { EmbedYourGrade } from "./_components/EmbedYourGrade";
import { Timeline } from "./_components/Timeline";
import { TokenNote } from "./_components/TokenNote";
import { GradesUpdates } from "./_components/GradesUpdates";

// ISR so grades published after the last deploy surface without a redeploy.
export const revalidate = 600;

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <RecentGrades />
      <HowWeTest />
      <Install />
      <EmbedYourGrade />
      <Timeline />
      <TokenNote />
      <GradesUpdates />
    </main>
  );
}
