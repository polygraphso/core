"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";

// The admin shell: wraps every admin page in the persistent rail (Metrics /
// Attestations / sign-out). The login screen is the one exception — you're not
// signed in yet, so navigation to the other sections is pointless. It gets a
// bare, focused, full-height layout instead.
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  if (pathname === "/admin/login") {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  return (
    <div className="min-h-screen sm:pl-56">
      <AdminSidebar pathname={pathname} />
      {children}
    </div>
  );
}
