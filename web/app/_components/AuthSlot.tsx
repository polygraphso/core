"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { UserMenu } from "./UserMenu";

// Renders server-side as "Login" (no cookie read, no dynamic opt-in).
// After hydration, swaps to <UserMenu> if a session is found.
// This keeps the root layout ISR-compatible for all public pages.
export function AuthSlot() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "anon" }
    | { status: "authed"; email: string; name: string | null; avatarUrl: string | null; isAdmin: boolean }
  >({ status: "loading" });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setState({ status: "anon" }); return; }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

      // app_metadata is set by the service role and included in the JWT —
      // no extra DB query needed, and no RLS to worry about.
      const isAdmin =
        (user.app_metadata as Record<string, unknown>)?.is_admin === true;

      setState({
        status: "authed",
        email: user.email ?? "",
        name: (meta.full_name ?? meta.name ?? meta.user_name ?? null) as string | null,
        avatarUrl: (meta.avatar_url ?? null) as string | null,
        isAdmin,
      });
    });
  }, []);

  if (state.status === "loading") {
    // Invisible placeholder to avoid layout shift — same width as "Login"
    return <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-0 pointer-events-none">Login</span>;
  }
  if (state.status === "authed") {
    return (
      <UserMenu
        email={state.email}
        name={state.name}
        avatarUrl={state.avatarUrl}
        isAdmin={state.isAdmin}
      />
    );
  }
  return (
    <a href="/login" className="hover:text-ink transition-colors">
      Login
    </a>
  );
}
