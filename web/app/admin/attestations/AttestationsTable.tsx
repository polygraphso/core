"use client";

import { useState } from "react";
import type { AdminRow } from "@/lib/attestations/store";
import { filterRows, paginate, pageCount, type KindFilter } from "@/lib/attestations/adminTable";
import { attestationUrl, type ChainConfig } from "@/lib/attestations/chains";
import { skillRefToPath } from "@/lib/skillGrades";
import { AttestButton } from "./AttestButton";
import { RegradeButton } from "./RegradeButton";
import { PublishButton } from "./PublishButton";

const PAGE_SIZE = 25;

const KINDS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "registry_ref", label: "MCPs" },
  { key: "skill", label: "Skills" },
];

/** Public report page for a graded target: /skill for skills, /mcp for servers. */
function reportHref(server: string, targetKind: string): string {
  return targetKind === "skill" ? `/skill/${skillRefToPath(server)}` : `/mcp/${server}`;
}

export function AttestationsTable({ rows, chain }: { rows: AdminRow[]; chain: ChainConfig }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [page, setPage] = useState(0);

  const filtered = filterRows(rows, { query, kind });
  const pages = pageCount(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, pages - 1);
  const visible = paginate(filtered, safePage, PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search server…"
            className="w-64 border hairline bg-transparent px-2 py-1 font-mono text-[12px] focus:outline-none focus:border-ink/40"
          />
          <div className="inline-flex border hairline divide-x divide-[var(--color-rule-soft)] font-mono text-[11px]">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => {
                  setKind(k.key);
                  setPage(0);
                }}
                className={`px-2.5 py-1 ${kind === k.key ? "bg-ink/10 text-ink" : "text-ink/60 hover:bg-ink/5"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-ink/60">
          <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage(safePage - 1)}
              className="border hairline px-2 py-1 hover:bg-ink/5 disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <span>
              {safePage + 1} / {pages}
            </span>
            <button
              type="button"
              disabled={safePage >= pages - 1}
              onClick={() => setPage(safePage + 1)}
              className="border hairline px-2 py-1 hover:bg-ink/5 disabled:opacity-40"
            >
              Next ›
            </button>
          </span>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b hairline font-mono text-[11px] uppercase tracking-wide">
            <th className="py-2 pr-3">Server</th>
            <th className="py-2 pr-3">Version</th>
            <th className="py-2 pr-3">Litmus</th>
            <th className="py-2 pr-3">Grade</th>
            <th className="py-2 pr-3">Published</th>
            <th className="py-2 pr-3">Attestation</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.hosted_run_id} className="border-b hairline align-middle">
              <td className="py-2 pr-3 font-mono text-[12px]">
                <a
                  className="underline decoration-dotted hover:text-oxblood"
                  href={reportHref(r.server, r.target_kind)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.server}
                </a>
              </td>
              <td className="py-2 pr-3 font-mono text-[12px]">{r.version || "—"}</td>
              <td className="py-2 pr-3 font-mono text-[11px] text-ink/70 whitespace-nowrap">{r.methodology_version}</td>
              <td className="py-2 pr-3">{r.grade}</td>
              <td className="py-2 pr-3 font-mono text-[11px]">
                {r.published ? "✓ live" : <span className="text-ink/50">draft</span>}
              </td>
              <td className="py-2 pr-3 text-[12px]">
                {r.status === "confirmed" && r.attestation_uid ? (
                  <a
                    className="text-oxblood underline"
                    href={attestationUrl(chain, r.attestation_uid)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ✅ on-chain
                  </a>
                ) : r.status === "pending" ? (
                  "⏳ pending"
                ) : r.status === "failed" ? (
                  <span className="text-oxblood">failed: {r.error}</span>
                ) : (
                  "not attested"
                )}
              </td>
              <td className="py-2">
                <span className="flex items-center justify-end gap-2">
                  <RegradeButton target={r.server} targetKind={r.target_kind} />
                  {!r.published && <PublishButton hostedRunId={r.hosted_run_id} />}
                  {r.published && r.status !== "confirmed" && r.status !== "pending" && (
                    <AttestButton hostedRunId={r.hosted_run_id} />
                  )}
                </span>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center font-mono text-[12px] text-ink/50">
                No matching grades.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
