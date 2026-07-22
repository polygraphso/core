import type { Metadata } from "next";
import { listRevenueStreams, opsSignerStatus } from "@/lib/streamClaims";
import { getTokenUsdRate } from "@/lib/ecosystemPayments";
import { Panel, EmptyNote } from "../_components/ui";
import { ClaimButton } from "./_components/ClaimButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Streams", robots: { index: false } };

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtToken(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtUsd(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS_CLS: Record<string, string> = {
  active: "text-ink border-rule",
  ended: "text-ink-faint border-rule",
  canceled: "text-oxblood border-oxblood/40",
  stopped: "text-oxblood border-oxblood/40",
};

export default async function StreamsPage() {
  const [streams, signer] = await Promise.all([listRevenueStreams(), opsSignerStatus()]);
  const rate = await getTokenUsdRate().catch(() => null);

  const totals = streams.reduce(
    (acc, s) => ({
      deposited: acc.deposited + s.deposited,
      withdrawn: acc.withdrawn + s.withdrawn,
      withdrawable: acc.withdrawable + s.withdrawable,
    }),
    { deposited: 0, withdrawn: 0, withdrawable: 0 },
  );

  const usd = (tokens: number) => (rate ? ` ≈ ${fmtUsd(tokens * rate)}` : "");

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Payment streams</h1>
        <p className="mt-2 text-[13px] text-ink-muted max-w-2xl">
          Every verified Sablier stream on the rail, read live from Base. Claiming withdraws the
          available balance to the stream&apos;s recipient (the treasury); the transaction is signed
          server-side by the ops key, which can only pay gas and the Sablier withdraw fee — funds
          can&apos;t go anywhere but the recipient.
        </p>
      </div>

      {signer.configured ? (
        <p className="mb-6 font-mono text-[11px] text-ink-muted">
          claim signer {shortAddr(signer.address ?? "")} · {signer.balanceEth?.toFixed(4) ?? "?"} ETH
          on Base for fees
          {(signer.balanceEth ?? 0) < 0.002 ? (
            <span className="text-oxblood"> · low — top it up before claiming</span>
          ) : null}
        </p>
      ) : (
        <p className="mb-6 font-mono text-[11px] text-oxblood">
          claim signer not configured — set PAYMENT_OPS_PRIVATE_KEY (server env; any funded wallet
          works, funds always land at the recipient)
        </p>
      )}

      <Panel label="Onchain" title={`Streams (${streams.length})`}>
        {streams.length === 0 ? (
          <EmptyNote>No payment streams yet.</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint border-b border-rule">
                  <th className="py-2 pr-4">Stream</th>
                  <th className="py-2 pr-4">Payer</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4 text-right">Claimed</th>
                  <th className="py-2 pr-4 text-right">Claimable</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {streams.map((s) => (
                  <tr key={`${s.kind}-${s.paymentId}`} className="border-b border-rule/60">
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-ink">#{s.streamId}</span>{" "}
                      <span className="text-ink-muted">
                        {s.kind === "ecosystem" ? `ecosystem · ${s.label}` : `plan · ${s.label}`}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-ink-muted">{shortAddr(s.payer)}</td>
                    <td className="py-2.5 pr-4 font-mono text-ink-muted whitespace-nowrap">
                      {s.startAt.slice(0, 10)} → {s.endAt.slice(0, 10)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-block border rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STATUS_CLS[s.status] ?? "text-ink-muted border-rule"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td
                      className="py-2.5 pr-4 text-right font-mono text-ink"
                      title={`${fmtToken(s.deposited)} POLYGRAPH${usd(s.deposited)}`}
                    >
                      {fmtToken(s.deposited)}
                    </td>
                    <td
                      className="py-2.5 pr-4 text-right font-mono text-ink-muted"
                      title={`${fmtToken(s.withdrawn)} POLYGRAPH${usd(s.withdrawn)}`}
                    >
                      {fmtToken(s.withdrawn)}
                    </td>
                    <td
                      className="py-2.5 pr-4 text-right font-mono text-ink"
                      title={`${fmtToken(s.withdrawable)} POLYGRAPH${usd(s.withdrawable)}`}
                    >
                      {fmtToken(s.withdrawable)}
                    </td>
                    <td className="py-2.5">
                      <ClaimButton
                        kind={s.kind}
                        paymentId={s.paymentId}
                        withdrawable={s.withdrawable}
                        disabled={!signer.configured}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-mono text-ink">
                  <td className="py-2.5 pr-4 text-ink-faint uppercase text-[10px] tracking-[0.14em]" colSpan={4}>
                    Totals (POLYGRAPH{rate ? " · ≈USD in titles" : ""})
                  </td>
                  <td className="py-2.5 pr-4 text-right" title={usd(totals.deposited).replace(" ≈ ", "")}>
                    {fmtToken(totals.deposited)}
                  </td>
                  <td className="py-2.5 pr-4 text-right" title={usd(totals.withdrawn).replace(" ≈ ", "")}>
                    {fmtToken(totals.withdrawn)}
                  </td>
                  <td className="py-2.5 pr-4 text-right" title={usd(totals.withdrawable).replace(" ≈ ", "")}>
                    {fmtToken(totals.withdrawable)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
