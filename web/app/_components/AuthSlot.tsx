"use client";

import { useAuthUser } from "./useAuthUser";
import { UserMenu } from "./UserMenu";

// Desktop account slot. Renders server-side as "Login" (no cookie read), then
// swaps to <UserMenu> after hydration if a session is found — keeping the root
// layout ISR-compatible for all public pages. On mobile the account lives in the
// nav sheet instead (SiteHeader hides this below `sm`).
export function AuthSlot() {
  const state = useAuthUser();

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
    // Negative margins keep the visual position; the padding grows the hit
    // area to the 44px tap-target floor without moving the label.
    <a
      href="/login"
      className="inline-flex min-h-[44px] items-center px-3 -mx-3 hover:text-ink transition-colors"
    >
      Login
    </a>
  );
}
