# @polygraphso/mcp

MCP server for [polygraph.so](https://polygraph.so) — independent, lab-evaluated trust grades for MCP servers, exposed as native tools to any MCP client (Claude Desktop, Cursor, and others).

A polygraph is the behavioral trust grade polygraph.so issues for an MCP server: a letter grade (A/B/D/F) from an adversarial litmus test, backed by per-check results, a tool-surface fingerprint, and an evidence URL anyone can re-run. This package lets an agent check the polygraph for a server before recommending or installing it.

## Tools

- **`check_server`** — look up the published polygraph for a specific MCP server (`server_ref` like `npm/@modelcontextprotocol/server-filesystem`). An optional `@<version>` suffix looks up that exact version.
- **`list_servers`** — enumerate every server polygraph has graded, sorted by grade (A first).
- **`request_grade`** — add an ungraded server to polygraph's public grading queue. The natural follow-up when `check_server` returns `not_available`. Free and best-effort: polygraph runs the litmus test and publishes the grade, which you read later by calling `check_server` again. No contact details are asked of the agent.

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

`check_server({ server_ref: "npm/@modelcontextprotocol/server-filesystem" })` — a graded server:

```json
{
  "status": "graded",
  "polygraph": "A",
  "polygraph_detail": {
    "methodology_version": "litmus-v11",
    "resolved_version": "2.1.0",
    "evidence_url": "https://polygraph.so/mcp/npm/@modelcontextprotocol/server-filesystem"
  }
}
```

An ungraded server:

```json
{
  "status": "not_available",
  "notify_url": "https://polygraph.so/notify?for=npm/obscure-mcp-server",
  "message": "No published polygraph for npm/obscure-mcp-server yet — treat it as unevaluated. Call request_grade to add it to the public queue, or grade it yourself with the self_grade command.",
  "self_grade": "npx -y -p @polygraphso/litmus polygraphso-litmus litmus npm/obscure-mcp-server"
}
```

- `status` is `"graded"` when a published grade exists, `"not_available"` otherwise.
- `polygraph` is the published grade — `"A" | "B" | "D" | "F"` (no C).
- `polygraph_detail` carries the per-check results (C-01/C-02/C-03), the tool-surface fingerprint, the methodology version, and `resolved_version` (the version the grade was run against).
- On `not_available`: `message` explains the next steps, `self_grade` is a one-shot command to grade the server yourself, and `notify_url` is where a user can subscribe to be notified when the polygraph is published. Call `request_grade` to add the server to the public queue.

`list_servers()`:

```json
{
  "servers": [
    {
      "server_ref": "npm/@modelcontextprotocol/server-filesystem",
      "polygraph": "A"
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
