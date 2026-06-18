import { NextResponse, type NextRequest } from "next/server";
import { verifySession, ADMIN_COOKIE } from "@/lib/adminAuth";

// Gate the whole admin surface — the dashboard pages under /admin/* and the
// privileged JSON routes under /api/admin/* (attestations / publish / regrade,
// which carry no in-route auth of their own and rely on this gate). The login
// page and the login/logout endpoints must stay reachable without a session.
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

// Routes allowed through unauthenticated: the login page, the login POST (you
// can't have a session yet), and logout (idempotent cookie-clear).
const PUBLIC_PATHS = new Set([
  "/admin/login",
  "/api/admin/login",
  "/api/admin/logout",
]);

// Next 16 renamed the `middleware` file/function convention to `proxy`
// (see node_modules/next/dist/docs/.../proxy.md). Proxy runs on the Node.js
// runtime; `adminAuth` is Web Crypto based, which works there unchanged.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await verifySession(token, Math.floor(Date.now() / 1000));
  if (ok) return NextResponse.next();

  // API routes get a 401 (no HTML redirect for fetch/XHR callers); page
  // routes bounce to the branded login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}
