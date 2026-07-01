"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "./DashboardSidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="min-h-screen sm:pl-56">
      <DashboardSidebar pathname={pathname} />
      {children}
    </div>
  );
}
