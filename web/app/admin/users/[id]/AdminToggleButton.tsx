"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  isAdmin: boolean;
}

export function AdminToggleButton({ userId, isAdmin }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: !isAdmin }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        alert(error ?? "Failed to update admin status.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`font-mono text-[11px] uppercase tracking-[0.16em] px-3 py-1.5 border hairline transition-colors disabled:opacity-50 ${
        isAdmin
          ? "text-oxblood border-oxblood hover:bg-oxblood/5"
          : "text-ink-muted border-rule hover:text-ink hover:border-ink"
      }`}
    >
      {busy ? "…" : isAdmin ? "Revoke admin" : "Grant admin"}
    </button>
  );
}
