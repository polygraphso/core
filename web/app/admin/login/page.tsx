/**
 * /admin/login — single password field. Renders flat: lab register, not
 * marketing. No "Welcome back" copy, no animations. Just the form.
 *
 * Plain HTML form posts to /api/admin/login; works with JS disabled. On
 * error the route redirects back here with ?e=1 (bad password) or ?e=cfg
 * (env missing).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, isCookieValid } from "@/lib/admin-auth";

interface PageProps {
  searchParams: Promise<{ e?: string; next?: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // If already signed in, skip the form.
  const cookieStore = await cookies();
  const existing = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (isCookieValid(existing)) {
    redirect(params.next && params.next.startsWith("/admin") ? params.next : "/admin");
  }

  const errMessage =
    params.e === "cfg"
      ? "Server misconfigured. Set ADMIN_PASSWORD and ADMIN_COOKIE_SECRET."
      : params.e
        ? "Login failed."
        : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        action="/api/admin/login"
        method="post"
        className="w-full max-w-sm border border-[var(--color-rule)] bg-[var(--color-parchment-50)] p-8"
      >
        <h1 className="font-serif text-2xl mb-1">polygraph admin</h1>
        <p className="text-sm text-[var(--color-ink-muted)] mb-6">
          Internal tool. Shared password.
        </p>
        <label
          htmlFor="password"
          className="block text-xs uppercase tracking-wide text-[var(--color-ink-muted)] mb-2"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="w-full border border-[var(--color-rule)] bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:border-[var(--color-ink)]"
        />
        {params.next ? (
          <input type="hidden" name="next" value={params.next} />
        ) : null}
        <button
          type="submit"
          className="mt-4 w-full bg-[var(--color-ink)] text-[var(--color-parchment)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-oxblood)] transition-colors"
        >
          Sign in
        </button>
        {errMessage ? (
          <p className="mt-4 text-sm text-[var(--color-oxblood)] font-mono">
            {errMessage}
          </p>
        ) : null}
      </form>
    </main>
  );
}
