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

export interface AlertEmailInput {
  /** Versionless server_key, e.g. "npm/@scope/name" — also the report path. */
  target: string;
  /** The newly graded version (resolved_version). May be null for safety. */
  version: string | null;
  /** The new grade (A/B/D/F). */
  grade: string;
  /** The grade we last told this watcher about, or null on the first alert. */
  priorGrade: string | null;
  /** Per-subscription token for the one-click unsubscribe link. */
  unsubscribeToken: string;
  /** Origin for the report / fix / unsubscribe links (no trailing slash). */
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

/** Display name for a server_key: the package/name part, dropping the registry. */
function displayName(target: string): string {
  // npm/@scope/name → @scope/name ; pypi/name → name ; github/owner/name → owner/name
  const slash = target.indexOf("/");
  return slash === -1 ? target : target.slice(slash + 1);
}

/** Compose the alert email. Pure — no env reads, no I/O. */
export function buildAlertEmail(input: AlertEmailInput): ComposedEmail {
  const site = trimSlash(input.siteUrl ?? DEFAULT_SITE_URL);
  const name = displayName(input.target);
  const versionLabel = input.version ? `v${input.version}` : "a new version";

  const reportUrl = `${site}/mcp/${input.target}`;
  const unsubscribeUrl = `${site}/api/monitor/unsubscribe?token=${input.unsubscribeToken}`;
  const fixUrl = `${site}/fix?for=${encodeURIComponent(input.target)}&kind=mcp`;

  const changed = input.priorGrade != null && input.priorGrade !== input.grade;
  const gradeLine = changed
    ? `Grade: ${input.priorGrade} → ${input.grade}`
    : `Grade: ${input.grade}`;

  const subject = changed
    ? `${name} ${versionLabel}: grade ${input.priorGrade} → ${input.grade}`
    : `${name} ${versionLabel}: graded ${input.grade}`;

  const nonA = input.grade !== "A";

  const text = [
    `${name} published ${versionLabel}. polygraph re-ran the behavioral litmus on the new version.`,
    ``,
    gradeLine,
    ``,
    `Full report and evidence: ${reportUrl}`,
    nonA ? `How to fix the failing checks: ${fixUrl}` : null,
    ``,
    `The grade is reproducible — the harness is open, so you can re-run it against the same server and check the result yourself.`,
    ``,
    `—`,
    `You're monitoring ${input.target} on polygraph.so.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5efe3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe3;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf7ee;border:1px solid #e2d8c4;border-radius:6px;">
          <tr><td style="padding:28px 28px 8px 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7d63;">
            polygraph · new-version regrade
          </td></tr>
          <tr><td style="padding:4px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:20px;line-height:1.35;color:#23201a;">
            <strong>${escapeHtml(name)}</strong> published ${escapeHtml(versionLabel)}.
          </td></tr>
          <tr><td style="padding:12px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:15px;line-height:1.6;color:#3b362c;">
            polygraph re-ran the behavioral litmus on the new version.
          </td></tr>
          <tr><td style="padding:18px 28px 0 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:16px;color:#23201a;">
            ${escapeHtml(gradeLine)}
          </td></tr>
          <tr><td style="padding:22px 28px 0 28px;">
            <a href="${reportUrl}" style="display:inline-block;background:#23201a;color:#f5efe3;text-decoration:none;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;padding:10px 16px;border-radius:4px;">View the report &amp; evidence</a>
            ${nonA ? `&nbsp;<a href="${fixUrl}" style="display:inline-block;color:#7c2b22;text-decoration:underline;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;padding:10px 4px;">How to fix</a>` : ``}
          </td></tr>
          <tr><td style="padding:20px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:13px;line-height:1.6;color:#6b6353;">
            The grade is reproducible — the harness is open, so you can re-run it against the same server and check the result yourself.
          </td></tr>
          <tr><td style="padding:24px 28px 28px 28px;border-top:1px solid #e2d8c4;margin-top:16px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;line-height:1.7;color:#8a7d63;">
            You're monitoring <span style="color:#6b6353;">${escapeHtml(input.target)}</span>.<br/>
            <a href="${unsubscribeUrl}" style="color:#8a7d63;">Unsubscribe</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  // Inbox-native unsubscribe (RFC 8058). Gmail/Yahoo weight this for bulk mail;
  // the POST endpoint accepts the one-click unsubscribe.
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { subject, html, text, headers };
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
