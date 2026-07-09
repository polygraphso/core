"use client";

import { useState, type ReactNode } from "react";

export interface ConsoleTab {
  id: string;
  label: string;
  panel: ReactNode;
}

/** The section switcher for the manage console (MCPs & Skills / Members /
 *  Settings). Members-only ecosystems pass just the first tab. */
export function ConsoleTabs({ tabs }: { tabs: ConsoleTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <nav className="flex gap-1 border-b border-rule mb-7" role="tablist" aria-label="Ecosystem sections">
        {tabs.map((t) => {
          const on = t.id === (current?.id ?? "");
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                on ? "border-oxblood text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
      <div role="tabpanel">{current?.panel}</div>
    </div>
  );
}
