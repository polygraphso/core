"use client";

import { useEffect, useState, type ReactNode } from "react";

// The Skills view is deep-linkable as /mcp-index#skills (used by the primary
// nav's "Skills, graded" tile). The active tab is client-only state, so a hash —
// not a query param — carries it: it keeps the page statically rendered (no
// useSearchParams / Suspense boundary) and matches an in-page view toggle.
const SKILL_HASH = "#skills";

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

  // Read the hash on mount, and follow later changes (e.g. clicking the nav link
  // while already on this page fires `hashchange`). Server render is always "mcp",
  // so this corrects to "skill" after hydration when the hash asks for it.
  useEffect(() => {
    const sync = () => setTab(window.location.hash === SKILL_HASH ? "skill" : "mcp");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Reflect a click in the URL so the view is shareable, without a scroll jump or
  // a history entry per toggle. replaceState doesn't fire `hashchange`, so no loop.
  const select = (t: "mcp" | "skill") => {
    setTab(t);
    const url = t === "skill" ? SKILL_HASH : window.location.pathname + window.location.search;
    window.history.replaceState(null, "", url);
  };

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
              onClick={() => select(t)}
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
