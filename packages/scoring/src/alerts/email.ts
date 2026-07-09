/**
 * Alert email: composition (pure) + delivery (Resend).
 *
 * Composition is split from sending so the body is unit-testable with no network
 * and the engine can render once and send through any EmailSender. Voice is the
 * polygraph "scientific preprint" register — calm, plain, no hype, no "100% safe".
 */

import { Resend } from "resend";

export const DEFAULT_SITE_URL = "https://polygraph.so";
export const DEFAULT_FROM = "polygraph <alerts@polygraph.so>";

/** One graded server in an alert. A digest email carries one or more of these. */
export interface AlertChange {
  /** Versionless server_key, e.g. "npm/@scope/name" — also the report path. */
  target: string;
  /** The newly graded version (resolved_version). May be null for safety. */
  version: string | null;
  /** The new grade (A/B/D/F). */
  grade: string;
  /** The grade we last told this watcher about, or null on the first alert. */
  priorGrade: string | null;
  /** Per-subscription token for the one-click List-Unsubscribe header. */
  unsubscribeToken: string;
}

export interface AlertEmailInput extends AlertChange {
  /** Origin for the report / fix / dashboard / unsubscribe links (no trailing slash). */
  siteUrl?: string;
}

export interface DigestEmailInput {
  /** One or more grade changes for a single recipient. */
  changes: AlertChange[];
  /** Origin for the report / fix / dashboard / unsubscribe links. */
  siteUrl?: string;
}

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
  /** Extra SMTP headers (e.g. List-Unsubscribe for inbox-native unsubscribe). */
  headers?: Record<string, string>;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve the link origin, tolerating a blank or malformed value.
 *
 * The cron passes POLYGRAPH_SITE_URL straight through, and an undefined GitHub
 * Actions `${{ vars.X }}` expands to an empty string — so `?? DEFAULT` (nullish)
 * would keep "", yielding root-relative links that mail clients "repair" to
 * http://<first-path-segment>/… . Fall back on any empty/whitespace/non-http(s)
 * value, matching how the `from` address already coalesces with `||`.
 */
