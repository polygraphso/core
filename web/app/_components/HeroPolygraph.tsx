import { getSupabaseAdmin } from "@/lib/supabase";
import { refToPath } from "@/lib/badgeData";
import { rowToRun, type HostedRunRow, type LitmusGrade } from "./checksMapper";

// Hero proof artifact: the latest published polygraph, compact. The report
// card is the one element a cold reader parses instantly — show it before
// asking them to read anything. Renders nothing when no run is published.

const GRADE_COLOR: Record<LitmusGrade, string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  C: "var(--color-grade-c)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

// "C-01 tool-output injection" → "tool-output injection"; values like
// "skipped — remote target" → "skipped". Full detail lives on the report page.
function shortLabel(key: string): string {
  return key.replace(/^C-0\d\s+/, "");
}

function statusWord(value: string): string {
  return value.split(" — ")[0];
}

async function fetchLatestRun() {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("hosted_runs")
    .select(
      "id, target, target_kind, grade, rationale, evidence, tool_defs_fingerprint, c01, c02, c03",
    )
    // Server grades only — this is a server report card (transport, C-01/02/03,
    // fingerprint). Skill grades have a different evidence shape (no target), so
    // including them here crashes the server-shaped mapper.
    .in("target_kind", ["registry_ref", "remote_url"])
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[HeroPolygraph] hosted_runs query failed:", error.message);
    return null;
  }
  if (!data?.length) return null;
  return rowToRun(data[0] as HostedRunRow);
}

export async function HeroPolygraph() {
  const run = await fetchLatestRun();
  if (!run) return null;

  const target = run.rows.find(([k]) => k === "target")?.[1] ?? run.label;
  // Every graded target — registry ref or remote https endpoint — has a /mcp
  // report page (refToPath collapses a URL's "://" so it survives the path).
  const reportHref = `/mcp/${refToPath(target)}`;
  const checks = run.rows.filter(([k]) => /^C-0\d/.test(k));

  return (
    <div className="border hairline bg-parchment-50 mb-5">
      <div className="flex items-center justify-between px-3 py-1.5 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        <span className="whitespace-nowrap">latest polygraph</span>
        {/* Data-driven from the run's evidence so the badge tracks the methodology
            the grade was actually produced under, instead of drifting on a
            hardcoded version string. */}
        <span className="text-ink whitespace-nowrap">{run.methodologyVersion}</span>
      </div>
      <div className="px-3 py-3 flex items-start gap-4">
        <span
          className="font-serif text-5xl leading-none shrink-0"
          style={{ color: GRADE_COLOR[run.grade] }}
          aria-label={`Grade ${run.grade}`}
        >
          {run.grade}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] text-ink break-words">{target}</p>
          <dl className="mt-2 space-y-1 font-mono text-[11px]">
            {checks.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-faint">{shortLabel(k)}</dt>
                <dd className="text-ink shrink-0">{statusWord(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="px-3 pb-2.5 font-mono text-[10.5px] text-ink-faint">
        <a
          href={reportHref}
          className="border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          See the full run
        </a>
      </p>
    </div>
  );
}
