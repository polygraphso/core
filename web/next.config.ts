import type { NextConfig } from "next";

/**
 * Baseline security headers, applied to every route. These are the
 * non-breaking directives — they harden framing, MIME-sniffing, referrer
 * leakage, plugin/object embedding, base-tag and form-action hijacking, and
 * pin TLS — without constraining which scripts/styles load (a full content
 * CSP with `script-src` needs per-request nonces and live verification, so it
 * is a tracked follow-up rather than a guess that silently breaks hydration).
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Apex only, 1 year, no includeSubDomains/preload — a conservative, easily
  // reversible TLS pin. includeSubDomains+preload is a long, hard-to-undo
  // commitment across every subdomain; revisit once all subdomains are
  // confirmed HTTPS-clean.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The MCP Security Index moved from /rankings to /mcp-index (matching the
  // "The Polygraph Index" brand). Permanent redirect so existing inbound links
  // — the litmus README, embeddable badges, search-engine equity — keep resolving.
  async redirects() {
    return [{ source: "/rankings", destination: "/mcp-index", permanent: true }];
  },
};

export default nextConfig;
