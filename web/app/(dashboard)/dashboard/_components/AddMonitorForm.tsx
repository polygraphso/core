"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  target: string;
  grade: string | null;
}

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};

function normalize(raw: string): string {
  const s = raw.trim();
  if (s.startsWith("npm/") || s.startsWith("pypi/") || s.startsWith("https://") || s.startsWith("github/")) return s;
  return `npm/${s}`;
}

export function AddMonitorForm() {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Search while typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/mcp-search?q=${encodeURIComponent(value.trim())}`);
      const data = (await res.json()) as { results: SearchResult[] };
      setResults(data.results);
      setOpen(true);
      setHighlighted(-1);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function submitRef(server_ref: string) {
    setOpen(false);
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server_ref }),
    });
    const body = (await res.json()) as { ok: boolean; message?: string };

    if (!res.ok) {
      setStatus("error");
      setMessage(body.message ?? "Something went wrong.");
      return;
    }

    // Queue a grade request for unindexed servers.
    await fetch("/api/grade-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server_ref }),
    }).catch(() => {});

    setStatus("success");
    setMessage("Monitor added. We'll email you when the grade is ready.");
    setValue("");
    setResults([]);
    router.refresh();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    submitRef(normalize(value));
  }

  function onSelect(result: SearchResult) {
    setValue(result.target);
    submitRef(result.target);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length)); // +1 for the "Add" row
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      if (highlighted === results.length) {
        submitRef(normalize(value));
      } else {
        onSelect(results[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="border hairline bg-parchment-50 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-3">
        Add a server to monitor
      </p>
      <form onSubmit={onSubmit}>
        <div className="relative flex gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setStatus("idle"); setMessage(""); }}
              onKeyDown={onKeyDown}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="@scope/name or pypi/name"
              autoComplete="off"
              disabled={status === "loading"}
              aria-expanded={open}
              aria-autocomplete="list"
              className="w-full font-mono text-sm bg-parchment border hairline px-3 py-2 text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink disabled:opacity-50"
            />

            {open && (
              <ul
                role="listbox"
                className="absolute z-50 top-full left-0 right-0 mt-0.5 border hairline bg-parchment shadow-sm max-h-64 overflow-y-auto"
              >
                {results.map((r, i) => (
                  <li
                    key={r.target}
                    role="option"
                    aria-selected={i === highlighted}
                    onMouseDown={(e) => { e.preventDefault(); onSelect(r); }}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer ${
                      i === highlighted ? "bg-ink/[0.05]" : "hover:bg-ink/[0.03]"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-ink truncate">{r.target}</span>
                    {r.grade && (
                      <span
                        className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 text-parchment"
                        style={{ backgroundColor: GRADE_COLOR[r.grade] ?? "#23201a" }}
                      >
                        {r.grade}
                      </span>
                    )}
                  </li>
                ))}
                <li
                  role="option"
                  aria-selected={highlighted === results.length}
                  onMouseDown={(e) => { e.preventDefault(); submitRef(normalize(value)); }}
                  onMouseEnter={() => setHighlighted(results.length)}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-t hairline ${
                    highlighted === results.length ? "bg-ink/[0.05]" : "hover:bg-ink/[0.03]"
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Add</span>
                  <span className="font-mono text-[11px] text-ink truncate">{normalize(value)}</span>
                  {results.length === 0 && (
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">not yet indexed</span>
                  )}
                </li>
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "loading" || !value.trim()}
            className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "…" : "Monitor"}
          </button>
        </div>

        <p className="mt-2 font-mono text-[10px] text-ink-faint">
          npm packages are prefixed automatically. Use <span className="text-ink">pypi/name</span> for PyPI.
        </p>

        {message && (
          <p
            role="alert"
            className={`mt-3 font-mono text-[11px] ${status === "error" ? "text-oxblood" : "text-ink-muted"}`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
