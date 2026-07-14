"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; email: string; name: string | null; avatarUrl: string | null; isAdmin: boolean };

// Shared client-side read of the Supabase session, used by both the desktop
// account slot (AuthSlot/UserMenu) and the mobile sheet (MobileNav). Renders as
// "loading" until hydration resolves it, keeping public pages ISR-compatible.
export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setState({ status: "anon" });
        return;
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      // app_metadata is set by the service role and included in the JWT — no
      // extra DB query, and no RLS to worry about.
      const isAdmin = (user.app_metadata as Record<string, unknown>)?.is_admin === true;
      setState({
        status: "authed",
        email: user.email ?? "",
        name: (meta.full_name ?? meta.name ?? meta.user_name ?? null) as string | null,
        avatarUrl: (meta.avatar_url ?? null) as string | null,
        isAdmin,
      });
    });
  }, []);

  return state;
}

/** Display name + up-to-two-letter initials for an avatar chip. */
export function identityOf(email: string, name: string | null) {
  const displayName = name ?? email.split("@")[0];
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = (
    parts.length > 1 ? parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1) : displayName.slice(0, 2)
  ).toUpperCase();
  return { displayName, initials };
}

/** The signed-in account links — every entry is a route that exists. */
export function accountItems(isAdmin: boolean): Array<{ href: string; label: string }> {
  return [
    { href: "/dashboard", label: "Your monitors" },
    { href: "/manage", label: "Your ecosystems" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
}

/** Sign out and return to the login page. Shared by desktop + mobile menus. */
export async function signOutAndRedirect(push: (href: string) => void) {
  await getSupabaseBrowser().auth.signOut();
  push("/login");
}
