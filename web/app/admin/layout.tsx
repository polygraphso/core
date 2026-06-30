import type { ReactNode } from "react";
import { AdminShell } from "./_components/AdminShell";

// Shared chrome for the whole admin surface. The public header/footer are
// suppressed under /admin (see SiteChrome in the root layout); this supplies
// the admin-specific shell — a persistent sidebar — in their place.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
