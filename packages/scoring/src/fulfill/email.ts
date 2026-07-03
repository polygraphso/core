/**
 * One-shot fulfillment emails for grade requests that left an address. Plain
 * transactional replies to an explicit ask — no digests, no unsubscribe
 * machinery (unlike monitor alerts, there is no ongoing subscription).
 * Voice: plain English, no hype, no overclaim.
 */

import type { ComposedEmail } from "../alerts/email.js";

const DEFAULT_SITE = "https://polygraph.so";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reportUrl(target: string, kind: "registry_ref" | "remote_url", siteUrl?: string): string {
  const site = (siteUrl ?? DEFAULT_SITE).replace(/\/+$/, "");
  // Registry refs render at /mcp/<target> unencoded (the site's convention);
  // remote URLs need encoding to survive as a path segment.
  return kind === "remote_url"
    ? `${site}/mcp/${encodeURIComponent(target)}`
    : `${site}/mcp/${target}`;
}

export function buildFulfilledEmail(input: {
  target: string;
  targetKind: "registry_ref" | "remote_url";
  grade: string;
  version: string | null;
  siteUrl?: string;
}): ComposedEmail {
  const report = reportUrl(input.target, input.targetKind, input.siteUrl);
  const versionLine = input.version ? ` (version ${input.version})` : "";
  const text = [
    `The grade you requested is live.`,
    ``,
    `${input.target}${versionLine} — polygraph: ${input.grade}`,
    ``,
    `Full report, per-check results, and the evidence behind the grade:`,
    report,
    ``,
    `A grade covers the exact version it was run against; it never carries to`,
    `other versions. The harness is open — anyone can re-run it and check the`,
    `result.`,
    ``,
    `— polygraph.so`,
  ].join("\n");
  const html = [
    `<p>The grade you requested is live.</p>`,
    `<p><strong>${escapeHtml(input.target)}${escapeHtml(versionLine)}</strong> — polygraph: <strong>${escapeHtml(input.grade)}</strong></p>`,
    `<p>Full report, per-check results, and the evidence behind the grade:<br/><a href="${escapeHtml(report)}">${escapeHtml(report)}</a></p>`,
    `<p>A grade covers the exact version it was run against; it never carries to other versions. The harness is open — anyone can re-run it and check the result.</p>`,
    `<p>— polygraph.so</p>`,
  ].join("\n");
  return {
    subject: `Your requested grade is live: ${input.target} — ${input.grade}`,
    text,
    html,
  };
}

export function buildDeclinedEmail(input: {
  target: string;
  siteUrl?: string;
}): ComposedEmail {
  const site = (input.siteUrl ?? DEFAULT_SITE).replace(/\/+$/, "");
  const requestUrl = `${site}/request`;
  const text = [
    `We tried to grade ${input.target}, but the harness couldn't complete a run.`,
    ``,
    `The usual reasons: the server needs credentials to start, doesn't launch`,
    `from its published package, or its endpoint wasn't reachable. This is a`,
    `"couldn't test" — not a judgment on the server.`,
    ``,
    `If you can point us at a runnable form of it, re-submit with a note:`,
    requestUrl,
    ``,
    `— polygraph.so`,
  ].join("\n");
  const html = [
    `<p>We tried to grade <strong>${escapeHtml(input.target)}</strong>, but the harness couldn't complete a run.</p>`,
    `<p>The usual reasons: the server needs credentials to start, doesn't launch from its published package, or its endpoint wasn't reachable. This is a &quot;couldn't test&quot; — not a judgment on the server.</p>`,
    `<p>If you can point us at a runnable form of it, re-submit with a note:<br/><a href="${escapeHtml(requestUrl)}">${escapeHtml(requestUrl)}</a></p>`,
    `<p>— polygraph.so</p>`,
  ].join("\n");
  return {
    subject: `We couldn't grade ${input.target}`,
    text,
    html,
  };
}
