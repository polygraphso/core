import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "polygraph_admin";

// Next.js 16 renamed Middleware to Proxy (same functionality, file is `proxy.ts`,
// exported function is `proxy`). See node_modules/next/dist/docs proxy guide.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the login page and login endpoint through unauthenticated.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = process.env.ADMIN_TOKEN;
  const cookie = req.cookies.get(COOKIE)?.value;
  if (token && cookie === token) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
