/**
 * /admin — internal dashboard.
 *
 * Server-rendered with the initial metrics payload (no flash of empty
 * state). A client island handles refresh + rescore — both pull from
 * /api/admin/metrics so the rescore status reflects the orchestrator's
 * actual progress.
 *
 * Voice: lab register. Terse labels, monospace numbers, no badges.
 */

import { redirect } from "next/navigation";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { getAdminMetrics } from "@/lib/admin-metrics";
import { AdminDashboard } from "./_components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }
  const initial = await getAdminMetrics();
  return <AdminDashboard initial={initial} />;
}
