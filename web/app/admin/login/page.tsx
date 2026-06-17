"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push("/admin/attestations");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Login failed");
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="font-serif text-2xl mb-6">Admin</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          className="border px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="border px-3 py-2 font-mono text-sm hover:bg-ink/5">
          Sign in
        </button>
        {err && <p className="text-oxblood text-xs">{err}</p>}
      </form>
    </main>
  );
}
