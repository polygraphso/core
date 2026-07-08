"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EcosystemMemberRow } from "@/lib/ecosystemTypes";

function MemberRow({ slug, member, onChanged }: { slug: string; member: EcosystemMemberRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setRole(role: "admin" | "member") {
    setBusy(true);
    await fetch(`/api/manage/${slug}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Remove ${member.email}?`)) return;
    setBusy(true);
    await fetch(`/api/manage/${slug}/members/${member.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  return (
    <div className="border-t hairline py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-ink text-[14px] truncate">{member.email}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {member.role} · {member.status}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em]">
        <button
          onClick={() => setRole(member.role === "admin" ? "member" : "admin")}
          disabled={busy}
          className="text-ink-muted hover:text-oxblood transition-colors disabled:opacity-50"
        >
          {member.role === "admin" ? "make member" : "make admin"}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="text-ink-faint hover:text-oxblood transition-colors disabled:opacity-50"
        >
          remove
        </button>
      </div>
    </div>
  );
}

export function MembersManager({ slug, members }: { slug: string; members: EcosystemMemberRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/manage/${slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't send the invite.");
      return;
    }
    setEmail("");
    setMessage("Invited as a member. Promote to admin below once they've joined.");
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={invite} className="border border-rule rounded-[4px] p-4 mb-5 flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          className="flex-1 font-mono text-[12px] border border-rule rounded-[3px] bg-parchment-50 px-3 py-2 text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment-50 rounded-[3px] px-4 py-2 hover:bg-oxblood transition-colors disabled:opacity-50"
        >
          {busy ? "inviting…" : "Invite member"}
        </button>
      </form>
      {message ? <p className="mb-3 font-mono text-[11px] text-ink-muted">{message}</p> : null}

      {members.length === 0 ? (
        <p className="text-ink-muted text-[14px] py-2">No members yet.</p>
      ) : (
        <div>
          {members.map((m) => (
            <MemberRow key={m.id} slug={slug} member={m} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}
