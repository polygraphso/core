# @polygraphso/mcp

MCP server for [polygraph.so](https://polygraph.so) — independent, lab-evaluated trust grades for MCP servers, exposed as native tools to any MCP client (Claude Desktop, Cursor, and others).

A polygraph is the result polygraph.so issues for an MCP server: an adoption tier (Top 10 / 25 / 50 / 100), and — once behavioral evaluation has run — an A–F grade plus an evidence URL. This package lets an agent check the polygraph for a server before recommending or installing it.

## Tools

- **`check_server`** — look up the polygraph for a specific MCP server (`server_ref` like `npm/@modelcontextprotocol/server-filesystem`).
- **`list_servers`** — enumerate every server polygraph tracks, tier-sorted.

`notify_about` (request a polygraph for an untracked server) lands in **v0.2** — the underlying endpoint isn't published yet.

## Install in Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "polygraph": {
      "command": "npx",
      "args": ["-y", "@polygraphso/mcp"]
    }
  }
}
```

Restart Claude Desktop. The two polygraph tools appear in the tool picker.

Try it:

> Use polygraph to check whether `npm/@modelcontextprotocol/server-filesystem` is safe to install.

## Install in Cursor

Cursor reads MCP servers from `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "polygraph": {
      "command": "npx",
      "args": ["-y", "@polygraphso/mcp"]
    }
  }
}
```

Reload the Cursor window after editing.

## Install in any other MCP client

The server speaks stdio. Anything that can launch a stdio MCP server with `npx -y @polygraphso/mcp` will work. The binary name is `polygraphso-mcp` if you want to invoke it directly.

## Local install

```
npm i -g @polygraphso/mcp
polygraphso-mcp   # talks JSON-RPC on stdin/stdout
```

## What it returns

`check_server({ server_ref: "npm/lodash" })`:

```json
{
  "status": "tracked",
  "adoption_tier": "top10",
  "polygraph": null,
  "notify_url": "https://polygraph.so/notify?for=npm/lodash"
}
```

- `status` is `"tracked"` if polygraph is evaluating the server, `"not_available"` otherwise.
- `adoption_tier` is `top10` / `top25` / `top50` / `top100`, or `null` if the server is tracked but unranked.
- `polygraph` is `null` until the behavioral evaluation lands (v0 has the adoption side; the litmus harness is shipping next).
- `notify_url` is where a user can subscribe to be notified when the polygraph is published.

`list_servers()`:

```json
{
  "servers": [
    {
      "server_ref": "npm/@modelcontextprotocol/server-filesystem",
      "adoption_tier": "top10",
      "polygraph": null
    }
  ],
  "total": 75
}
```

## Honest coverage

A server with no polygraph yet is **neither safe nor unsafe** — it's unevaluated. The tool surfaces this directly; agents using this MCP should pass that distinction through to the user.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `POLYGRAPH_API_URL` | `https://polygraph.so` | Override the API base, e.g. for local development (`http://localhost:3000`). |

## Links

- Site: https://polygraph.so
- CLI: https://www.npmjs.com/package/polygraphso (`npx polygraphso check <ref>`)
- Source: https://github.com/polygraphso/core
- Issues: https://github.com/polygraphso/core/issues

## License

Apache-2.0
