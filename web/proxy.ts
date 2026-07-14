import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// All gated paths use Supabase SSR user auth. Admin paths additionally
// require is_admin = true in the profiles table.
//
// The unsubscribe endpoint (/api/monitor/unsubscribe) is token-authed from
// email links and must remain publicly reachable — it is explicitly excluded
// from the user gate.
export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/dashboard/:path*",
    "/manage/:path*",
    "/api/manage/:path*",
    "/monitor/:path*",
    "/notify/:path*",
    "/request/:path*",
    "/api/monitor/:path*",
    "/api/notify/:path*",
    "/api/grade-requests/:path*",
    "/api/account/:path*",
  ],
};

// Routes that bypass the user gate. The unsubscribe endpoint is token-authed
// from email links and must stay reachable without a Supabase session.
const USER_PUBLIC = new Set(["/api/monitor/unsubscribe"]);

async function userGate(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (USER_PUBLIC.has(pathname)) return NextResponse.next();

  // Supabase SSR pattern: create a mutable response so the client can refresh
  // tokens by writing updated cookies on both request AND response.
  let supabaseResponse = NextResponse.next({ request });

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!sbUrl || !sbKey) {
    return makeLoginRedirect(request, supabaseResponse);
  }

  const supabase = createServerClient(sbUrl, sbKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: object }>) {
        // Must write to request so the new cookies are visible within this
        // request, and to response so the browser receives them.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]),
        );
      },
    },
  });

  // IMPORTANT: getUser() (not getSession()) re-validates the JWT server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return makeLoginRedirect(request, supabaseResponse);

  // Admin paths require is_admin = true in app_metadata (service-role-set,
  // included in the JWT — no extra DB query needed).
  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminPath) {
    const isAdmin =
      (user.app_metadata as Record<string, unknown>)?.is_admin === true;
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

function makeLoginRedirect(
  request: NextRequest,
  supabaseResponse: NextResponse,
): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  const response = NextResponse.redirect(loginUrl);

  // Copy any refresh-token cookie writes so the browser receives them even
  // on a redirect.
  supabaseResponse.cookies
    .getAll()
    .forEach((c) => response.cookies.set(c.name, c.value));

  return response;
}

// Next 16 renamed the middleware file/function convention to `proxy`.
export async function proxy(request: NextRequest) {
  return userGate(request);
}
