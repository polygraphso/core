"use client";

import { useEffect, useMemo, useState } from "react";
import { ENTRIES_PAGE_SIZE, pageItems } from "@/lib/manageEntries";
import {
  SEVERITY_RANK,
  type AdvisoryVM,
  type CveSeverity,
  type EcosystemCveGroupVM,
} from "@/lib/cveTypes";

/** Severity → badge color. Oxblood for the two that page an operator. */
const SEVERITY_HEX: Record<CveSeverity, string> = {
  CRITICAL: "#7c2b22",
  HIGH: "#a3452f",
  MODERATE: "#8a6d1f",
  LOW: "#6b6353",
};

type SeverityFilter = "all" | CveSeverity;

function SeverityBadge({ severity }: { severity: CveSeverity | null }) {
  const label = severity ?? "UNSPECIFIED";
  const color = severity ? SEVERITY_HEX[severity] : "var(--color-ink-faint)";
  return (
    <span
      className="inline-block rounded-[3px] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-parchment-50"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function AdvisoryRow({ a }: { a: AdvisoryVM }) {
  return (
    <div className="border-t hairline py-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <SeverityBadge severity={a.severity} />
        <code className="font-mono text-[11px] text-ink-muted">{a.ghsaId}</code>
        {a.cveIds.map((c) => (
          <code key={c} className="font-mono text-[11px] text-ink-faint">
            {c}
          </code>
        ))}
        {a.cvss != null ? (
          <span className="font-mono text-[10px] text-ink-faint">CVSS {a.cvss}</span>
        ) : null}
      </div>
      {a.summary ? <div className="mt-1 text-[13px] leading-relaxed text-ink">{a.summary}</div> : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-ink-faint">
        {a.affectedRange ? <span>affected {a.affectedRange}</span> : null}
        {a.fixedVersion ? (
          <span className="text-ink-muted">
            fixed in <span className="text-oxblood">{a.fixedVersion}</span>
          </span>
        ) : (
          <span>no fixed version yet</span>
        )}
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="uppercase tracking-[0.12em] text-ink-muted hover:text-oxblood transition-colors"
          >
            View advisory ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

function GroupBlock({ group }: { group: EcosystemCveGroupVM }) {
  const affected = group.advisories.length > 0;
  return (
    <div className="border-t hairline py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-ink font-medium truncate">{group.name}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {group.targetKind === "skill" ? "skill" : "mcp"}
        </span>
        {affected ? (
          <span className="font-mono text-[10px] text-oxblood">
            {group.advisories.length} {group.advisories.length === 1 ? "CVE" : "CVEs"}
          </span>
        ) : group.coverage === "covered" ? (
          <span className="font-mono text-[10px] text-ink-faint">no open CVEs</span>
        ) : (
          <span className="font-mono text-[10px] text-ink-faint">not covered</span>
        )}
      </div>
      {group.target ? (
        <code className="font-mono text-[11px] text-ink-muted break-all">{group.target}</code>
      ) : null}
      {affected ? (
        <div className="mt-1.5 border-l-2 border-oxblood/40 pl-4">
          {group.advisories.map((a) => (
            <AdvisoryRow key={a.ghsaId} a={a} />
          ))}
        </div>
      ) : group.coverage === "not_covered" ? (
        <div className="mt-1 font-mono text-[11px] text-ink-faint">
          Remote endpoint — no package advisory feed.
        </div>
      ) : null}
    </div>
  );
}

/**
 * Read-only browser of the CVEs currently affecting an ecosystem's MCPs. Every
 * group is loaded server-side (buildCveGroups); this owns only the client filters
 * — severity, affected-only, search — and pagination, mirroring EntriesManager.
 */
export function CvesManager({ groups }: { groups: EcosystemCveGroupVM[] }) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [affectedOnly, setAffectedOnly] = useState(true);
  const [page, setPage] = useState(1);

  const minRank = severity === "all" ? 0 : SEVERITY_RANK[severity];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => {
        // Narrow the advisory list to the severity threshold when one is set.
        const advisories =
          minRank === 0
            ? g.advisories
            : g.advisories.filter((a) => (a.severity ? SEVERITY_RANK[a.severity] : 0) >= minRank);
        return { ...g, advisories };
      })
      .filter((g) => {
        if (affectedOnly && g.advisories.length === 0) return false;
        if (minRank > 0 && g.advisories.length === 0) return false;
        if (q) {
          const hay = `${g.name} ${g.target ?? ""} ${g.advisories
            .map((a) => `${a.ghsaId} ${a.cveIds.join(" ")}`)
            .join(" ")}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [groups, search, minRank, affectedOnly]);

  useEffect(() => setPage(1), [search, severity, affectedOnly]);

  const totalCves = groups.reduce((n, g) => n + g.advisories.length, 0);
  const affectedCount = groups.filter((g) => g.advisories.length > 0).length;

  const pageCount = Math.max(1, Math.ceil(filtered.length / ENTRIES_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageGroups = filtered.slice((safePage - 1) * ENTRIES_PAGE_SIZE, safePage * ENTRIES_PAGE_SIZE);

  const selectCls =
    "font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-2 py-2 text-ink";
  const pageBtnCls =
    "px-2 py-1 uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-oxblood disabled:opacity-40 disabled:hover:text-ink-muted";

  if (groups.length === 0) {
    return <p className="text-ink-muted text-[14px] py-4">No MCPs or skills tracked yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 space-y-2">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          A <strong className="text-ink">CVE</strong> (Common Vulnerabilities and Exposures) is a
          publicly disclosed security flaw in a software package, each with a unique identifier and a
          severity from low to critical. Fixing one usually means upgrading to the patched version
          listed. Advisories without a CVE assigned are shown by their GHSA id.
        </p>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          These are the known CVEs affecting this ecosystem&rsquo;s npm / pypi packages (via deps.dev
          + OSV) and its GitHub repos&rsquo; published advisories. Coverage is each package&rsquo;s
          own disclosed advisories, not its full dependency tree; remote endpoints aren&rsquo;t
          covered. Refreshed daily.
        </p>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, target, GHSA or CVE…"
          aria-label="Search CVEs"
          className="flex-1 font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint"
        />
        <div className="flex items-center gap-2">
          <select
            aria-label="Minimum severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
            className={selectCls}
          >
            <option value="all">Any severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High &amp; up</option>
            <option value="MODERATE">Moderate &amp; up</option>
            <option value="LOW">Low &amp; up</option>
          </select>
          <label className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
            <input
              type="checkbox"
              checked={affectedOnly}
              onChange={(e) => setAffectedOnly(e.target.checked)}
            />
            affected only
          </label>
        </div>
      </div>

      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {totalCves} {totalCves === 1 ? "CVE" : "CVEs"} across {affectedCount} of {groups.length}{" "}
        {groups.length === 1 ? "entry" : "entries"}
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink-muted text-[14px] py-4">
          {affectedCount === 0
            ? "No open CVEs found for the tracked MCPs."
            : "No entries match these filters."}
        </p>
      ) : (
        <div>
          {pageGroups.map((g) => (
            <GroupBlock key={g.entryId} group={g} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          className="mt-5 flex items-center justify-center gap-1 font-mono text-[11px]"
          aria-label="Pagination"
        >
          <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} className={pageBtnCls}>
            ‹ Prev
          </button>
          {pageItems(safePage, pageCount).map((it, i) =>
            it === "…" ? (
              <span key={`gap-${i}`} className="px-1.5 text-ink-faint">
                …
              </span>
            ) : (
              <button
                key={it}
                onClick={() => setPage(it)}
                aria-current={it === safePage ? "page" : undefined}
                className={`h-7 min-w-7 rounded-[3px] px-1.5 transition-colors ${
                  it === safePage ? "bg-ink text-parchment-50" : "text-ink-muted hover:text-oxblood"
                }`}
              >
                {it}
              </button>
            ),
          )}
          <button
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= pageCount}
            className={pageBtnCls}
          >
            Next ›
          </button>
        </nav>
      ) : null}
    </div>
  );
}
