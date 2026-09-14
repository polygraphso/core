/**
 * GET /.well-known/x402 (rewritten here — the App Router ignores
 * dot-directories) — the x402 discovery fan-out document. Indexers
 * (x402scan, Bazaar crawlers) read it to find this origin's payable
 * endpoints, then probe each for its 402 challenge; runtime behavior stays
 * authoritative. Spec: x402scan docs/DISCOVERY.md ("well-known fan-out").
 */

import { SITE_ORIGIN } from "@/lib/site";
import { HOSTED_GRADING_DISABLED } from "@/lib/hostedGradingSunset";

export async function GET() {
  return Response.json(
    {
      version: 1,
      resources: HOSTED_GRADING_DISABLED ? [] : [`${SITE_ORIGIN}/api/x402/grade-request`],
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
