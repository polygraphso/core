import { describe, it, expect } from "vitest";
import {
  stripVersion,
  normalizeUrlTarget,
  npmNameFromPackageJson,
  parseGlamaConfigTarget,
  parseReadmeRunCommands,
  matchesServerName,
} from "./resolve.js";

describe("stripVersion", () => {
  it("strips a trailing @version from an unscoped package", () => {
    expect(stripVersion("tavily-mcp@latest")).toBe("tavily-mcp");
    expect(stripVersion("mcp-server-git@1.2.3")).toBe("mcp-server-git");
  });

  it("strips a trailing @version from a scoped package but keeps the scope", () => {
    expect(stripVersion("@modelcontextprotocol/server-github@0.4.2")).toBe(
      "@modelcontextprotocol/server-github",
    );
    expect(stripVersion("@upstash/context7-mcp")).toBe("@upstash/context7-mcp");
  });

  it("leaves a bare name untouched", () => {
    expect(stripVersion("tavily-mcp")).toBe("tavily-mcp");
    expect(stripVersion("@scope/name")).toBe("@scope/name");
  });
});

describe("normalizeUrlTarget", () => {
  it("strips the query string (placeholder auth params) and a trailing slash", () => {
    expect(normalizeUrlTarget("https://mcp.tavily.com/mcp/?tavilyApiKey=<your-api-key>")).toBe(
      "https://mcp.tavily.com/mcp",
    );
    expect(normalizeUrlTarget("https://mcp.goweb3.fyi/mcp/")).toBe("https://mcp.goweb3.fyi/mcp");
  });

  it("leaves a clean base URL untouched", () => {
    expect(normalizeUrlTarget("https://mcp.li.quest/mcp")).toBe("https://mcp.li.quest/mcp");
    expect(normalizeUrlTarget("https://mcp.web3auth.io")).toBe("https://mcp.web3auth.io");
  });
});

describe("npmNameFromPackageJson", () => {
  it("returns the name for a public package", () => {
    expect(npmNameFromPackageJson('{"name":"tavily-mcp","version":"1.0.0"}')).toBe("tavily-mcp");
  });

  it("returns null for a private / workspace-root package.json", () => {
    expect(npmNameFromPackageJson('{"name":"@upstash/context7","private":true}')).toBeNull();
  });

  it("returns null when there is no name or the JSON is unparseable", () => {
    expect(npmNameFromPackageJson('{"version":"1.0.0"}')).toBeNull();
    expect(npmNameFromPackageJson("not json")).toBeNull();
  });
});

// Fixtures mirror the real (HTML-entity-escaped) shape of Glama server pages.
const esc = (s: string) => s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("parseGlamaConfigTarget", () => {
  it("resolves a structured npx config to an npm ref, preferring npm over a remote block", () => {
    // Tavily's page lists mcp-remote blocks BEFORE the npm block; npm must win.
    const html = esc(
      `<code>{ "mcpServers": { "tavily-mcp": { "command": "npx -y mcp-remote https://mcp.tavily.com/mcp/?tavilyApiKey=<your-api-key>", "env": {} } } }</code>` +
        `<code>{ "mcpServers": { "tavily-mcp": { "command": "npx", "args": ["-y", "tavily-mcp@latest"], "env": { "TAVILY_API_KEY": "x" } } } }</code>`,
    );
    expect(parseGlamaConfigTarget(html)).toEqual({
      kind: "npm",
      target: "npm/tavily-mcp",
      source: "glama_config",
    });
  });

  it("resolves a remote-only server (mcp-remote) to its https URL", () => {
    const html = esc(
      `"command": "npx -y mcp-remote https://mcp.example.com/mcp/?apiKey=<key>", "env": {}`,
    );
    expect(parseGlamaConfigTarget(html)).toEqual({
      kind: "url",
      target: "https://mcp.example.com/mcp",
      source: "glama_config",
    });
  });

  it("resolves a monorepo to its first npm package (the representative)", () => {
    const html = esc(
      `"command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] } } }` +
        `"command": "cmd", "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-memory"] } } }` +
        `"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] }, ` +
        `"git": { "command": "uvx", "args": ["mcp-server-git", "--repository", "path"] }, ` +
        `"github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }`,
    );
    expect(parseGlamaConfigTarget(html)).toEqual({
      kind: "npm",
      target: "npm/@modelcontextprotocol/server-memory",
      source: "glama_config",
    });
  });

  it("resolves a uvx config to a pypi ref", () => {
    const html = esc(`"command": "uvx", "args": ["mcp-server-git", "--repository", "x"]`);
    expect(parseGlamaConfigTarget(html)).toEqual({
      kind: "pypi",
      target: "pypi/mcp-server-git",
      source: "glama_config",
    });
  });

  it("resolves a uvx --from config to the package after --from", () => {
    const html = esc(`"command": "uvx", "args": ["--from", "some-pkg", "some-command"]`);
    expect(parseGlamaConfigTarget(html)).toEqual({
      kind: "pypi",
      target: "pypi/some-pkg",
      source: "glama_config",
    });
  });

  it("returns null for an npx github-shorthand / non-registry install", () => {
    // `npx -y github:owner/repo` launches straight from a repo — not a gradeable npm ref.
    expect(
      parseGlamaConfigTarget(esc(`"command": "npx", "args": ["-y", "github:aithink001/lemgen-mcp"]`)),
    ).toBeNull();
    expect(
      parseGlamaConfigTarget(esc(`"command": "uvx", "args": ["--from", "git+https://x.git", "run"]`)),
    ).toBeNull();
  });

  it("returns null for docker-only servers (not gradeable in v1)", () => {
    const html = esc(`"command": "docker", "args": ["run", "-i", "--rm", "mcp/foo"]`);
    expect(parseGlamaConfigTarget(html)).toBeNull();
  });

  it("returns null for a local-build (node/python) command", () => {
    const html = esc(`"command": "node", "args": ["build/index.js"]`);
    expect(parseGlamaConfigTarget(html)).toBeNull();
  });

  it("does NOT treat a bare page-chrome url as a target (punkpeye landmine)", () => {
    const html = esc(`some prose "url": "https://github.com/punkpeye" more chrome`);
    expect(parseGlamaConfigTarget(html)).toBeNull();
  });

  it("returns null when there is no config block at all (e.g. context7)", () => {
    expect(parseGlamaConfigTarget("<div>Install with npx ctx7 setup</div>")).toBeNull();
  });
});

