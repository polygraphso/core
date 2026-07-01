"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// The public chrome — marketing nav + footer — is rendered once in the root
// layout, so it lands on every route, including /admin where it doesn't belong
// (and where it shows links like "Get a badge" that make no sense for an
// internal tool). The admin area has its own shell (sidebar nav, sign-out), so
// here we simply drop the public header/footer for anything under /admin and
// let the admin layout supply its own chrome. Every other route renders exactly
// as before.
//
// `header`/`footer` arrive as already-rendered server components passed in as
// props; this client boundary only decides whether to include them in the tree
// — it does not re-run them on the client.
export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const hasOwnChrome =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/login");
  if (hasOwnChrome) return <>{children}</>;
  return (
    <>
      {header}
      {children}
      {footer}
    </>
  );
}
