/**
 * Shared API base helper. Both `check` and `list` route through here.
 *
 * Override priority:
 *   1. `POLYGRAPH_API_URL` — full base URL, e.g. http://localhost:3000.
 *      `/api/cli/<command>` is appended for each command.
 *   2. Default — https://polygraph.so.
 *
 * The default is the live domain; the override exists for testing against
 * a local Next.js dev server.
 */

const DEFAULT_BASE = "https://polygraph.so";

export function apiBaseUrl(): string {
  const override = process.env.POLYGRAPH_API_URL;
  if (!override || override.length === 0) return DEFAULT_BASE;
  // Strip a trailing /api/cli/check from a v0.1.0-style override so users
  // upgrading from v0.1.0 don't have to update their POLYGRAPH_API_URL.
  // The 0.1.0 docs told them to point this at the full check URL.
  return override
    .replace(/\/+$/, "")
    .replace(/\/api\/cli\/check$/, "");
}

export function checkUrl(): string {
  return `${apiBaseUrl()}/api/cli/check`;
}

export function listUrl(): string {
  return `${apiBaseUrl()}/api/cli/list`;
}

export const NETWORK_FAILURE_LINE =
  "couldn't reach polygraph.so. try again, or check status at polygraph.so.";
