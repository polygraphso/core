/**
 * GET /api/admin/metrics — dashboard data payload (refresh + polling).
 * Cookie-gated. Identical shape to the SSR-time fetch.
 */

import { NextResponse } from "next/server";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { getAdminMetrics } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const metrics = await getAdminMetrics();
  return NextResponse.json(metrics);
}