// Tier 3: recover a target from a README/code-block shell command (not the
// structured mcpServers JSON) — the form `rsi-search-pro-mcp` / `unraid-mcp` use.
describe("parseReadmeRunCommands", () => {
  it("extracts a uvx run command as a pypi candidate", () => {
    expect(parseReadmeRunCommands("run it with: uvx unraid-mcp --port 8080")).toContainEqual({
      kind: "pypi",
      pkg: "unraid-mcp",
    });
  });

  it("extracts the `uv tool install` name (the published package) as pypi", () => {
    expect(parseReadmeRunCommands("uv tool install rsi-search-pro-mcp --python 3.12")).toContainEqual({
      kind: "pypi",
      pkg: "rsi-search-pro-mcp",
    });
  });

  it("extracts `uvx --from <pkg>` (skipping the trailing command)", () => {
    expect(parseReadmeRunCommands("uvx --from lumu-mcp-server lumu-mcp")).toContainEqual({
      kind: "pypi",
      pkg: "lumu-mcp-server",
    });
  });

  it("extracts an npx -y command as npm and stops at trailing markup", () => {
    // Rendered code blocks leave stray tags glued to the token.
    expect(parseReadmeRunCommands("<code>npx -y @kultur-dev/mcp-server</code></pre>")).toContainEqual({
      kind: "npm",
      pkg: "@kultur-dev/mcp-server",
    });
  });

  it("ignores generic tooling, the bare SDK, and install-only noise", () => {
    expect(
      parseReadmeRunCommands("npx tsc && npx wrangler dev; pip install mcp; uvx fastmcp"),
    ).toEqual([]);
  });

  it("ignores mcp-remote and create-* scaffolders", () => {
    expect(parseReadmeRunCommands("npx -y mcp-remote https://x ; npx create-foo bar")).toEqual([]);
  });

  it("ignores framework/build CLIs that appear in setup lines (never the server pkg)", () => {
    // `expo-mcp`'s README shows `npx expo start`; `expo` is the framework, not the server.
    expect(parseReadmeRunCommands("npx expo start ; npx next dev ; npx serve build")).toEqual([]);
  });
});

describe("matchesServerName", () => {
  it("matches when the package shares the server's significant name", () => {
    expect(matchesServerName("unraid-mcp", "unraid-mcp", "unraid-mcp")).toBe(true);
    expect(matchesServerName("rsi-search-pro-mcp", "rsi-search-pro-mcp", "rsi-search-pro-mcp")).toBe(true);
    expect(matchesServerName("mcp-google-oauth", "mcp-google-oauth", null)).toBe(true);
    expect(matchesServerName("lumu-mcp-server", "lumu-mcp", "lumu-mcp")).toBe(true);
  });

  it("rejects the bare SDK that only substring-collides with '…-mcp-server'", () => {
    expect(matchesServerName("mcp", "robot-framework-mcp-server", "robot-framework-mcp-server")).toBe(false);
  });

  it("rejects when the slug carries no signal beyond mcp/server", () => {
    expect(matchesServerName("kultur-mcp", "mcp-server", "mcp-server")).toBe(false);
  });

  it("rejects an unrelated tool that merely appears in the README", () => {
    expect(matchesServerName("wrangler", "my-weather-mcp", "my-weather-mcp")).toBe(false);
  });
});
