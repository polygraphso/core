import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { DashboardShell } from "./_components/DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return <DashboardShell isAdmin={session?.isAdmin ?? false}>{children}</DashboardShell>;
}
