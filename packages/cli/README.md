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

Tracked server:

```
→ tracked · top 10 adoption
→ polygraph: not yet available
→ notify me → polygraph.so/notify?for=npm/@modelcontextprotocol/server-filesystem
```

Untracked server:

```
→ not available yet
→ notify me → polygraph.so/notify?for=npm/obscure-mcp-server
```

In v0, behavioral polygraphs aren't published yet — every tracked server shows `polygraph: not yet available`. The adoption tier and notify URL are real; the polygraph result lands when the litmus harness ships.

## Configuration

Override the API endpoint (useful for testing):

```
POLYGRAPH_API_URL=http://localhost:3000/api/cli/check polygraphso check npm/lodash
```

## Links

- Site: https://polygraph.so
- Source: https://github.com/polygraphso/core
- Issues: https://github.com/polygraphso/core/issues
