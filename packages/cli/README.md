# polygraphso

Look up the polygraph for an MCP server.

Polygraph publishes independent, lab-evaluated trust grades for AI agents and MCP servers. This CLI is a thin wrapper around the public lookup endpoint — a sub-second check against precomputed grades.

The npm package is `polygraphso` (the `polygraph` name was taken); the brand and product noun are still "polygraph".

## Install

```
npx polygraphso check npm/@modelcontextprotocol/server-filesystem
```

Or install globally:

```
npm i -g polygraphso
polygraphso check pypi/mcp-server-git
```

## Usage

```
polygraphso check <registry>/<owner>/<name>
polygraphso list [--json]
polygraphso --version
polygraphso --help
```

Registry-prefixed refs are required. `redis` exists on npm, pypi, and GitHub with different content — the prefix says which one you mean.

Examples:

```
polygraphso check npm/@modelcontextprotocol/server-filesystem
polygraphso check npm/lodash
polygraphso check pypi/mcp-server-git
polygraphso check github/anthropic/mcp-server-foo
```

## Output

Graded server:

```
→ polygraph: A · version 2.1.0 · litmus-v10 · 2026-06-24
→ evidence → polygraph.so/mcp/npm/@modelcontextprotocol/server-filesystem
```

The line carries the grade (A–F), the exact graded version, the methodology version, and the
date. If the version you'd actually run differs from the graded one, the check reports the
grade for the version in play and notes the gap:

```
→ polygraph: A · version 2.1.0 · litmus-v10 · 2026-06-24
→ note: graded 2.1.0; your version is 2.2.0 (not yet graded)
→ evidence → polygraph.so/mcp/npm/@modelcontextprotocol/server-filesystem
```

Untracked / not-yet-graded server:

```
→ not available yet
→ notify me → polygraph.so/notify?for=npm/obscure-mcp-server
```

Grades are read from the hosted runner's published results — this CLI never grades, it's a
sub-second lookup. To grade a server yourself, run the open harness (`@polygraphso/litmus`).

## Browse the tracked set

```
polygraphso list
```

Prints every graded MCP server as `server_ref | grade`, sorted by grade (A→F, then ref). Pipe through `jq` with `--json`:

```
polygraphso list --json | jq '.servers[] | select(.polygraph == "A")'
```

## Configuration

Override the API endpoint (useful for testing):

```
POLYGRAPH_API_URL=http://localhost:3000 polygraphso check npm/lodash
```

## Links

- Site: https://polygraph.so
- Source: https://github.com/polygraphso/core
- Issues: https://github.com/polygraphso/core/issues
