"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdvisorySeverity,
  EcosystemAlertFrequency,
  EcosystemAlertRecipientsMode,
  EcosystemAlertRecipientVM,
  EcosystemAlertSettingsVM,
} from "@/lib/ecosystemAlertTypes";

const RECIPIENT_NOTE: Record<EcosystemAlertRecipientsMode, string> = {
  admins: "Every active admin of this ecosystem gets the weekly digest.",
  members: "Every active member (admins and members) gets the weekly digest.",
  explicit: "Only the addresses you list below get the weekly digest.",
};

function RecipientList({
  slug,
  recipients,
  onChanged,
}: {
  slug: string;
  recipients: EcosystemAlertRecipientVM[];
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const explicit = recipients.filter((r) => r.source === "explicit");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/manage/${slug}/alerts/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't add that recipient.");
      return;
    }
    setEmail("");
    onChanged();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/manage/${slug}/alerts/recipients`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  return (
    <div className="mt-3">
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alerts@company.com"
          className="flex-1 font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment-50 rounded-[3px] px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-50"
        >
          {busy ? "adding…" : "Add"}
        </button>
      </form>
      {message ? <p className="mt-2 font-mono text-[11px] text-oxblood">{message}</p> : null}
      {explicit.length > 0 ? (
        <div className="mt-3">
          {explicit.map((r) => (
            <div
              key={r.id}
              className="border-t hairline py-2 flex items-center justify-between gap-3"
            >
              <span className="text-[13px] text-ink truncate">
                {r.email}
                {r.unsubscribed ? (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    unsubscribed
                  </span>
                ) : null}
              </span>
              <button
                onClick={() => remove(r.id)}
                disabled={busy}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-oxblood transition-colors disabled:opacity-50"
              >
                remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-ink-faint">No explicit recipients yet.</p>
      )}
    </div>
  );
}

/**
 * The per-ecosystem alert strategy editor. Toggles each digest section, sets the
 * CVE severity threshold and cadence, and chooses recipients — mirroring the
 * SettingsForm scaffolding. Recipients mutate immediately (with a refresh); the
 * strategy saves on the button.
 */
export function AlertSettingsForm({
  slug,
  settings,
  recipients,
}: {
  slug: string;
  settings: EcosystemAlertSettingsVM;
  recipients: EcosystemAlertRecipientVM[];
}) {
  const router = useRouter();
  const [cveEnabled, setCveEnabled] = useState(settings.cve_enabled);
  const [cveMinSeverity, setCveMinSeverity] = useState<AdvisorySeverity>(settings.cve_min_severity);
  const [gradeDrop, setGradeDrop] = useState(settings.grade_drop_enabled);
  const [newVersion, setNewVersion] = useState(settings.new_version_enabled);
  const [frequency, setFrequency] = useState<EcosystemAlertFrequency>(settings.frequency);
  const [mode, setMode] = useState<EcosystemAlertRecipientsMode>(settings.recipients_mode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/manage/${slug}/alerts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cve_enabled: cveEnabled,
        cve_min_severity: cveMinSeverity,
        grade_drop_enabled: gradeDrop,
        new_version_enabled: newVersion,
        frequency,
        recipients_mode: mode,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setMessage(res.ok ? "Saved." : body.error ?? "Couldn't save.");
    if (res.ok) router.refresh();
  }

  const selectCls =
    "font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-2 py-2 text-ink";
  const legendCls = "font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-2";

  return (
    <form onSubmit={save} className="border border-rule rounded-[4px] p-4 space-y-5 max-w-xl">
      <p className="text-[12px] leading-relaxed text-ink-faint">
        A weekly digest to the recipients below, covering whichever sections you enable. It sends
        only when there is something to report; each recipient can unsubscribe from any email.
      </p>

      <fieldset>
        <div className={legendCls}>What to include</div>
        <div className="flex flex-col gap-2 font-mono text-[12px] text-ink-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cveEnabled} onChange={(e) => setCveEnabled(e.target.checked)} />
            CVEs to fix across the ecosystem&rsquo;s MCPs
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={gradeDrop} onChange={(e) => setGradeDrop(e.target.checked)} />
            Grade drops (an MCP&rsquo;s letter grade falls)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newVersion} onChange={(e) => setNewVersion(e.target.checked)} />
            New-version regrades
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className={legendCls}>CVE severity floor</div>
          <select
            value={cveMinSeverity}
            onChange={(e) => setCveMinSeverity(e.target.value as AdvisorySeverity)}
            disabled={!cveEnabled}
            className={`${selectCls} disabled:opacity-50`}
            aria-label="Minimum CVE severity"
          >
            <option value="CRITICAL">Critical only</option>
            <option value="HIGH">High &amp; up</option>
            <option value="MODERATE">Moderate &amp; up</option>
            <option value="LOW">Low &amp; up</option>
          </select>
        </div>
        <div>
          <div className={legendCls}>Cadence</div>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as EcosystemAlertFrequency)}
            className={selectCls}
            aria-label="Digest frequency"
          >
            <option value="weekly">Weekly</option>
            <option value="off">Off</option>
          </select>
        </div>
      </div>

      <fieldset>
        <div className={legendCls}>Recipients</div>
        <div className="flex flex-col gap-2 font-mono text-[12px] text-ink-muted">
          {(["admins", "members", "explicit"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input
                type="radio"
                name="recipients_mode"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              {m === "admins" ? "Admins" : m === "members" ? "All members" : "Specific addresses"}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-ink-faint">{RECIPIENT_NOTE[mode]}</p>
        {mode === "explicit" ? (
          <RecipientList slug={slug} recipients={recipients} onChanged={() => router.refresh()} />
        ) : null}
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment-50 rounded-[3px] px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-50"
        >
          {busy ? "saving…" : "Save alert strategy"}
        </button>
        {message ? <span className="font-mono text-[11px] text-ink-muted">{message}</span> : null}
      </div>
    </form>
  );
}
