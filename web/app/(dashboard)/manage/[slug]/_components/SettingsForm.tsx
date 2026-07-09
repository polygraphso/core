"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EcosystemRow } from "@/lib/ecosystemTypes";

export function SettingsForm({ slug, ecosystem }: { slug: string; ecosystem: EcosystemRow }) {
  const router = useRouter();
  const [name, setName] = useState(ecosystem.name);
  const [blurb, setBlurb] = useState(ecosystem.blurb ?? "");
  const [isPublic, setIsPublic] = useState(ecosystem.is_public);
  const [isListed, setIsListed] = useState(ecosystem.is_listed);
  const [noindex, setNoindex] = useState(ecosystem.noindex);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/manage/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        blurb: blurb.trim() || null,
        is_public: isPublic,
        is_listed: isListed,
        noindex,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setMessage(res.ok ? "Saved." : body.error ?? "Couldn't save.");
    if (res.ok) router.refresh();
  }

  const inputCls =
    "w-full font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint";

  return (
    <form onSubmit={save} className="border border-rule rounded-[4px] p-4 space-y-4 max-w-xl">
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">Blurb</label>
        <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} className={inputCls} />
      </div>
      <div className="flex flex-col gap-2 font-mono text-[12px] text-ink-muted">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Public page reachable
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} />
          Listed on the /ecosystems hub
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
          Hide from search engines (noindex)
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment-50 rounded-[3px] px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-50"
        >
          {busy ? "saving…" : "Save settings"}
        </button>
        {message ? <span className="font-mono text-[11px] text-ink-muted">{message}</span> : null}
      </div>
    </form>
  );
}
