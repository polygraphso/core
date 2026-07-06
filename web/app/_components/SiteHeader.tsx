import { MobileNav } from "./MobileNav";
import { AuthSlot } from "./AuthSlot";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/index", label: "Index" },
  { href: "/#install", label: "Install" },
  { href: "/#badge", label: "Get a badge" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  return (
    <header className="relative border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
        <a href="/" className="flex items-center gap-3 hover:text-ink transition-colors">
          <span
            className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft"
            aria-hidden
          />
          <span className="text-ink">polygraph.so</span>
        </a>
        <nav className="hidden sm:flex items-center gap-5">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-ink transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <AuthSlot />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
