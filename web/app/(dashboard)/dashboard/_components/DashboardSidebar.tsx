"use client";

import { SignOutButton } from "./SignOutButton";

type NavItem = {
  href: string;
  label: string;
  active: (pathname: string) => boolean;
  external?: boolean;
};

const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Monitors", active: (p) => p === "/dashboard" || p.startsWith("/dashboard/monitors") },
];

// Shown only to app admins and users who belong to at least one ecosystem — a
// plain user with no ecosystem never sees a dead-end "Manage" tab.
const MANAGE_NAV: NavItem = { href: "/manage", label: "Manage", active: (p) => p.startsWith("/manage") };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Metrics", active: (p) => p === "/admin" },
  { href: "/admin/attestations", label: "Attestations", active: (p) => p.startsWith("/admin/attestations") },
  { href: "/admin/twitter", label: "Twitter", active: (p) => p.startsWith("/admin/twitter") },
  { href: "/admin/users", label: "Users", active: (p) => p.startsWith("/admin/users") },
  { href: "/admin/monitors", label: "All monitors", active: (p) => p.startsWith("/admin/monitors") },
  { href: "/admin/ecosystems", label: "Ecosystems", active: (p) => p.startsWith("/admin/ecosystems") },
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

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.active(pathname);
  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`block border-l-2 pl-[18px] pr-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "border-oxblood text-ink bg-oxblood/5"
          : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/[0.03]"
      }`}
    >
      {item.label}
      {item.external && (
        <span aria-hidden className="ml-1 text-ink-faint">↗</span>
      )}
    </a>
  );
}

interface Props {
  pathname: string;
  isAdmin: boolean;
  showManage: boolean;
}

export function DashboardSidebar({ pathname, isAdmin, showManage }: Props) {
  const userNav = showManage ? [...USER_NAV, MANAGE_NAV] : USER_NAV;
  return (
    <>
      {/* Desktop — fixed left rail */}
      <aside className="hidden sm:flex sm:fixed sm:inset-y-0 sm:left-0 sm:w-56 sm:flex-col border-r border-rule bg-parchment-50">
        <div className="px-5 py-5 border-b border-rule">
          <Brand />
        </div>

        <nav className="flex-1 py-5 overflow-y-auto" aria-label="Dashboard sections">
          {userNav.map((item) =>(
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {isAdmin && (
            <>
              <p className="px-5 pt-5 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Admin
              </p>
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </>
          )}
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
          <Brand />
          <SignOutButton />
        </div>
        <nav className="flex border-t border-rule overflow-x-auto" aria-label="Dashboard sections">
          {userNav.map((item) =>{
            const active = item.active(pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 text-center border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-oxblood text-ink bg-oxblood/5"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
              </a>
            );
          })}
          {isAdmin && ADMIN_NAV.map((item) => {
            const active = item.active(pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 text-center border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-oxblood text-ink bg-oxblood/5"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
                {item.external && <span aria-hidden className="ml-1 text-ink-faint">↗</span>}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
