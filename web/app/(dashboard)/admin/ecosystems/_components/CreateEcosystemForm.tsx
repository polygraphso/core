"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateEcosystemForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [firstAdminEmail, setFirstAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/ecosystems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug.trim(),
        name: name.trim(),
        blurb: blurb.trim() || undefined,
        firstAdminEmail: firstAdminEmail.trim() || undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; warning?: string; ecosystem?: { slug: string } };
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't create the ecosystem.");
      return;
    }
    setMessage(body.warning ?? "Created.");
    setSlug("");
    setName("");
    setBlurb("");
    setFirstAdminEmail("");
    router.refresh();
  }

  const inputCls =
    "w-full font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint";

  return (
    <form onSubmit={submit} className="border border-rule rounded-[4px] p-4 space-y-3 max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme network" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">Blurb (optional)</label>
        <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} className={inputCls} />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">
          First admin email (optional)
        </label>
        <input
          type="email"
          value={firstAdminEmail}
          onChange={(e) => setFirstAdminEmail(e.target.value)}
          placeholder="admin@acme.com"
          className={inputCls}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment-50 rounded-[3px] px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-50"
        >
          {busy ? "creating…" : "Create ecosystem"}
        </button>
        {message ? <span className="font-mono text-[11px] text-ink-muted">{message}</span> : null}
      </div>
    </form>
  );
}
