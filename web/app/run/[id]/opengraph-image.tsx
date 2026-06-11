import { ImageResponse } from "next/og";
import { OG_SIZE, og, ogFonts } from "@/lib/og";
import {
  getRunsSupabase,
  RUN_SELECT_COLUMNS,
  type HostedRunRow,
} from "@/lib/runs";

// Per-run OG card — the shareable grade card. A completed run renders
// the grade + per-check outcomes; an in-flight run renders its status.
// Every grade tweeted during launch week becomes a grade card, not a
// bare link. Failure modes (bad id, missing env, DB error) degrade to
// the generic card rather than 500ing the crawler.

export const alt = "polygraph.so — hosted litmus run report";
export const size = OG_SIZE;
export const contentType = "image/png";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<string, string> = {
  created: "awaiting payment",
  paid: "paid",
  queued: "queued",
  running: "running litmus-v1",
  complete: "complete",
  failed: "run failed",
};

async function loadRun(id: string): Promise<HostedRunRow | null> {
  if (!UUID_RE.test(id)) return null;
  // Dev-only design preview: /run/facade00-…/opengraph-image renders a
  // specimen grade card without a DB. Never active in production.
  if (
    process.env.NODE_ENV === "development" &&
    id.toLowerCase().startsWith("facade00")
  ) {
    return {
      id,
      target: "npm/@modelcontextprotocol/server-filesystem",
      target_kind: "registry_ref",
      status: "complete",
      created_at: "2026-06-11T00:00:00Z",
      paid_at: "2026-06-11T00:00:00Z",
      payment_tx: "0xabc",
      grade: "A",
      c01: "pass",
      c02: "pass",
      c03: "pass",
      tool_defs_fingerprint:
        "0x4cb6aa00000000000000000000000000000000000000000000000000001ecd",
      methodology_version: "litmus-v1",
      rationale: "All three categories pass inside the sandbox.",
      failure_reason: null,
      ran_at: "2026-06-11T00:00:00Z",
      completed_at: "2026-06-11T00:00:00Z",
    };
  }
  try {
    const supabase = getRunsSupabase();
    const { data } = await supabase
      .from("hosted_runs")
      .select(RUN_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    return (data as HostedRunRow) ?? null;
  } catch {
    return null;
  }
}

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: og.parchment,
        color: og.ink,
        padding: 56,
        fontFamily: "IBM Plex Mono",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 22,
          letterSpacing: 4,
          color: og.inkMuted,
          textTransform: "uppercase",
          paddingBottom: 24,
          borderBottom: `1px solid ${og.rule}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{ width: 14, height: 14, background: og.oxblood, display: "flex" }}
          />
          <span style={{ color: og.ink }}>polygraph.so</span>
        </div>
        <span>hosted run · litmus-v1</span>
      </div>
      {children}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 24,
          borderTop: `1px solid ${og.rule}`,
          fontSize: 20,
          color: og.inkFaint,
          letterSpacing: 2,
        }}
      >
        <span>payment buys the run, never the grade</span>
        <span>polygraph.so/run</span>
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await loadRun(id);
  const fonts = await ogFonts();

  if (!run) {
    return new ImageResponse(
      (
        <Chrome>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              fontFamily: "Source Serif 4",
              fontSize: 64,
              lineHeight: 1.15,
              maxWidth: 980,
            }}
          >
            A behavioral litmus run on an MCP server.
          </div>
        </Chrome>
      ),
      { ...size, fonts },
    );
  }

  const target =
    run.target.length > 52 ? run.target.slice(0, 52) + "…" : run.target;

  if (run.status !== "complete" || !run.grade) {
    return new ImageResponse(
      (
        <Chrome>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 24,
            }}
          >
            <div style={{ fontSize: 34, color: og.ink, display: "flex" }}>
              {target}
            </div>
            <div
              style={{
                fontSize: 26,
                color: og.inkMuted,
                letterSpacing: 3,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {STATUS_LABEL[run.status] ?? run.status}
            </div>
          </div>
        </Chrome>
      ),
      { ...size, fonts },
    );
  }

  const checks: Array<[string, string | null]> = [
    ["C-01 injection", run.c01],
    ["C-02 egress", run.c02],
    ["C-03 data", run.c03],
  ];

  return new ImageResponse(
    (
      <Chrome>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 56,
          }}
        >
          <div
            style={{
              fontFamily: "Source Serif 4",
              fontSize: 280,
              lineHeight: 1,
              color: og.grade[run.grade] ?? og.ink,
              display: "flex",
            }}
          >
            {run.grade}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 32, color: og.ink, display: "flex" }}>
              {target}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checks.map(([label, value]) => (
                <div
                  key={label}
                  style={{ display: "flex", gap: 18, fontSize: 24 }}
                >
                  <span style={{ color: og.inkFaint, width: 240 }}>{label}</span>
                  <span
                    style={{
                      color:
                        value === "fail"
                          ? og.grade.F
                          : value === "pass"
                            ? og.grade.A
                            : og.inkMuted,
                    }}
                  >
                    {value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            {run.tool_defs_fingerprint && (
              <div style={{ fontSize: 22, color: og.inkFaint, display: "flex" }}>
                {run.tool_defs_fingerprint.slice(0, 10)}…
                {run.tool_defs_fingerprint.slice(-4)} ·{" "}
                {run.methodology_version ?? "litmus-v1"}
                {run.ran_at ? ` · ${run.ran_at.slice(0, 10)}` : ""}
              </div>
            )}
          </div>
        </div>
      </Chrome>
    ),
    { ...size, fonts },
  );
}
