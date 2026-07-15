import "server-only";

/**
 * The subscription-stopped notice: composition (pure) + delivery (Resend).
 * Sent best-effort when an admin stops a subscription server-side — the
 * payer's Sablier stream keeps running until THEY cancel it (Sablier's cancel
 * is sender-only), so the one job of this email is to tell them to cancel and
 * reclaim the unstreamed remainder. Same compose/send split and parchment
 * shell as packages/scoring/src/alerts/email.ts; voice is the polygraph
 * preprint register — calm, plain, no hype.
 */

import { Resend } from "resend";

const DEFAULT_FROM = "polygraph <alerts@polygraph.so>";

export interface StoppedEmailInput {
  kind: "plan" | "ecosystem";
  /** What was stopped, as the payer knows it — "indie plan", "Base ecosystem monitoring". */
  label: string;
  /** ISO end of the stream — until when tokens keep streaming if not canceled. */
  endAt: string;
  /** Absolute URL of the page carrying the cancel button. */
  manageUrl: string;
}

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
}

function endDateLabel(endAt: string): string {
  return new Date(endAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Compose the stopped notice. Pure — no env reads, no I/O. */
export function buildSubscriptionStoppedEmail(input: StoppedEmailInput): ComposedEmail {
  const noun = input.kind === "plan" ? "the plan's monitor quota" : "monitoring";
  const endDate = endDateLabel(input.endAt);
  const subject = `polygraph: your ${input.label} subscription was stopped`;

  const text = [
    `polygraph has stopped your ${input.label} subscription, and ${noun} has ended.`,
    ``,
    `Your payment stream is still running onchain — it would keep streaming until ${endDate}. Cancel it and the unstreamed remainder returns to your wallet automatically:`,
    ``,
    input.manageUrl,
    ``,
    `Connect the wallet that created the stream, then cancel. Nothing else is needed.`,
    ``,
    `Questions: hello@polygraph.so`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5efe3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe3;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf7ee;border:1px solid #e2d8c4;border-radius:6px;">
          <tr><td style="padding:28px 28px 8px 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7d63;">
            polygraph · subscription stopped
          </td></tr>
          <tr><td style="padding:4px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:20px;line-height:1.35;color:#23201a;">
            polygraph has stopped your <strong>${escapeHtml(input.label)}</strong> subscription.
          </td></tr>
          <tr><td style="padding:12px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:15px;line-height:1.6;color:#3b362c;">
            ${escapeHtml(noun.charAt(0).toUpperCase() + noun.slice(1))} has ended. Your payment stream is still running onchain — it would keep streaming until ${escapeHtml(endDate)}. Cancel it and the unstreamed remainder returns to your wallet automatically.
          </td></tr>
          <tr><td style="padding:18px 28px 0 28px;">
            <a href="${input.manageUrl}" style="display:inline-block;background:#23201a;color:#f5efe3;text-decoration:none;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;padding:10px 16px;border-radius:4px;">Cancel the stream</a>
          </td></tr>
          <tr><td style="padding:14px 28px 0 28px;font-family:Georgia,'Source Serif 4',serif;font-size:13px;line-height:1.6;color:#6b6353;">
            Connect the wallet that created the stream, then cancel. Nothing else is needed.
          </td></tr>
          <tr><td style="padding:24px 28px 28px 28px;border-top:1px solid #e2d8c4;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;line-height:1.7;color:#8a7d63;">
            Questions: <a href="mailto:hello@polygraph.so" style="color:#8a7d63;">hello@polygraph.so</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * Send via Resend. Throws when unconfigured or on a Resend error — callers
 * catch and report the stop as "not notified" (the stop itself never blocks
 * on mail).
 */
export async function sendSubscriptionStoppedEmail(
  to: string | string[],
  email: ComposedEmail,
): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY must be set to send subscription emails.");
  const from = process.env.ALERT_FROM_EMAIL || DEFAULT_FROM;
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(`resend: ${error.message ?? String(error)}`);
  return { id: data?.id ?? null };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
