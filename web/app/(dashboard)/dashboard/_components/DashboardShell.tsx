"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "./DashboardSidebar";

interface Props {
  children: ReactNode;
  isAdmin?: boolean;
  showManage?: boolean;
}

export function DashboardShell({ children, isAdmin = false, showManage = false }: Props) {
  const pathname = usePathname() ?? "";
  return (
    <div className="min-h-screen sm:pl-56">
      <DashboardSidebar pathname={pathname} isAdmin={isAdmin} showManage={showManage} />
      {children}
    </div>
  );
}
