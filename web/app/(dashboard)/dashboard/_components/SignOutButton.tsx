"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const sb = getSupabaseBrowser();
    await sb.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-oxblood transition-colors"
    >
      Sign out
    </button>
  );
}
