/**
 * A cheap, offline signal that a registry ref *is* an MCP server — the second
 * acceptance path for the request funnel's known-MCP gate (the first being
 * membership in our catalog). We can't prove MCP-ness without running the
 * server (that's grading), so we accept the near-universal naming convention:
 * an MCP package name carries an `mcp` or `server` token (tavily-mcp,
 * mcp-server-git, @modelcontextprotocol/server-git). A plain package name
 * (`context`, `benfica`, `react`) has neither and is rejected.
 *
 * Token-based, not substring — so `observer` doesn't match on "server".
 */
export function looksLikeMcpPackage(ref: string): boolean {
  const coord = ref.replace(/^(npm|pypi|github)\//, "");
  const tokens = coord.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.includes("mcp") || tokens.includes("server");
}
