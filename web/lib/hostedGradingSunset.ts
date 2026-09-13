/**
 * Hosted operator-run grading is discontinued. Existing published grades stay
 * on the site; the VPS is still up until teardown. The app must not enqueue
 * new work or take payment for a run that will not happen.
 */

export const HOSTED_GRADING_DISABLED = true;

export const HOSTED_GRADING_SUNSET_MESSAGE =
  "Hosted grading is discontinued. Existing published grades remain available. To grade a server yourself, run the open harness: npx -y -p @polygraphso/litmus polygraphso-litmus litmus <server>.";

/** 410 Gone — the JSON shape CLI / MCP / x402 callers already parse. */
export function hostedGradingGoneResponse(): Response {
  return Response.json({ error: HOSTED_GRADING_SUNSET_MESSAGE }, { status: 410 });
}
