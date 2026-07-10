import "server-only";

/**
 * The one question every public surface asks about an ecosystem: is its
 * monitoring active (a live POLYGRAPH stream, or comped)? Read from the same
 * payment gate the console enforces, filtered to what's publicly shown.
 * Consumers: the homepage strip + featured cards, the /ecosystems hub ordering,
 * and the per-ecosystem "monitored" badge.
 */

import { listEcosystems } from "@/lib/ecosystemData";
import { getPaymentGate } from "@/lib/ecosystemPayments";
import type { EcosystemRow } from "@/lib/ecosystemTypes";

export async function listMonitoredEcosystems(): Promise<EcosystemRow[]> {
  const all = await listEcosystems();
  const candidates = all.filter((e) => e.is_public && e.is_listed);
  const gates = await Promise.all(candidates.map((e) => getPaymentGate(e)));
  return candidates.filter((_, i) => gates[i]!.status === "active");
}

export async function monitoredSlugSet(): Promise<Set<string>> {
  return new Set((await listMonitoredEcosystems()).map((e) => e.slug));
}
