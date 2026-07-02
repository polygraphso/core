import { Hero } from "@/app/_components/Hero";
import { Problem } from "@/app/_components/Problem";
import { RecentGrades } from "@/app/_components/RecentGrades";
import { HowWeTest } from "@/app/_components/HowWeTest";
import { Install } from "@/app/_components/Install";
import { EmbedYourGrade } from "@/app/_components/EmbedYourGrade";
import { Timeline } from "@/app/_components/Timeline";
import { TokenNote } from "@/app/_components/TokenNote";
import { GradesUpdates } from "@/app/_components/GradesUpdates";

// ISR so grades published after the last deploy surface without a redeploy.
export const revalidate = 600;

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <RecentGrades />
      <HowWeTest />
      <Install />
      <EmbedYourGrade />
      <Timeline />
      <TokenNote />
      <GradesUpdates />
    </>
  );
}
