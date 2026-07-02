import type { ReactNode } from "react";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { Footer } from "@/app/_components/Footer";

// Homepage layout: full-bleed main so marketing sections can run their own
// max-w-6xl centering and full-width divider strips.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
