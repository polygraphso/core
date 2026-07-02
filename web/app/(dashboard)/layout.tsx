import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { DashboardShell } from "./dashboard/_components/DashboardShell";

// Dashboard-pages layout: the app shell (sidebar nav, sign-out) for the signed-in
// area. Covers /dashboard and /admin. /admin is gated upstream, so an admin here
// always resolves isAdmin=true from the session.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return <DashboardShell isAdmin={session?.isAdmin ?? false}>{children}</DashboardShell>;
}
