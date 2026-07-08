/**
 * POST /api/monitor — subscribe to new-version regrade alerts for one server.
 *
 * Requires a Supabase session (enforced by proxy). Idempotent on
 * (target, user_id) via record_monitor's ON CONFLICT. Maps the 'quota_exceeded'
 * DB exception to 409 so the client can show a friendly message.
 *
 * Accepts the targets that have a "version stream" the alert engine can watch:
 *   - npm/pypi packages        → the registry version stream
 *   - github/owner/repo        → the repo's commit stream (a github MCP server)
 *   - github/owner/repo#path   → the skill subdir's path-scoped commit stream
 * Remote https URLs and immutable @commit pins have no stream to watch, so they
 * are rejected — we never create a monitor that can physically never fire.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ServerRefParseError,
  parseServerRef,
  serverKey,
} from "@/lib/identity";
import { decodeSkillRef } from "@/lib/skillGrades";
import { getSession } from "@/lib/session";
import { verifyRunnable, checkRegistryExists } from "@/lib/verifyRunnable";
import { gateKnownMcp, isCatalogedServer } from "@/lib/knownMcp";
import { enforceRateLimit, honeypotTripped } from "@/lib/rateLimit";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "monitor", { max: 12, windowSeconds: 60 });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const { server_ref, company } = (payload ?? {}) as {
    server_ref?: unknown;
    company?: unknown;
  };

  // Honeypot: a bot that fills the hidden field gets a silent ok and no write.
  if (honeypotTripped(company)) {
    return NextResponse.json({ ok: true });
  }

  if (typeof server_ref !== "string" || server_ref.length === 0) {
    return NextResponse.json({ ok: false, message: "server_ref is required." }, { status: 400 });
  }
  if (server_ref.length > 512) {
    return NextResponse.json({ ok: false, message: "server_ref is too long." }, { status: 400 });
  }

  // Normalize to the stored key form and classify the target. A '#' marks a
  // skill ref (github/owner/repo#path) — parseServerRef can't split the subpath,
  // so skills take a dedicated branch. github servers and npm/pypi go through
  // parseServerRef. An immutable @commit pin has no stream to watch → rejected.
  const PIN_MESSAGE =
    "Pin a branch, not a commit — a fixed @commit never changes, so there's nothing to monitor.";
  let normalizedRef: string;
  let targetKind: "registry_ref" | "skill";
  let isGithub: boolean;

  if (server_ref.includes("#")) {
    if (server_ref.includes("@")) {
      return NextResponse.json({ ok: false, message: PIN_MESSAGE }, { status: 400 });
    }
    const canonical = decodeSkillRef(server_ref);
    if (!canonical || !canonical.startsWith("github/")) {
      return NextResponse.json(
        { ok: false, message: "That doesn't look like a skill ref (expected github/owner/repo#path)." },
        { status: 400 },
      );
    }
    normalizedRef = canonical;
    targetKind = "skill";
    isGithub = true;
  } else {
    try {
      const parsed = parseServerRef(server_ref);
      if (parsed.registry === "github") {
        if (parsed.version) {
          return NextResponse.json({ ok: false, message: PIN_MESSAGE }, { status: 400 });
        }
        normalizedRef = serverKey(parsed);
        targetKind = "registry_ref";
        isGithub = true;
      } else if (parsed.registry === "npm" || parsed.registry === "pypi") {
        normalizedRef = serverKey(parsed);
        targetKind = "registry_ref";
        isGithub = false;
      } else {
        return NextResponse.json(
          {
            ok: false,
            message: "Monitoring is available for npm, pypi, and GitHub servers and skills.",
          },
          { status: 400 },
        );
      }
    } catch (err) {
      if (err instanceof ServerRefParseError) {
        return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  // Proxy guarantees a Supabase session for this route.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Sign in to monitor servers." }, { status: 401 });
  }

  // Same gate as the grade-request funnel, for registry targets only: monitor an
  // npm/pypi package only if it exists and is plausibly an MCP server, else we'd
  // watch a non-existent or unrelated package (npm/benfica, npm/context) that can
  // never produce a meaningful regrade. github targets skip these (they have no
  // registry entry / catalog row); the user typed an explicit owner/repo[#path],
  // and the alert engine simply no-ops if the repo/path resolves to no commit.
  const gateTarget = { target: normalizedRef, kind: "registry_ref" as const };
  if (!isGithub) {
    const runnable = await verifyRunnable(gateTarget, checkRegistryExists);
    if (!runnable.ok) {
      return NextResponse.json({ ok: false, message: runnable.reason }, { status: 422 });
    }
  }

  try {
    const supabase = getSupabase();

    if (!isGithub) {
      const known = await gateKnownMcp(gateTarget, (ref) => isCatalogedServer(supabase, ref));
      if (!known.ok) {
        return NextResponse.json({ ok: false, message: known.reason }, { status: 422 });
      }
    }

    const { error } = await supabase.rpc("record_monitor", {
      p_target: normalizedRef,
      p_email: null,
      p_user_id: session.userId,
      p_target_kind: targetKind,
    });
    if (error) {
      if (error.message.includes("quota_exceeded")) {
        return NextResponse.json(
          {
            ok: false,
            code: "quota_exceeded",
            message:
              "You're already monitoring a server. Unsubscribe from it in your dashboard to add a new one.",
          },
          { status: 409 },
        );
      }
      console.error("[monitor] record_monitor failed:", error.message);
      return NextResponse.json(
        {
          ok: false,
          message: "Couldn't save your subscription. Try again or email hello@polygraph.so.",
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error(
      "[monitor] supabase client init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        message: "Couldn't save your subscription. Try again or email hello@polygraph.so.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/monitor — set the alert threshold on one of the caller's monitors.
 *
 * Body: { monitor_id: string, min_grade: "C" | "D" | "F" | null }. null means
 * "every regrade" (an email on every new grade). Ownership is enforced in the
 * set_monitor_alert_grade RPC (it matches (id, user_id)), so a monitor the
 * caller doesn't own updates zero rows — no IDOR via the service-role client.
 */
export async function PATCH(request: Request) {
  const limited = await enforceRateLimit(request, "monitor", { max: 30, windowSeconds: 60 });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const { monitor_id, min_grade } = (payload ?? {}) as {
    monitor_id?: unknown;
    min_grade?: unknown;
  };

  if (typeof monitor_id !== "string" || monitor_id.length === 0) {
    return NextResponse.json({ ok: false, message: "monitor_id is required." }, { status: 400 });
  }
  // Defense in depth — the RPC re-validates, but reject junk up front.
  if (min_grade !== null && !(typeof min_grade === "string" && ["C", "D", "F"].includes(min_grade))) {
    return NextResponse.json(
      { ok: false, message: "min_grade must be 'C', 'D', 'F', or null." },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Sign in to manage monitors." }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("set_monitor_alert_grade", {
      p_monitor_id: monitor_id,
      p_user_id: session.userId,
      p_min_grade: min_grade,
    });
    if (error) {
      console.error("[monitor] set_monitor_alert_grade failed:", error.message);
      return NextResponse.json(
        { ok: false, message: "Couldn't save your setting. Try again." },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error(
      "[monitor] supabase client init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, message: "Couldn't save your setting. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
