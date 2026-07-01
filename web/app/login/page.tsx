import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./_components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · polygraph",
  robots: { index: false },
};

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");


  const { next = "/dashboard" } = await searchParams;
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <a
          href="/"
          className="inline-flex items-center gap-2.5 mb-8 hover:opacity-80 transition-opacity"
        >
          <span className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft" aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            polygraph.so
          </span>
        </a>
        <p className="section-label mb-3">Account</p>
        <h1 className="font-serif text-2xl text-ink mb-1">Sign in</h1>
        <p className="text-sm text-ink-muted mb-6">
          Monitor MCP servers for new-version regrades and manage your alerts.
        </p>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
