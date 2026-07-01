"use client";

import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

type NavItem = {
  href: string;
  label: string;
  active: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Monitors", active: (p) => p === "/dashboard" || p.startsWith("/dashboard/monitors") },
  { href: "/dashboard/alerts", label: "Alerts", active: (p) => p.startsWith("/dashboard/alerts") },
  { href: "/dashboard/account", label: "Account", active: (p) => p.startsWith("/dashboard/account") },
];

function Brand() {
  return (
    <a
      href="/dashboard"
      className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
    >
      <span className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft" aria-hidden />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
        polygraph.so
      </span>
    </a>
  );
}

export function DashboardSidebar({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Desktop — fixed left rail */}
      <aside className="hidden sm:flex sm:fixed sm:inset-y-0 sm:left-0 sm:w-56 sm:flex-col border-r border-rule bg-parchment-50">
        <div className="px-5 py-5 border-b border-rule">
          <Brand />
          <p className="section-label mt-3">Dashboard</p>
        </div>

        <nav className="flex-1 py-5" aria-label="Dashboard sections">
          {NAV.map((item) => {
            const active = item.active(pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block border-l-2 pl-[18px] pr-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-oxblood text-ink bg-oxblood/5"
                    : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/[0.03]"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="px-5 py-5 border-t border-rule flex flex-col gap-3">
          <a
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-oxblood transition-colors"
          >
            View site ↗
          </a>
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile — sticky top bar */}
      <div className="sm:hidden sticky top-0 z-40 border-b border-rule bg-parchment-50">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-baseline gap-3">
            <Brand />
            <span className="section-label">Dashboard</span>
          </div>
          <SignOutButton />
        </div>
        <nav className="flex border-t border-rule" aria-label="Dashboard sections">
          {NAV.map((item) => {
            const active = item.active(pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 text-center border-b-2 py-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-oxblood text-ink bg-oxblood/5"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
