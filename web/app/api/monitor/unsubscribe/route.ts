/**
 * /api/monitor/unsubscribe?token=<unsubscribe_token>
 *
 * One-click unsubscribe for a monitor subscription. GET is the human click from
 * the email (returns a small confirmation page); POST is the RFC 8058 one-click
 * the List-Unsubscribe-Post header points at. Both flip unsubscribed_at and are
 * idempotent — re-clicking is a no-op that still confirms.
 *
 * Token-scoped, so no auth: the per-row random token is the capability.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Flip the subscription off. Returns false only on a real DB error. */
async function unsubscribe(token: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) {
    console.error("[unsubscribe] Supabase not configured");
    return false;
  }
  // Only touch still-active rows so the original unsubscribe time is preserved on
  // a re-click; an unknown/spent token updates zero rows and still "succeeds".
  const { error } = await db
    .from("monitors")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("[unsubscribe] update failed:", error.message);
    return false;
  }
  return true;
}

function tokenFrom(request: Request): string | null {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length < 8 || token.length > 128) return null;
  return token;
}

function page(title: string, body: string, status: number): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title} · polygraph</title>
    <style>
      body{margin:0;background:#f5efe3;color:#23201a;font-family:Georgia,'Source Serif 4',serif;}
      .wrap{max-width:520px;margin:0 auto;padding:80px 24px;}
      .label{font-family:ui-monospace,'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a7d63;}
      h1{font-size:24px;line-height:1.3;margin:12px 0 0;}
      p{font-size:15px;line-height:1.6;color:#3b362c;margin:16px 0 0;}
      a{color:#7c2b22;}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="label">polygraph · monitoring</div>
      <h1>${title}</h1>
      ${body}
    </div>
  </body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const token = tokenFrom(request);
  if (!token) {
    return page("Invalid unsubscribe link", "<p>This link is missing or malformed. If you keep getting emails, reach us at <a href=\"mailto:hello@polygraph.so\">hello@polygraph.so</a>.</p>", 400);
  }
  const ok = await unsubscribe(token);
  if (!ok) {
    return page("Something went wrong", "<p>We couldn't process the unsubscribe just now. Please try again, or email <a href=\"mailto:hello@polygraph.so\">hello@polygraph.so</a>.</p>", 500);
  }
  return page(
    "You're unsubscribed",
    "<p>You won't get any more new-version regrade alerts for this server. You can re-subscribe anytime from its report page on <a href=\"https://polygraph.so\">polygraph.so</a>.</p>",
    200,
  );
}

export async function POST(request: Request): Promise<Response> {
  const token = tokenFrom(request);
  if (!token) {
    return Response.json({ ok: false, message: "Missing or malformed token." }, { status: 400 });
  }
  const ok = await unsubscribe(token);
  return Response.json({ ok }, { status: ok ? 200 : 500 });
}
