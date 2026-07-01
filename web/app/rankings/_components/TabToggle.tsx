"use client";

import { useState, type ReactNode } from "react";

export function TabToggle({
  mcpCount,
  skillCount,
  mcpPanel,
  skillPanel,
}: {
  mcpCount: number;
  skillCount: number;
  mcpPanel: ReactNode;
  skillPanel: ReactNode;
}) {
  const [tab, setTab] = useState<"mcp" | "skill">("mcp");
  return (
    <div>
      <div className="mb-6 flex w-fit border hairline" role="tablist" aria-label="Grade type">
        {(["mcp", "skill"] as const).map((t, i) => {
          const label = t === "mcp" ? "MCP servers" : "Skills";
          const count = t === "mcp" ? mcpCount : skillCount;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`${i > 0 ? "border-l hairline " : ""}px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                tab === t ? "bg-ink text-parchment" : "text-ink-muted hover:text-ink"
              }`}
            >
              {label} <span className="tabular opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <div className={tab === "mcp" ? "" : "hidden"}>{mcpPanel}</div>
      <div className={tab === "skill" ? "" : "hidden"}>{skillPanel}</div>
    </div>
  );
}
