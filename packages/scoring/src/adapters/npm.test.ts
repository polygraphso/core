import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchNpm, extractGithubOwnerRepo, toWeeklyDownloads } from "./npm.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("extractGithubOwnerRepo", () => {
  it("parses string repository field", () => {
    expect(extractGithubOwnerRepo("https://github.com/anthropics/mcp-server-foo")).toEqual({
      owner: "anthropics",
      repo: "mcp-server-foo",
    });
  });

  it("parses object with git+https URL and .git suffix", () => {
    expect(
      extractGithubOwnerRepo({ url: "git+https://github.com/modelcontextprotocol/servers.git" }),
    ).toEqual({ owner: "modelcontextprotocol", repo: "servers" });
  });

  it("parses ssh-style URL", () => {
    expect(extractGithubOwnerRepo({ url: "ssh://git@github.com/owner/repo.git" })).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns null for non-github URLs", () => {
    expect(extractGithubOwnerRepo("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null when field is missing or malformed", () => {
    expect(extractGithubOwnerRepo(undefined)).toBeNull();
    expect(extractGithubOwnerRepo({})).toBeNull();
    expect(extractGithubOwnerRepo("not a url")).toBeNull();
  });
});

describe("toWeeklyDownloads", () => {
  it("buckets 56 daily counts into 8 weeks oldest-first", () => {
    const daily = Array.from({ length: 56 }, (_, i) => ({
      day: `d${i}`,
      downloads: i + 1, // 1..56
    }));
    const weeks = toWeeklyDownloads({ downloads: daily });
    expect(weeks).toHaveLength(8);
    // week 0 = 1+2+3+4+5+6+7 = 28
    expect(weeks[0]).toBe(28);
    // week 7 = 50+51+52+53+54+55+56 = 371
    expect(weeks[7]).toBe(371);
  });

  it("returns empty when no data", () => {
    expect(toWeeklyDownloads({ downloads: [] })).toEqual([]);
    expect(toWeeklyDownloads({})).toEqual([]);
  });

  it("drops partial trailing weeks", () => {
    const daily = Array.from({ length: 10 }, (_, i) => ({ day: `d${i}`, downloads: 1 }));
    expect(toWeeklyDownloads({ downloads: daily })).toEqual([7]);
  });
});

describe("fetchNpm", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed adapter data for a published package", async () => {
    const dailyDownloads = Array.from({ length: 56 }, (_, i) => ({
      day: `2026-01-${(i % 28) + 1}`,
      downloads: 100,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.startsWith("https://registry.npmjs.org/")) {
          return jsonResponse({
            "dist-tags": { latest: "0.5.0" },
            time: {
              created: "2025-08-01T00:00:00Z",
              modified: "2026-05-01T00:00:00Z",
              "0.5.0": "2026-05-01T00:00:00Z",
            },
            repository: {
              type: "git",
              url: "git+https://github.com/modelcontextprotocol/servers.git",
            },
            versions: { "0.5.0": {} },
          });
        }
        if (input.includes("downloads/point/last-month")) {
          return jsonResponse({ downloads: 123456, package: "x" });
        }
        if (input.includes("downloads/range/")) {
          return jsonResponse({ downloads: dailyDownloads });
        }
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchNpm("@modelcontextprotocol/server-filesystem");
    expect(result).toEqual({
      package_name: "@modelcontextprotocol/server-filesystem",
      latest_version: "0.5.0",
      last_publish_date: "2026-05-01T00:00:00Z",
      deprecated: false,
      github_owner_repo: { owner: "modelcontextprotocol", repo: "servers" },
      downloads_last_month: 123456,
      weekly_downloads: [700, 700, 700, 700, 700, 700, 700, 700],
    });
  });

  it("returns null when the package doesn't exist on npm", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.startsWith("https://registry.npmjs.org/")) {
          return new Response("Not found", { status: 404 });
        }
        return new Response("Not found", { status: 404 });
      }),
    );

    expect(await fetchNpm("definitely-not-a-real-pkg-xyz")).toBeNull();
  });

  it("flags deprecated when the latest version entry has a deprecated message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.startsWith("https://registry.npmjs.org/")) {
          return jsonResponse({
            "dist-tags": { latest: "1.0.0" },
            time: { "1.0.0": "2025-01-01T00:00:00Z" },
            versions: { "1.0.0": { deprecated: "please use @scope/new-pkg" } },
          });
        }
        if (input.includes("downloads/point/last-month")) {
          return jsonResponse({ downloads: 0 });
        }
        // downloads/range
        return jsonResponse({ downloads: [] });
      }),
    );

    const result = await fetchNpm("@old/pkg");
    expect(result?.deprecated).toBe(true);
    expect(result?.github_owner_repo).toBeNull();
  });
});
