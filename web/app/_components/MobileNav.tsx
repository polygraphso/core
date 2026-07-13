"use client";

import { useEffect, useState } from "react";
import { NAV_ITEMS } from "./navConfig";

// Mobile menu for the header — the desktop mega-menus are `hidden sm:block`, so
// below the sm breakpoint this is the only navigation. Each primary item is an
// accordion: tap the label to go to its section, or the chevron to expand the
// same links the desktop dropdown shows. SiteHeader stays a server component.

function extAttrs(external?: boolean) {
  return external ? { target: "_blank", rel: "noreferrer" as const } : {};
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);

  const closeAll = () => {
    setOpen(false);
    setSection(null);
  };

  // Close on Escape — it's a lightweight sheet, not a modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="-mr-1 inline-flex items-center justify-center p-1.5 text-ink-muted transition-colors hover:text-ink"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <>
              <line x1="3.5" y1="3.5" x2="14.5" y2="14.5" />
              <line x1="14.5" y1="3.5" x2="3.5" y2="14.5" />
            </>
          ) : (
            <>
              <line x1="2" y1="5.5" x2="16" y2="5.5" />
              <line x1="2" y1="12.5" x2="16" y2="12.5" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <div
          id="mobile-nav"
          className="absolute left-0 right-0 top-full z-50 max-h-[calc(100vh-4.5rem)] overflow-y-auto border-b hairline bg-parchment-50"
        >
          <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col px-6 py-1">
            {NAV_ITEMS.map((item) => {
              const isOpen = section === item.key;
              return (
                <div key={item.key} className="border-b hairline last:border-0">
                  <div className="flex items-center justify-between">
                    <a
                      href={item.href}
                      onClick={closeAll}
                      className="flex-1 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink"
                    >
                      {item.label}
                    </a>
                    <button
                      type="button"
                      onClick={() => setSection(isOpen ? null : item.key)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                      className="p-3 text-ink-faint"
                    >
                      <svg
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        fill="none"
                        aria-hidden
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M1 1l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="pb-3 pl-1">
                      {item.menu.featured.map((f) => (
                        <a
                          key={f.title}
                          href={f.href}
                          onClick={closeAll}
                          {...extAttrs(f.external)}
                          className="block py-2 text-[13px] text-ink transition-colors hover:text-oxblood"
                        >
                          {f.title}
                        </a>
                      ))}
                      {item.menu.list.map((it) => (
                        <a
                          key={it.name}
                          href={it.href}
                          onClick={closeAll}
                          {...extAttrs(it.external)}
                          className="block py-2 font-mono text-[12px] text-ink-muted transition-colors hover:text-oxblood"
                        >
                          {it.name}
                          {it.external ? " ↗" : null}
                        </a>
                      ))}
                      <a
                        href={item.menu.cta.href}
                        onClick={closeAll}
                        {...extAttrs(item.menu.cta.external)}
                        className="mt-1 block py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-oxblood transition-colors hover:text-oxblood-soft"
                      >
                        {item.menu.cta.title} →
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
