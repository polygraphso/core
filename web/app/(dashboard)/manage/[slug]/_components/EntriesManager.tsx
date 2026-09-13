"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { EcosystemEntryVM } from "@/lib/ecosystemTypes";
import {
  ENTRIES_PAGE_SIZE,
  filterEntries,
  isFiltering,
  pageItems,
  type EntryGradeFilter,
  type EntryTypeFilter,
  type EntryVisFilter,
} from "@/lib/manageEntries";

/** Job statuses that mean "still grading" — anything else is terminal. */
const IN_FLIGHT = new Set(["queued", "running", "pending", "in_progress"]);

function isGrading(vm: EcosystemEntryVM): boolean {
  return vm.grade === null && !!vm.gradeStatus && IN_FLIGHT.has(vm.gradeStatus);
}

function Stamp({ grade, grading }: { grade: string | null; grading: boolean }) {
  if (grade) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] font-mono text-[15px] font-semibold text-parchment-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
        style={{ backgroundColor: GRADE_HEX[grade as keyof typeof GRADE_HEX] ?? "var(--color-ink-faint)" }}
        aria-label={`grade ${grade}`}
      >
        {grade}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border hairline font-mono text-[11px] text-ink-faint"
      aria-label={grading ? "grading" : "ungraded"}
    >
      {grading ? "…" : "—"}
    </span>
  );
}

function Check({ code, status }: { code: string; status: string | null }) {
  const fail = status && !status.startsWith("skip") && status !== "pass";
  const color = status === "pass" ? GRADE_HEX.A : !status || status.startsWith("skip") ? "var(--color-ink-faint)" : GRADE_HEX.F;
  const label = !status ? "—" : status.startsWith("skip") ? "skip" : status;
  return (
    <span className="font-mono text-[10px]">
      <span className="text-ink-faint">{code.replace(/^[CS]-/, "")}</span>{" "}
      <span className={fail ? "font-semibold" : ""} style={{ color }}>
        {label}
      </span>
    </span>
  );
}

function FixList({ vm }: { vm: EcosystemEntryVM }) {
  if (vm.fixes.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 border-l-2 border-oxblood/40 pl-4">
      {vm.fixes.map((f, i) => (
        <div key={i} className="text-[13px] leading-relaxed">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {f.categoryCode} · {f.categoryName}
            {f.severity ? <span className="text-oxblood/70"> · {f.severity}</span> : null}
          </div>
          <div className="text-ink font-medium">{f.title}</div>
          <div className="text-ink-muted">{f.problem}</div>
          <div className="text-ink">
            <span className="text-oxblood">Fix:</span> {f.fix}
          </div>
          {f.locus ? <div className="font-mono text-[11px] text-ink-faint">{f.locus}</div> : null}
        </div>
      ))}
    </div>
  );
}

