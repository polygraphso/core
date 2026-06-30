"use client";

// Persistent navigation for the admin area. Two sections today — Usage metrics
// and Grade attestations — plus sign-out and the way back to the public site.
// The rail is the one place that knows about all of them, so each page no
// longer carries its own ad-hoc links.
//
// Mirrors the SiteHeader pattern: a fixed left rail on desktop (`hidden
// sm:flex`) and a separate compact top bar below the `sm` breakpoint
// (`sm:hidden`), rather than trying to make one element be both.

type NavItem = {
  href: string;
  label: string;
  active: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Metrics", active: (p) => p === "/admin" },
  {
    href: "/admin/attestations",
    label: "Attestations",
    active: (p) => p.startsWith("/admin/attestations"),
  },
];

function Brand() {
  return (
    <a
      href="/admin"
      className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
    >
      <span className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft" aria-hidden />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
        polygraph.so
      </span>
    </a>
  );
}

function SignOut() {
  return (
    <form method="post" action="/api/admin/logout">
      <button className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-oxblood transition-colors">
        Sign out
      </button>
    </form>
  );
}

export function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Desktop — fixed left rail */}
      <aside className="hidden sm:flex sm:fixed sm:inset-y-0 sm:left-0 sm:w-56 sm:flex-col border-r border-rule bg-parchment-50">
        <div className="px-5 py-5 border-b border-rule">
          <Brand />
          <p className="section-label mt-3">Admin</p>
        </div>

        <nav className="flex-1 py-5" aria-label="Admin sections">
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
          <SignOut />
        </div>
      </aside>

      {/* Mobile — sticky top bar */}
      <div className="sm:hidden sticky top-0 z-40 border-b border-rule bg-parchment-50">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-baseline gap-3">
            <Brand />
            <span className="section-label">Admin</span>
          </div>
          <SignOut />
        </div>
        <nav className="flex border-t border-rule" aria-label="Admin sections">
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