function resolveSite(raw?: string): string {
  const v = raw?.trim();
  if (!v) return DEFAULT_SITE_URL;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return DEFAULT_SITE_URL;
    return trimSlash(v);
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** Display name for a server_key: the package/name part, dropping the registry. */
function displayName(target: string): string {
  // npm/@scope/name → @scope/name ; pypi/name → name ; github/owner/name → owner/name
  const slash = target.indexOf("/");
  return slash === -1 ? target : target.slice(slash + 1);
}

function versionLabelOf(version: string | null): string {
  return version ? `v${version}` : "a new version";
}

function gradeLineOf(change: AlertChange): string {
  const changed = change.priorGrade != null && change.priorGrade !== change.grade;
  return changed
    ? `Grade: ${change.priorGrade} → ${change.grade}`
    : `Grade: ${change.grade}`;
}

/** Text lines for one change. `withHeader` prepends the "name published vX" line. */
function changeTextLines(change: AlertChange, site: string, withHeader: boolean): Array<string | null> {
  const reportUrl = `${site}/mcp/${change.target}`;
  const fixUrl = `${site}/fix?for=${encodeURIComponent(change.target)}&kind=mcp`;
  const nonA = change.grade !== "A";
  return [
    withHeader ? `${displayName(change.target)} published ${versionLabelOf(change.version)}` : null,
    gradeLineOf(change),
    `Full report and evidence: ${reportUrl}`,
    nonA ? `How to fix the failing checks: ${fixUrl}` : null,
  ];
}

/** HTML rows for one change. `withHeader` prepends the "name published vX" line. */
function changeHtmlRows(change: AlertChange, site: string, withHeader: boolean): string {
  const reportUrl = `${site}/mcp/${change.target}`;
  const fixUrl = `${site}/fix?for=${encodeURIComponent(change.target)}&kind=mcp`;
  const nonA = change.grade !== "A";
  const header = withHeader
    ? `<tr><td style="padding:20px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:16px;line-height:1.35;color:#23201a;">
            <strong>${escapeHtml(displayName(change.target))}</strong> published ${escapeHtml(versionLabelOf(change.version))}.
          </td></tr>`
    : ``;
  return `${header}
          <tr><td style="padding:${withHeader ? "8px" : "18px"} 28px 0 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:16px;color:#23201a;">
            ${escapeHtml(gradeLineOf(change))}
          </td></tr>
          <tr><td style="padding:14px 28px 0 28px;">
            <a href="${reportUrl}" style="display:inline-block;background:#23201a;color:#f5efe3;text-decoration:none;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;padding:10px 16px;border-radius:4px;">View the report &amp; evidence</a>
            ${nonA ? `&nbsp;<a href="${fixUrl}" style="display:inline-block;color:#7c2b22;text-decoration:underline;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;padding:10px 4px;">How to fix</a>` : ``}
          </td></tr>`;
}

/**
 * Compose one alert email for a single recipient covering one OR MORE grade
 * changes. Pure — no env reads, no I/O.
 *
 * The visible "manage / unsubscribe" affordance is a link to the dashboard
 * (monitors are managed there); the per-monitor one-click unsubscribe lives only
 * in the List-Unsubscribe header for inbox-native (RFC 8058) unsubscribe.
 */
export function buildDigestEmail(input: DigestEmailInput): ComposedEmail {
  const site = resolveSite(input.siteUrl);
  // Sort by target so the output is deterministic (stable subjects/tests).
  const changes = [...input.changes].sort((a, b) => a.target.localeCompare(b.target));
  if (changes.length === 0) {
    throw new Error("buildDigestEmail: no changes to render");
  }
  const single = changes.length === 1;
  const dashboardUrl = `${site}/dashboard`;

  const first = changes[0]!;
  const subject = single
    ? (first.priorGrade != null && first.priorGrade !== first.grade
        ? `${displayName(first.target)} ${versionLabelOf(first.version)}: grade ${first.priorGrade} → ${first.grade}`
        : `${displayName(first.target)} ${versionLabelOf(first.version)}: graded ${first.grade}`)
    : `polygraph: ${changes.length} monitored servers regraded`;

  const intro = single
    ? `${displayName(first.target)} published ${versionLabelOf(first.version)}. polygraph re-ran the behavioral litmus on the new version.`
    : `polygraph re-ran the behavioral litmus on new versions of ${changes.length} servers you monitor.`;

  const monitoringLine = single
    ? `You're monitoring ${first.target} on polygraph.so.`
    : `You're monitoring ${changes.length} servers on polygraph.so.`;

  const textLines: Array<string | null> = [intro];
  for (const c of changes) {
    textLines.push(``);
    textLines.push(...changeTextLines(c, site, !single));
  }
  const text = [
    ...textLines,
    ``,
    `The grade is reproducible — the harness is open, so you can re-run it against the same server and check the result yourself.`,
    ``,
    `—`,
    monitoringLine,
    `Manage your monitors: ${dashboardUrl}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const introRows = single
    ? `<tr><td style="padding:4px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:20px;line-height:1.35;color:#23201a;">
            <strong>${escapeHtml(displayName(first.target))}</strong> published ${escapeHtml(versionLabelOf(first.version))}.
          </td></tr>
          <tr><td style="padding:12px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:15px;line-height:1.6;color:#3b362c;">
            polygraph re-ran the behavioral litmus on the new version.
          </td></tr>`
    : `<tr><td style="padding:4px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:18px;line-height:1.4;color:#23201a;">
            ${escapeHtml(intro)}
          </td></tr>`;

  const changeRows = changes.map((c) => changeHtmlRows(c, site, !single)).join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5efe3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe3;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf7ee;border:1px solid #e2d8c4;border-radius:6px;">
          <tr><td style="padding:28px 28px 8px 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7d63;">
            polygraph · new-version regrade
          </td></tr>
          ${introRows}
          ${changeRows}
          <tr><td style="padding:22px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:13px;line-height:1.6;color:#6b6353;">
            The grade is reproducible — the harness is open, so you can re-run it against the same server and check the result yourself.
          </td></tr>
          <tr><td style="padding:24px 28px 28px 28px;border-top:1px solid #e2d8c4;margin-top:16px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;line-height:1.7;color:#8a7d63;">
            ${escapeHtml(monitoringLine)}<br/>
            <a href="${dashboardUrl}" style="color:#8a7d63;">Manage your monitors</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  // Inbox-native unsubscribe (RFC 8058). Gmail/Yahoo weight this for bulk mail;
  // the POST endpoint accepts the one-click unsubscribe. A digest lists one URI
  // per monitored server (RFC 2369 permits multiple, comma-separated).
  const listUnsubscribe = changes
    .map((c) => `<${site}/api/monitor/unsubscribe?token=${c.unsubscribeToken}>`)
    .join(", ");
  const headers: Record<string, string> = {
    "List-Unsubscribe": listUnsubscribe,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { subject, html, text, headers };
}

/** Compose a single-server alert — a one-change digest. */
export function buildAlertEmail(input: AlertEmailInput): ComposedEmail {
  const { siteUrl, ...change } = input;
  return buildDigestEmail({ changes: [change], siteUrl });
}

// ── Ecosystem weekly digest ──────────────────────────────────────────────────

/** One CVE to fix, as the ecosystem digest renders it. */
export interface EcosystemCveItem {
  /** Versionless target of the affected entry (report path + display). */
  target: string;
  /** Display name of the entry. */
  name: string;
  advisories: Array<{
    ghsa: string;
    cveIds: string[];
    severity: string | null;
    fixedVersion: string | null;
    url: string | null;
  }>;
}

/** One grade-drop / new-version line in the ecosystem digest. */
export interface EcosystemGradeItem {
  target: string;
  name: string;
  grade: string;
  priorGrade: string | null;
  version: string | null;
}

export interface EcosystemDigestInput {
  ecosystemName: string;
  ecosystemSlug: string;
  cveItems: EcosystemCveItem[];
  gradeDrops: EcosystemGradeItem[];
  newVersions: EcosystemGradeItem[];
  /** Per-recipient one-click unsubscribe token (RFC 8058). */
  unsubscribeToken: string;
  siteUrl?: string;
}

function cveCount(items: EcosystemCveItem[]): number {
  return items.reduce((n, i) => n + i.advisories.length, 0);
}

/** Section heading row for the digest table. */
function sectionHeadingHtml(text: string): string {
  return `<tr><td style="padding:22px 28px 0 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7d63;">${escapeHtml(text)}</td></tr>`;
}

/**
 * Compose one ecosystem weekly digest for a single recipient. Renders only the
 * sections that have content (CVEs to fix / grade drops / new-version regrades).
 * Pure — no env, no I/O. Reuses resolveSite / escapeHtml / displayName so the
 * voice + brand match the per-server digest.
 */
export function buildEcosystemDigestEmail(input: EcosystemDigestInput): ComposedEmail {
  const site = resolveSite(input.siteUrl);
  const { cveItems, gradeDrops, newVersions } = input;
  const cves = cveCount(cveItems);
  if (cveItems.length === 0 && gradeDrops.length === 0 && newVersions.length === 0) {
    throw new Error("buildEcosystemDigestEmail: nothing to report");
  }

  const subjParts: string[] = [];
  if (cves > 0) subjParts.push(`${cves} CVE${cves === 1 ? "" : "s"} to fix`);
  if (gradeDrops.length) subjParts.push(`${gradeDrops.length} grade drop${gradeDrops.length === 1 ? "" : "s"}`);
  if (newVersions.length) subjParts.push(`${newVersions.length} regrade${newVersions.length === 1 ? "" : "s"}`);
  const subject = `polygraph · ${input.ecosystemName}: ${subjParts.join(", ")}`;

  const manageUrl = `${site}/manage/${input.ecosystemSlug}`;

  // ── Text ──
  const text: string[] = [
    `Weekly monitoring digest for ${input.ecosystemName}.`,
  ];
  if (cveItems.length) {
    text.push(``, `CVEs TO FIX`);
    for (const item of cveItems) {
      text.push(`- ${displayName(item.target)}`);
      for (const a of item.advisories) {
        const sev = a.severity ? `[${a.severity}] ` : "";
        const fix = a.fixedVersion ? ` — fixed in ${a.fixedVersion}` : " — no fixed version yet";
        const ids = [a.ghsa, ...a.cveIds].join(" / ");
        text.push(`    ${sev}${ids}${fix}${a.url ? ` — ${a.url}` : ""}`);
      }
    }
  }
  if (gradeDrops.length) {
    text.push(``, `GRADE DROPS`);
    for (const g of gradeDrops) {
      text.push(`- ${displayName(g.target)}: ${g.priorGrade ?? "?"} → ${g.grade} (${site}/mcp/${g.target})`);
    }
  }
  if (newVersions.length) {
    text.push(``, `NEW-VERSION REGRADES`);
    for (const g of newVersions) {
      const v = g.version ? `v${g.version}` : "new version";
      text.push(`- ${displayName(g.target)} ${v}: graded ${g.grade} (${site}/mcp/${g.target})`);
    }
  }
  text.push(
    ``,
    `The grades are reproducible — the harness is open, so you can re-run it and check any result yourself.`,
    ``,
    `—`,
    `Manage this ecosystem's alert strategy: ${manageUrl}`,
  );

  // ── HTML sections ──
  const rows: string[] = [];

  if (cveItems.length) {
    rows.push(sectionHeadingHtml("CVEs to fix"));
    for (const item of cveItems) {
      rows.push(
        `<tr><td style="padding:12px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:15px;color:#23201a;"><strong>${escapeHtml(item.name)}</strong> <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#8a7d63;">${escapeHtml(item.target)}</span></td></tr>`,
      );
      for (const a of item.advisories) {
        const sev = a.severity
          ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:#7c2b22;">${escapeHtml(a.severity)}</span> `
          : "";
        const ids = escapeHtml([a.ghsa, ...a.cveIds].join(" / "));
        const fix = a.fixedVersion
          ? ` — fixed in <span style="color:#7c2b22;">${escapeHtml(a.fixedVersion)}</span>`
          : " — no fixed version yet";
        const link = a.url
          ? ` &nbsp;<a href="${a.url}" style="color:#8a7d63;">advisory ↗</a>`
          : "";
        rows.push(
          `<tr><td style="padding:4px 28px 0 40px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;color:#3b362c;">${sev}${ids}${fix}${link}</td></tr>`,
        );
      }
    }
  }

  const gradeSection = (heading: string, items: EcosystemGradeItem[], newVersion: boolean): void => {
    if (!items.length) return;
    rows.push(sectionHeadingHtml(heading));
    for (const g of items) {
      const reportUrl = `${site}/mcp/${g.target}`;
      const line = newVersion
        ? `<strong>${escapeHtml(g.name)}</strong> ${escapeHtml(g.version ? `v${g.version}` : "new version")}: graded ${escapeHtml(g.grade)}`
        : `<strong>${escapeHtml(g.name)}</strong>: ${escapeHtml(g.priorGrade ?? "?")} → ${escapeHtml(g.grade)}`;
      rows.push(
        `<tr><td style="padding:10px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:15px;color:#23201a;">${line} &nbsp;<a href="${reportUrl}" style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#8a7d63;">report ↗</a></td></tr>`,
      );
    }
  };
  gradeSection("Grade drops", gradeDrops, false);
  gradeSection("New-version regrades", newVersions, true);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5efe3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe3;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf7ee;border:1px solid #e2d8c4;border-radius:6px;">
          <tr><td style="padding:28px 28px 4px 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7d63;">
            polygraph · weekly digest
          </td></tr>
          <tr><td style="padding:4px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:20px;line-height:1.35;color:#23201a;">
            ${escapeHtml(input.ecosystemName)}
          </td></tr>
          ${rows.join("\n")}
          <tr><td style="padding:22px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:13px;line-height:1.6;color:#6b6353;">
            The grades are reproducible — the harness is open, so you can re-run it and check any result yourself.
          </td></tr>
          <tr><td style="padding:24px 28px 28px 28px;border-top:1px solid #e2d8c4;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;line-height:1.7;color:#8a7d63;">
            <a href="${manageUrl}" style="color:#8a7d63;">Manage this ecosystem's alert strategy</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${site}/api/ecosystem-alert/unsubscribe?token=${input.unsubscribeToken}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { subject, html, text: text.filter((l) => l !== null).join("\n"), headers };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── delivery ─────────────────────────────────────────────────────────────────

export interface SendResult {
  id: string | null;
}

/** Minimal send seam so the engine is testable without Resend or a network. */
export interface EmailSender {
  send(to: string, email: ComposedEmail): Promise<SendResult>;
}

/**
 * Resend-backed sender. Throws on a Resend error so the caller records the
 * delivery as 'failed' (best-effort: a failed send is not retried — the unique
 * alert_deliveries claim already advanced).
 */
export function resendSender(opts?: { apiKey?: string; from?: string }): EmailSender {
  const apiKey = opts?.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be set to send alert emails.");
  }
  const from = opts?.from || process.env.ALERT_FROM_EMAIL || DEFAULT_FROM;
  const resend = new Resend(apiKey);
  return {
    async send(to, email) {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.headers ? { headers: email.headers } : {}),
      });
      if (error) {
        throw new Error(`resend: ${error.message ?? String(error)}`);
      }
      return { id: data?.id ?? null };
    },
  };
}