function EntryRow({
  slug,
  vm,
  onChanged,
  locked,
}: {
  slug: string;
  vm: EcosystemEntryVM;
  onChanged: () => void;
  /** Unpaid ecosystem: list is visible, everything that mutates or is paid is not. */
  locked?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [showFixes, setShowFixes] = useState(false);
  const grading = isGrading(vm);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/manage/${slug}/entries/${vm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Remove ${vm.name} from this ecosystem?`)) return;
    setBusy(true);
    await fetch(`/api/manage/${slug}/entries/${vm.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  return (
    <div className={`border-t hairline py-3 ${vm.visible ? "" : "opacity-55"}`}>
      <div className="flex items-start gap-3">
        <Stamp grade={vm.grade} grading={grading} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-ink font-medium truncate">{vm.name}</span>
            {vm.featured ? <span className="text-oxblood text-[13px]" title="featured">★</span> : null}
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {vm.targetKind === "skill" ? "skill" : "mcp"}
              {vm.cohort ? ` · ${vm.cohort}` : ""}
            </span>
          </div>
          {vm.target ? (
            <code className="font-mono text-[11px] text-ink-muted break-all">{vm.target}</code>
          ) : null}

          {vm.grade ? (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {vm.checks.map((c) => (
                <Check key={c.code} code={c.code} status={c.status} />
              ))}
            </div>
          ) : (
            <div className="mt-1 font-mono text-[11px] text-ink-faint">
              {grading ? "grading…" : vm.gradeStatus ? `grade ${vm.gradeStatus}` : "not graded yet"}
            </div>
          )}

          {/* Controls. Locked = read-only: the public report stays reachable,
              everything that mutates or is part of the paid layer goes. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em]">
            {/* Curation cluster — left. */}
            {!locked ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                  onClick={() => patch({ visible: !vm.visible })}
                  disabled={busy}
                  className="text-ink-muted hover:text-oxblood transition-colors disabled:opacity-50"
                >
                  {vm.visible ? "hide" : "show"}
                </button>
                <button
                  onClick={() => patch({ featured: !vm.featured })}
                  disabled={busy}
                  className="text-ink-muted hover:text-oxblood transition-colors disabled:opacity-50"
                >
                  {vm.featured ? "unfeature" : "feature"}
                </button>
                <button
                  type="button"
                  disabled
                  title="Hosted grading is discontinued"
                  className="text-ink-faint cursor-not-allowed"
                >
                  regrade
                </button>
                {vm.fixes.length > 0 ? (
                  <button
                    onClick={() => setShowFixes((s) => !s)}
                    className="text-ink-muted hover:text-oxblood transition-colors"
                  >
                    {showFixes ? "hide fixes" : `fixes · ${vm.fixes.length}`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Report + destructive remove — right, set off by a rule so the
                remove can't be misclicked next to the curation actions. */}
            <div className="ml-auto flex items-center gap-x-4">
              {vm.reportPath ? (
                <Link href={vm.reportPath} className="text-ink-muted hover:text-oxblood transition-colors">
                  report ↗
                </Link>
              ) : null}
              {!locked ? (
                <>
                  {vm.reportPath ? (
                    <span aria-hidden className="text-rule">
                      |
                    </span>
                  ) : null}
                  <button
                    onClick={remove}
                    disabled={busy}
                    className="text-ink-faint hover:text-oxblood transition-colors disabled:opacity-50"
                  >
                    remove
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {showFixes && !locked ? <FixList vm={vm} /> : null}
        </div>
      </div>
    </div>
  );
}

function AddEntryForm({ slug, onAdded }: { slug: string; onAdded: (id: string | null) => void }) {
  const [kind, setKind] = useState<"mcp" | "skill">("mcp");
  const [target, setTarget] = useState("");
  const [cohort, setCohort] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/manage/${slug}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: target.trim(), kind, cohort: cohort.trim() || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; entry?: { id?: string } };
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't add that.");
      return;
    }
    setTarget("");
    setCohort("");
    onAdded(body.entry?.id ?? null);
  }

  return (
    <form onSubmit={submit} className="border border-rule rounded-[4px] p-4 mb-5">
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "mcp" | "skill")}
          className="font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-2 py-2 text-ink"
        >
          <option value="mcp">MCP server</option>
          <option value="skill">Skill</option>
        </select>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={kind === "skill" ? "github/owner/repo#skill or a SKILL.md URL" : "npm/…, pypi/…, github/owner/repo, or https://…"}
          className="flex-1 font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint"
        />
        <input
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
          placeholder="cohort (optional)"
          className="sm:w-40 font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment-50 rounded-[3px] px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-50"
        >
          {busy ? "adding…" : "Add & grade"}
        </button>
      </div>
      {message ? <p className="mt-2 font-mono text-[11px] text-oxblood">{message}</p> : null}
      <p className="mt-2 text-[11px] text-ink-faint leading-relaxed">
        Adding grades the target immediately. It appears here the moment its grade lands.
      </p>
    </form>
  );
}

export function EntriesManager({
  slug,
  entries,
  locked,
}: {
  slug: string;
  entries: EcosystemEntryVM[];
  /** Unpaid ecosystem: browse only — no adding, no curation (APIs 402 anyway). */
  locked?: boolean;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  // Poll freshly added / regraded entries until their job is terminal, then refresh
  // so the RSC re-fetch surfaces the grade. Bounded so a stuck job can't poll forever.
  const [watch, setWatch] = useState<Set<string>>(new Set());
  const attempts = useRef<Record<string, number>>({});

  const watchEntry = useCallback((id: string | null) => {
    refresh();
    if (!id) return;
    attempts.current[id] = 0;
    setWatch((prev) => new Set(prev).add(id));
  }, [refresh]);

  useEffect(() => {
    if (watch.size === 0) return;
    const timer = setInterval(async () => {
      for (const id of Array.from(watch)) {
        attempts.current[id] = (attempts.current[id] ?? 0) + 1;
        let done = attempts.current[id] > 20; // ~80s cap
        try {
          const res = await fetch(`/api/manage/${slug}/entries/${id}/status`);
          const body = (await res.json()) as { status?: string | null };
          const s = body.status ?? null;
          if (!s || !IN_FLIGHT.has(s)) done = true;
        } catch {
          done = true;
        }
        if (done) {
          setWatch((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          refresh();
        }
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [watch, slug, refresh]);

  // ── Search / filter / pagination (client-side; every entry is already loaded) ──
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<EntryGradeFilter>("all");
  const [visFilter, setVisFilter] = useState<EntryVisFilter>("all");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ search, type: typeFilter, grade: gradeFilter, vis: visFilter }),
    [search, typeFilter, gradeFilter, visFilter],
  );
  const filtered = useMemo(() => filterEntries(entries, filters), [entries, filters]);

  // Any change to the result set jumps back to the first page.
  useEffect(() => setPage(1), [search, typeFilter, gradeFilter, visFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ENTRIES_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageEntries = filtered.slice((safePage - 1) * ENTRIES_PAGE_SIZE, safePage * ENTRIES_PAGE_SIZE);
  const filtering = isFiltering(filters);

  const selectCls =
    "font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-2 py-2 text-ink";
  const pageBtnCls =
    "px-2 py-1 uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-oxblood disabled:opacity-40 disabled:hover:text-ink-muted";

  return (
    <div>
      {!locked ? <AddEntryForm slug={slug} onAdded={watchEntry} /> : null}
      {entries.length === 0 ? (
        <p className="text-ink-muted text-[14px] py-4">
          {locked ? "No servers or skills yet." : "No servers or skills yet. Add one above."}
        </p>
      ) : (
        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or target…"
              aria-label="Search entries"
              className="flex-1 font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint"
            />
            <div className="flex gap-2">
              <select
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as EntryTypeFilter)}
                className={selectCls}
              >
                <option value="all">All types</option>
                <option value="mcp">MCP</option>
                <option value="skill">Skill</option>
              </select>
              <select
                aria-label="Filter by grade"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value as EntryGradeFilter)}
                className={selectCls}
              >
                <option value="all">All grades</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="F">F</option>
                <option value="ungraded">Ungraded</option>
              </select>
              <select
                aria-label="Filter by visibility"
                value={visFilter}
                onChange={(e) => setVisFilter(e.target.value as EntryVisFilter)}
                className={selectCls}
              >
                <option value="all">Shown &amp; hidden</option>
                <option value="shown">Shown</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>

          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {filtering
              ? `${filtered.length} of ${entries.length}`
              : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
          </div>

          {filtered.length === 0 ? (
            <p className="text-ink-muted text-[14px] py-4">No entries match these filters.</p>
          ) : (
            <div>
              {pageEntries.map((vm) => (
                <EntryRow
                  key={vm.id}
                  slug={slug}
                  vm={vm}
                  onChanged={refresh}
                  locked={locked}
                />
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
                )
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
      )}
    </div>
  );
}
