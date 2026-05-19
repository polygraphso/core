import { Hero } from "./_components/Hero";
import { Problem } from "./_components/Problem";
import { HowWeTest } from "./_components/HowWeTest";
import { WhereWeSit } from "./_components/WhereWeSit";
import { TryIt } from "./_components/TryIt";
import { GradesUpdates } from "./_components/GradesUpdates";
import { Footer } from "./_components/Footer";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <HowWeTest />
      <WhereWeSit />
      <TryIt />
      <GradesUpdates />
      <Footer />
    </main>
  );
}
