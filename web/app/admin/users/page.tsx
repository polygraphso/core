import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EmptyNote } from "../_components/ui";
import { Pagination } from "../_components/Pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Users · Admin", robots: { index: false } };

const PAGE_SIZE = 25;

interface MonitorRow { user_id: string | null; unsubscribed_at: string | null; }

function githubUrl(u: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): string | null {
  const provider = u.app_metadata?.provider as string | undefined;
  const username = u.user_metadata?.user_name as string | undefined;
  if (provider === "github" && username) return `https://github.com/${username}`;
  return null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const db = getSupabaseAdmin();
  if (!db) return <main className="w-full px-8 py-12"><EmptyNote>Supabase not configured.</EmptyNote></main>;

  const [usersResult, monitorsResult] = await Promise.all([
    db.auth.admin.listUsers({ page, perPage: PAGE_SIZE }),
    db.from("monitors").select("user_id, unsubscribed_at"),
  ]);

  const users = usersResult.data?.users ?? [];
  const total = (usersResult.data as { total?: number } | null)?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const monitors = (monitorsResult.data ?? []) as MonitorRow[];

  const monitorStats = new Map<string, { total: number; active: number }>();
  for (const m of monitors) {
    if (!m.user_id) continue;
    const s = monitorStats.get(m.user_id) ?? { total: 0, active: 0 };
    s.total++;
    if (!m.unsubscribed_at) s.active++;
    monitorStats.set(m.user_id, s);
  }

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Users</h1>
        <p className="text-sm text-ink-muted mt-1">{total} registered</p>
      </div>

      {users.length === 0 ? (
        <EmptyNote>No users yet.</EmptyNote>
      ) : (
        <>
          <div className="border hairline overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b hairline bg-parchment-50">
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Email</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden md:table-cell">Method</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden sm:table-cell">Last sign in</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden sm:table-cell">Joined</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right">Monitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {users.map((u) => {
                  const provider = u.app_metadata?.provider as string | undefined;
                  const stats = monitorStats.get(u.id);
                  return (
                    <tr key={u.id} className="hover:bg-ink/[0.02] cursor-pointer transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a href={`/admin/users/${u.id}`} className="font-mono text-xs text-ink group-hover:text-oxblood transition-colors truncate max-w-[200px]">
                            {u.email}
                          </a>
                          {githubUrl(u) && (
                            <a href={githubUrl(u)!} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-[10px] text-ink-faint hover:text-ink transition-colors" title="GitHub profile">
                              ↗
                            </a>
                          )}
                        </div>
                        {(u.user_metadata?.full_name ?? u.user_metadata?.user_name) && (
                          <p className="font-mono text-[10px] text-ink-faint mt-0.5">
                            {(u.user_metadata?.full_name ?? u.user_metadata?.user_name) as string}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {provider && (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint border hairline px-1.5 py-0.5">
                            {provider}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-muted hidden sm:table-cell tabular">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-muted hidden sm:table-cell tabular">
                        {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-ink-muted tabular">
                        {stats ? `${stats.active} / ${stats.total}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/admin/users?page=${p}`} />
        </>
      )}
    </main>
  );
}
