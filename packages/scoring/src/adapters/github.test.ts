import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGitHub, parseContributorsCount, computeReleaseCadence } from "./github.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("computeReleaseCadence", () => {
  const NOW = new Date("2026-06-01T00:00:00Z").getTime();
  const day = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  it("counts releases within the last year and averages spacing", () => {
    // Five releases, 30 days apart each → avg 30 days between, all in last year.
    const releases = [day(0), day(30), day(60), day(90), day(120)];
    expect(computeReleaseCadence(releases, NOW)).toEqual({
      release_count_last_year: 5,
      avg_days_between_releases: 30,
    });
  });

  it("excludes releases older than a year from the count but uses them in the average", () => {
    const releases = [day(10), day(50), day(380), day(740)]; // last two are >1y old
    const result = computeReleaseCadence(releases, NOW);
    expect(result.release_count_last_year).toBe(2);
    expect(result.avg_days_between_releases).toBeCloseTo(243.33, 1);
  });

  it("returns null avg when fewer than two releases exist", () => {
    expect(computeReleaseCadence([], NOW)).toEqual({
      release_count_last_year: 0,
      avg_days_between_releases: null,
    });
    expect(computeReleaseCadence([day(0)], NOW)).toEqual({
      release_count_last_year: 1,
      avg_days_between_releases: null,
    });
  });

  it("filters null / invalid entries", () => {
    expect(
      computeReleaseCadence([null, undefined, "not-a-date", day(10), day(40)], NOW),
    ).toEqual({
      release_count_last_year: 2,
      avg_days_between_releases: 30,
    });
  });
});

describe("parseContributorsCount", () => {
  it("extracts last-page number from Link header", () => {
    const link =
      '<https://api.github.com/repos/x/y/contributors?per_page=1&page=2>; rel="next", ' +
      '<https://api.github.com/repos/x/y/contributors?per_page=1&page=147>; rel="last"';
    expect(parseContributorsCount(link)).toBe(147);
  });

  it("returns 1 when no Link header", () => {
    expect(parseContributorsCount(null)).toBe(1);
  });

  it("returns 1 when Link has no `last` rel", () => {
    expect(parseContributorsCount('<...>; rel="next"')).toBe(1);
  });
});

describe("fetchGitHub", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    vi.restoreAllMocks();
  });

  it("throws when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(fetchGitHub("anthropics", "mcp-server-foo")).rejects.toThrow(
      /GITHUB_TOKEN is required/,
    );
  });

  it("returns parsed adapter data for a public repo", async () => {
    const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.endsWith("/repos/modelcontextprotocol/servers")) {
        return jsonResponse({
          stargazers_count: 50000,
          forks_count: 5800,
          archived: false,
          pushed_at: "2026-05-15T10:00:00Z",
          created_at: "2024-11-01T00:00:00Z",
        });
      }
      if (input.includes("/contributors")) {
        return new Response("", {
          status: 200,
          headers: {
            link:
              '<https://api.github.com/repos/x/y/contributors?per_page=1&page=2>; rel="next", ' +
              '<https://api.github.com/repos/x/y/contributors?per_page=1&page=312>; rel="last"',
          },
        });
      }
      if (input.includes("/search/issues") && input.includes("state:open")) {
        return jsonResponse({ total_count: 87 });
      }
      if (input.includes("/search/issues") && input.includes("state:closed")) {
        return jsonResponse({ total_count: 1240 });
      }
      if (input.endsWith("/stats/commit_activity")) {
        return jsonResponse(Array.from({ length: 52 }, (_, i) => ({ total: i + 1 })));
      }
      if (input.endsWith("/community/profile")) {
        return jsonResponse({
          files: {
            security: { url: "https://..." },
            contributing: { url: "https://..." },
          },
        });
      }
      if (input.includes("/releases?per_page=")) {
        return jsonResponse([
          { published_at: "2026-05-01T00:00:00Z" },
          { published_at: "2026-04-01T00:00:00Z" },
          { published_at: "2026-03-01T00:00:00Z" },
          { published_at: "2026-02-01T00:00:00Z" },
        ]);
      }
      throw new Error(`Unexpected URL: ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGitHub("modelcontextprotocol", "servers");
    expect(result).toMatchObject({
      owner: "modelcontextprotocol",
      repo: "servers",
      stars: 50000,
      forks: 5800,
      contributors_count: 312,
      archived: false,
      last_push_at: "2026-05-15T10:00:00Z",
      created_at: "2024-11-01T00:00:00Z",
      pr_count_open: 87,
      pr_count_closed: 1240,
      has_security_md: true,
      has_contributing_md: true,
    });
    expect(result?.commit_activity_last_year).toHaveLength(52);
    expect(result?.commit_activity_last_year[51]).toBe(52);
    expect(result?.release_count_last_year).toBe(4);
    expect(result?.avg_days_between_releases).not.toBeNull();

    // Sanity-check the token was attached.
    const repoCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/repos/modelcontextprotocol/servers"),
    );
    const headers = (repoCall?.[1] as RequestInit)?.headers as Record<string, string>;
    expect(headers?.Authorization).toBe("Bearer test-token");
  });

  it("returns null when the repo doesn't exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 })),
    );
    expect(await fetchGitHub("missing-owner", "missing-repo")).toBeNull();
  });

  it("returns empty commit_activity when GitHub responds 202 (stats still computing)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/repos/x/y")) {
          return jsonResponse({
            stargazers_count: 1,
            forks_count: 0,
            archived: false,
            pushed_at: "2026-05-01T00:00:00Z",
            created_at: "2026-04-01T00:00:00Z",
          });
        }
        if (input.endsWith("/stats/commit_activity")) {
          return new Response("", { status: 202 });
        }
        if (input.includes("/contributors")) {
          return new Response("", { status: 200 });
        }
        if (input.includes("/search/issues")) {
          return jsonResponse({ total_count: 0 });
        }
        if (input.endsWith("/community/profile")) {
          return new Response("Not Found", { status: 404 });
        }
        if (input.includes("/releases?per_page=")) {
          return jsonResponse([]);
        }
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchGitHub("x", "y");
    expect(result?.commit_activity_last_year).toEqual([]);
    expect(result?.has_security_md).toBe(false);
    expect(result?.has_contributing_md).toBe(false);
    expect(result?.release_count_last_year).toBe(0);
    expect(result?.avg_days_between_releases).toBeNull();
  });
});
