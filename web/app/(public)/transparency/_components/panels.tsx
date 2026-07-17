/**
 * The three read-only panels of the transparency page: tokenomics, team vesting,
 * revenue. Server components — they take the fault-isolated read results (which
 * may be null) and render, degrading one panel at a time.
 */

import Link from "next/link";
import {
  formatPct,
  formatPriceUsd,
  formatTokens,
  formatUsd,
  formatUsdCompact,
  PUBLIC_SURFACE_LABEL,
  type PublicRevenue,
  type TokenStats,
  type VestingStatus,
} from "@/lib/transparency";
import { DistributionBar, MiniBars, ProgressBar, Swatch } from "./charts";

const BASESCAN = "https://basescan.org";

function fmtDate(epochSec: number | null): string {
  if (!epochSec || epochSec <= 0) return "—";
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

function shortAddr(a: string): string {
  return a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—";
}

// ── Shared layout ────────────────────────────────────────────────────────────

function Section({
  label,
  title,
  note,
  children,
}: {
  label: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[4px] border hairline bg-parchment-50 p-6">
      <div className="mb-5">
        <p className="section-label mb-1">{label}</p>
        <h2 className="font-serif text-xl text-ink leading-tight">{title}</h2>
        {note ? <p className="mt-1.5 text-[13px] text-ink-muted leading-relaxed">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ink tabular">{value}</p>
      {sub ? <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{sub}</p> : null}
    </div>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className="font-mono text-[12px] text-ink-faint leading-relaxed">
      {what} temporarily unavailable. The onchain read did not return; reload in a moment.
    </p>
  );
}

// ── Token panel ──────────────────────────────────────────────────────────────

export function TokenPanel({ stats }: { stats: TokenStats | null }) {
  return (
    <Section
      label="§1 · Token"
      title="$POLYGRAPH on Base"
      note="Supply, treasury holdings, and price, read live from Base mainnet and the deepest onchain market."
    >
      {!stats ? (
        <Unavailable what="Token data" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <Stat label="Price" value={stats.priceUsd != null ? formatPriceUsd(stats.priceUsd) : "—"} />
            <Stat label="Total supply" value={formatTokens(stats.totalSupply)} sub="POLYGRAPH" />
            <Stat label="FDV" value={stats.fdv != null ? formatUsdCompact(stats.fdv) : "—"} />
            <Stat
              label="Market cap"
              value={stats.marketCap != null ? formatUsdCompact(stats.marketCap) : "—"}
              sub="circulating"
            />
          </div>

          <div className="mt-7">
            <p className="section-label mb-2">Distribution</p>
            <DistributionBar slices={stats.distribution} />
            <ul className="mt-3 space-y-1.5">
              {stats.distribution.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-[13px]">
                  <Swatch slice={s.key} />
                  <span className="text-ink">{s.label}</span>
                  <span className="ml-auto font-mono text-[12px] text-ink-muted tabular">
                    {formatTokens(s.amount)} · {formatPct(s.pct)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t hairline pt-4 font-mono text-[11px] text-ink-muted">
            <span>
              Treasury holds{" "}
              <span className="text-ink">{formatTokens(stats.treasuryPolygraph)} POLYGRAPH</span>
              {stats.treasuryUsdc > 0 ? (
                <>
                  {" "}
                  + <span className="text-ink">{formatUsd(stats.treasuryUsdc)} USDC</span>
                </>
              ) : null}
            </span>
            {stats.treasuryAddress ? (
              <Link
                href={`${BASESCAN}/address/${stats.treasuryAddress}`}
                target="_blank"
                rel="noopener"
                className="hover:text-oxblood"
              >
                treasury {shortAddr(stats.treasuryAddress)} →
              </Link>
            ) : null}
            <Link
              href={`${BASESCAN}/token/${stats.contract}`}
              target="_blank"
              rel="noopener"
              className="hover:text-oxblood"
            >
              contract →
            </Link>
          </div>

          <p className="mt-3 font-mono text-[10.5px] text-ink-faint leading-relaxed">
            Circulating = total supply − team-locked (Sablier) − treasury. It includes liquidity
            pools and public holders.
          </p>
        </>
      )}
    </Section>
  );
}

// ── Vesting panel ────────────────────────────────────────────────────────────

export function VestingPanel({ vesting }: { vesting: VestingStatus | null }) {
  return (
    <Section
      label="§2 · Team vesting"
      title="Team tokens, locked onchain"
      note="The team's allocation is locked in a Sablier stream on Base: a contract, not a promise. It unlocks strictly on the schedule below, and nothing can be pulled forward."
    >
      {!vesting ? (
        <Unavailable what="Vesting data" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <Stat label="Locked" value={formatTokens(vesting.locked)} sub="not yet vested" />
            <Stat
              label="Unlocked"
              value={formatPct(vesting.pctUnlocked)}
              sub={`${formatTokens(vesting.streamed)} vested`}
            />
            <Stat label="Deposited" value={formatTokens(vesting.deposited)} sub="POLYGRAPH" />
            <Stat
              label="Withdrawn"
              value={formatTokens(vesting.withdrawn)}
              sub={vesting.status}
            />
          </div>

          <div className="mt-6">
            <ProgressBar pct={vesting.pctUnlocked} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-[11px] text-ink-muted">
            <span>
              Locked{" "}
              <span className="text-ink">
                {fmtDate(vesting.startAt)} → {fmtDate(vesting.endAt)}
              </span>
            </span>
            <span>
              Unlocks at cliff <span className="text-ink">{fmtDate(vesting.cliffAt)}</span>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t hairline pt-4 font-mono text-[11px] text-ink-muted">
            <span>Sablier Lockup · stream #{vesting.streamId}</span>
            <Link
              href={`${BASESCAN}/tx/${vesting.txHash}`}
              target="_blank"
              rel="noopener"
              className="hover:text-oxblood"
            >
              creation tx →
            </Link>
          </div>
        </>
      )}
    </Section>
  );
}

// ── Revenue panel ────────────────────────────────────────────────────────────

export function RevenuePanel({ revenue }: { revenue: PublicRevenue | null }) {
  return (
    <Section
      label="§3 · Revenue"
      title="What the work has earned"
      note="Every paid surface, booked from onchain settlement. Prepaid subscription streams count at their full deposit on the day they verify; MRR is the recurring lens."
    >
      {!revenue ? (
        <Unavailable what="Revenue data" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <Stat label="Total booked" value={formatUsd(revenue.totalBooked)} sub="all-time" />
            <Stat label="MRR" value={formatUsd(revenue.mrr)} sub={`${revenue.activeSubs} active subs`} />
            <Stat label="This month" value={formatUsd(revenue.bookedThisMonth)} />
            <Stat label="Active subs" value={String(revenue.activeSubs)} />
          </div>

          <div className="mt-7 divide-y divide-rule border-t hairline">
            {revenue.buckets.map((b) => (
              <div key={b.surface} className="flex items-baseline gap-3 py-2.5">
                <span className="text-[14px] text-ink">{PUBLIC_SURFACE_LABEL[b.surface]}</span>
                <span className="ml-auto font-mono text-[12px] text-ink-muted tabular">
                  {b.count} {b.count === 1 ? "buy" : "buys"}
                  {b.monthly > 0 ? ` · ${formatUsd(b.monthly)}/mo` : ""}
                </span>
                <span className="w-24 text-right font-serif text-[17px] text-ink tabular">
                  {formatUsd(b.booked)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-7">
            <p className="section-label mb-2">Booked per day · last 30 days</p>
            <MiniBars data={revenue.byDay} format={formatUsd} />
          </div>

          <p className="mt-5 font-mono text-[10.5px] text-ink-faint leading-relaxed">
            The $1 grade-request fee is an anti-spam commitment fee: it buys the run, never the
            grade. The recurring business is ecosystem monitoring and Pro plans (the MRR above).
          </p>
        </>
      )}
    </Section>
  );
}
