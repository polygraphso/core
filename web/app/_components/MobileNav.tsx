"use client";

import { useEffect, useState } from "react";

// Mobile menu for the header — the desktop nav is `hidden sm:flex`, so below
// the sm breakpoint there was no navigation at all. This is the small client
// island that adds it; SiteHeader stays a server component.

export function MobileNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);

  // Close on Escape, and lock nothing else — it's a lightweight dropdown, not a modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
        className="-mr-1 inline-flex items-center justify-center p-1.5 text-ink-muted hover:text-ink transition-colors"
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
          className="absolute left-0 right-0 top-full z-50 border-b hairline bg-parchment-50"
        >
          <nav aria-label="Mobile" className="mx-auto max-w-6xl px-6 py-1 flex flex-col">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 border-b hairline last:border-0 text-ink-muted hover:text-ink transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
