import type { ReactNode } from "react";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { Footer } from "@/app/_components/Footer";

// Public-pages layout: one shared content grid so every public page aligns to
// the same max-w-6xl column as the header/homepage and shares the same vertical
// rhythm. Pages render content only — prose pages wrap their body in max-w-3xl
// for a readable line length; index/table pages fill the grid.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 w-full mx-auto max-w-6xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        {children}
      </main>
      <Footer />
    </>
  );
}
