"use client";

import { useEffect, useRef, useState } from "react";
import { registryUrlToRef } from "@/lib/registryUrl";

/** A catalog candidate returned by /api/catalog/search. */
export interface ComboboxResult {
  target: string;
  name: string | null;
  kind: string | null;
  gradeable: boolean;
  graded: boolean;
  grade: string | null;
}

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};

/**
 * Auto-prefix a bare package name as npm; collapse a registry page URL
 * (npmjs.com/package/…, github.com/owner/repo, pypi.org/project/…) to the ref
 * it names; leave explicit refs and other URLs untouched.
 */
export function normalizeServerRef(raw: string): string {
  const s = raw.trim();
  const fromUrl = registryUrlToRef(s);
  if (fromUrl) return fromUrl;
  if (/^(npm|pypi|github)\//.test(s) || s.startsWith("https://")) return s;
  return `npm/${s}`;
}

interface ServerComboboxProps {
  value: string;
  onValueChange: (v: string) => void;
  /** A catalog candidate was chosen. */
  onSelectResult: (result: ComboboxResult) => void;
  /** The free-typed value was chosen (synthetic row / Enter). Receives the normalized ref. */
  onSubmitFreeform: (normalized: string) => void;
  /** Comma list of grading kinds to restrict to (e.g. "npm,pypi"). */
  searchKind?: string;
  /** Typeahead endpoint (returns { results: ComboboxResult[] }). Default is the
   *  MCP catalog; the skill picker points this at /api/skills/search. */
  searchUrl?: string;
  /** How to canonicalize a free-typed value. Default npm-prefixes bare names;
   *  the skill picker passes a github-skill-ref normalizer. */
  normalize?: (raw: string) => string;
  placeholder?: string;
  disabled?: boolean;
  /** Verb on the synthetic free-form row. Default "Add". */
  freeformVerb?: string;
  inputId?: string;
  "aria-describedby"?: string;
}

export function ServerCombobox({
  value,
  onValueChange,
  onSelectResult,
  onSubmitFreeform,
  searchKind,
  searchUrl = "/api/catalog/search",
  normalize = normalizeServerRef,
  placeholder = "@scope/name · pypi/name · https://…",
  disabled = false,
  freeformVerb = "Add",
  inputId,
  "aria-describedby": ariaDescribedby,
}: ServerComboboxProps) {
  const [results, setResults] = useState<ComboboxResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = normalize(value);

  // Debounced search while typing.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: value.trim() });
      if (searchKind) params.set("kind", searchKind);
      try {
        const res = await fetch(`${searchUrl}?${params.toString()}`);
        const data = (await res.json()) as { results: ComboboxResult[] };
        setResults(data.results ?? []);
        setOpen(true);
        setHighlighted(-1);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, searchKind, searchUrl]);

  // Close on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function chooseFreeform() {
    setOpen(false);
    onSubmitFreeform(normalized);
  }

  function chooseResult(r: ComboboxResult) {
    setOpen(false);
    onSelectResult(r);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length)); // +1 = the free-form row
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      if (highlighted === results.length) chooseFreeform();
      else chooseResult(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={inputId ? `${inputId}-listbox` : undefined}
        aria-describedby={ariaDescribedby}
        className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors disabled:opacity-50"
      />

      {open && (
        <ul
          id={inputId ? `${inputId}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-0.5 border hairline bg-parchment shadow-sm max-h-64 overflow-y-auto"
        >
          {results.map((r, i) => (
            <li
              key={r.target}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => { e.preventDefault(); chooseResult(r); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer ${
                i === highlighted ? "bg-ink/[0.05]" : "hover:bg-ink/[0.03]"
              }`}
            >
              <span className="min-w-0">
                <span className="block font-mono text-[11px] text-ink truncate">{r.target}</span>
                {r.name && (
                  <span className="block font-sans text-[10.5px] text-ink-faint truncate">{r.name}</span>
                )}
              </span>
              {r.graded && r.grade ? (
                <span
                  className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 text-parchment"
                  style={{ backgroundColor: GRADE_COLOR[r.grade] ?? "#23201a" }}
                >
                  {r.grade}
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                  ungraded
                </span>
              )}
            </li>
          ))}

          <li
            role="option"
            aria-selected={highlighted === results.length}
            onMouseDown={(e) => { e.preventDefault(); chooseFreeform(); }}
            onMouseEnter={() => setHighlighted(results.length)}
            className={`flex items-center gap-2 px-3.5 py-2.5 cursor-pointer border-t hairline ${
              highlighted === results.length ? "bg-ink/[0.05]" : "hover:bg-ink/[0.03]"
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{freeformVerb}</span>
            <span className="font-mono text-[11px] text-ink truncate">{normalized}</span>
            {results.length === 0 && (
              <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">not in catalog</span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}
