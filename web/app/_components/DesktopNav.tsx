"use client";

import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS, type NavItem, type MegaMenu } from "./navConfig";

// The desktop primary nav: five triggers that each open a shared, centered
// mega-menu on hover or keyboard focus. SiteHeader stays a server component; this
// is the client island that owns the open/close state. Below `lg` it renders
// nothing (MobileNav handles small screens): the five mono labels + gaps run
// ~565px wide, which overflows the centered grid row until the viewport clears
// ~1024px, so the desktop nav only appears at `lg`.
//
// The panel is positioned against the <header> (the nearest positioned ancestor),
// so it drops flush under the whole navbar and stays centered regardless of which
// trigger is active — matching the Navbar Dropdowns design.

export function DesktopNav() {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const openMenu = (key: string) => {
    cancel();
    setOpen(key);
  };
  // Close on a short delay so the pointer can cross the gap from trigger to panel.
  const scheduleClose = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(null), 160);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => cancel(), []);

  const active = NAV_ITEMS.find((n) => n.key === open) ?? null;

  return (
    <div className="hidden lg:block">
      <nav
        aria-label="Primary"
        className="flex items-center gap-7 font-mono text-[12px] uppercase tracking-[0.14em]"
      >
        {NAV_ITEMS.map((item) => {
          const isOpen = open === item.key;
          return (
            <a
              key={item.key}
              href={item.href}
              aria-haspopup="true"
              aria-expanded={isOpen}
              onMouseEnter={() => openMenu(item.key)}
              onMouseLeave={scheduleClose}
              onFocus={() => openMenu(item.key)}
              onBlur={scheduleClose}
              onClick={() => setOpen(null)}
              className={`inline-flex items-center gap-1.5 py-1 transition-colors ${
                isOpen ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
              <span
                aria-hidden
                className={`text-[8px] leading-none text-ink-faint transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </a>
          );
        })}
      </nav>

      {active ? (
        <div
          className="absolute left-1/2 top-full z-40 -translate-x-1/2 pt-1.5"
          onMouseEnter={cancel}
          onMouseLeave={scheduleClose}
          onFocus={cancel}
          onBlur={scheduleClose}
        >
          <MegaPanel item={active} onNavigate={() => setOpen(null)} />
        </div>
      ) : null}
    </div>
  );
}

function extAttrs(external?: boolean) {
  return external ? { target: "_blank", rel: "noreferrer" as const } : {};
}

function MegaPanel({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const m: MegaMenu = item.menu;
  return (
    <div
      role="region"
      aria-label={item.label}
      className="panel-in grid w-[724px] max-w-[calc(100vw-2rem)] grid-cols-[1.28fr_1fr] overflow-hidden rounded-[10px] border hairline bg-parchment-50 shadow-[0_20px_44px_-14px_rgba(22,21,18,0.24),0_2px_6px_rgba(22,21,18,0.06)]"
    >
      {/* Featured column */}
      <div className="px-6 py-[22px]">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {m.featuredLabel}
        </p>
        {m.featured.map((f) => (
          <a
            key={f.title}
            href={f.href}
            onClick={onNavigate}
            {...extAttrs(f.external)}
            className="-mx-2.5 flex items-start gap-3 rounded-lg px-2.5 py-[11px] transition-colors hover:bg-[#f1ebdb]"
          >
            <span className="inline-flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[7px] border border-rule-soft bg-parchment font-mono text-[13px] font-medium text-oxblood">
              {f.glyph}
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-[16px] leading-[1.25] text-ink">
                {f.title}
              </span>
              <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-ink-muted">
                {f.desc}
              </span>
            </span>
          </a>
        ))}
      </div>

      {/* List + sub-links + CTA column */}
      <div className="flex flex-col border-l border-rule-soft bg-[#f2ecdd] px-6 py-[22px]">
        <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {m.listLabel}
        </p>
        <div className="mb-3.5">
          {m.list.map((it) => (
            <a
              key={it.name}
              href={it.href}
              onClick={onNavigate}
              {...extAttrs(it.external)}
              className="group flex items-center justify-between gap-3 border-t border-rule-soft py-2 transition-colors"
            >
              <span className="truncate font-mono text-[12.5px] text-ink transition-colors group-hover:text-oxblood">
                {it.name}
              </span>
              <span className="flex-shrink-0 font-mono text-[11px] tabular text-ink-faint transition-colors group-hover:text-oxblood">
                {it.meta ?? (it.external ? "↗" : "→")}
              </span>
            </a>
          ))}
        </div>

        {m.subLinks && m.subLinks.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-x-3.5 gap-y-[7px]">
            {m.subLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                onClick={onNavigate}
                {...extAttrs(s.external)}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-oxblood"
              >
                {s.label}
              </a>
            ))}
          </div>
        ) : null}

        <a
          href={m.cta.href}
          onClick={onNavigate}
          {...extAttrs(m.cta.external)}
          className="relative mt-auto block rounded-lg bg-oxblood px-[17px] py-[15px] transition-colors hover:bg-oxblood-soft"
        >
          <span className="block pr-6 font-serif text-[17px] leading-[1.2] text-parchment">
            {m.cta.title}
          </span>
          <span className="mt-1.5 block font-mono text-[10.5px] leading-[1.45] text-parchment/70">
            {m.cta.desc}
          </span>
          <span aria-hidden className="absolute right-4 top-[15px] text-[15px] text-parchment">
            →
          </span>
        </a>
      </div>
    </div>
  );
}
