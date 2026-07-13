import { AuthSlot } from "./AuthSlot";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

// The site header. `relative` so the desktop mega-menu panels (DesktopNav) can
// anchor to it and drop flush under the whole bar. The row is a three-column
// grid — wordmark left, primary nav dead-center, account right — so the nav
// stays centered no matter how wide the wordmark or the signed-in name gets.
export function SiteHeader() {
  return (
    <header className="relative border-b hairline">
      {/* Preprint top rule — a thin ink band above the masthead. */}
      <div className="h-2 bg-[#201d18]" aria-hidden />

      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3">
        <a href="/" className="group inline-flex items-center gap-2.5 justify-self-start">
          <span
            className="inline-block h-[9px] w-[9px] flex-shrink-0 bg-oxblood pulse-soft"
            aria-hidden
          />
          <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink transition-colors group-hover:text-oxblood">
            polygraph.so
          </span>
        </a>

        <DesktopNav />

        <div className="flex items-center justify-self-end gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          {/* Desktop shows the account slot inline; on mobile it moves into the sheet. */}
          <div className="hidden items-center sm:flex">
            <AuthSlot />
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
