import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { listEcosystemsForUser } from "@/lib/ecosystemAccess";
import { DashboardShell } from "./dashboard/_components/DashboardShell";

// Dashboard-pages layout: the app shell (sidebar nav, sign-out) for the signed-in
// area. Covers /dashboard, /admin, and /manage. /admin is gated upstream, so an
// admin here always resolves isAdmin=true from the session. The "Manage" tab shows
// only for app admins and users who belong to an ecosystem (so a plain user never
// sees a dead-end tab) — the membership check is skipped for admins, who always see it.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const isAdmin = session?.isAdmin ?? false;
  const showManage = isAdmin
    ? true
    : session
      ? (await listEcosystemsForUser(session)).length > 0
      : false;
  return (
    <DashboardShell isAdmin={isAdmin} showManage={showManage}>
      {children}
    </DashboardShell>
  );
}
