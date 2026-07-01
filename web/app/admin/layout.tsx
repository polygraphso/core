import type { ReactNode } from "react";
import { DashboardShell } from "../dashboard/_components/DashboardShell";

// The proxy gates this layout to admin users only, so isAdmin is always true here.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DashboardShell isAdmin={true}>{children}</DashboardShell>;
}
