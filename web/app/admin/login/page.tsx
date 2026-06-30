import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const ERRORS: Record<string, string> = {
  "1": "Incorrect password.",
  rate: "Too many attempts. Wait a minute and try again.",
  config: "Admin password is not configured on the server.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Could not sign in." : null;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <p className="section-label mb-3">Restricted</p>
        <h1 className="font-serif text-2xl text-ink mb-1">Admin access</h1>
        <p className="text-sm text-ink-muted mb-6">
          Enter the shared password to view usage metrics.
        </p>

        <form method="post" action="/api/admin/login" className="space-y-4">
          <div>
            <label htmlFor="password" className="section-label block mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              className="w-full rounded-sm border border-rule bg-parchment-50 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-oxblood"
            />
          </div>

          {message && (
            <p className="text-sm text-oxblood" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-sm bg-ink px-4 py-2 font-mono text-sm text-parchment hover:bg-oxblood transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
