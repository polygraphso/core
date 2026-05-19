import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchPypi,
  extractGithubFromPypiInfo,
  toPypiWeeklyDownloads,
} from "./pypi.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("extractGithubFromPypiInfo", () => {
  it("finds github via project_urls", () => {
    expect(
      extractGithubFromPypiInfo({
        version: "1.0.0",
        project_urls: { Source: "https://github.com/owner/repo" },
      }),
    ).toEqual({ owner: "owner", repo: "repo" });
  });

  it("falls back to home_page", () => {
    expect(
      extractGithubFromPypiInfo({
        version: "1.0.0",
        home_page: "https://github.com/anthropics/mcp",
      }),
    ).toEqual({ owner: "anthropics", repo: "mcp" });
  });

  it("strips .git suffix", () => {
    expect(
      extractGithubFromPypiInfo({
        version: "1.0.0",
        project_urls: { Homepage: "https://github.com/x/y.git" },
      }),
    ).toEqual({ owner: "x", repo: "y" });
  });

  it("returns null when no github URL is present", () => {
    expect(
      extractGithubFromPypiInfo({ version: "1.0.0", home_page: "https://example.com" }),
    ).toBeNull();
    expect(extractGithubFromPypiInfo(undefined)).toBeNull();
  });
});

describe("toPypiWeeklyDownloads", () => {
  it("buckets the last 56 days into 8 weeks oldest-first", () => {
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      downloads: 10,
    }));
    const weeks = toPypiWeeklyDownloads({ data });
    expect(weeks).toHaveLength(8);
    expect(weeks.every((w) => w === 70)).toBe(true);
  });

  it("returns empty when fewer than 56 days available", () => {
    const data = Array.from({ length: 30 }, (_, i) => ({
      date: `d${i}`,
      downloads: 1,
    }));
    expect(toPypiWeeklyDownloads({ data })).toEqual([]);
  });

  it("returns empty when no data", () => {
    expect(toPypiWeeklyDownloads({})).toEqual([]);
  });
});

describe("fetchPypi", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed adapter data for a published package", async () => {
    const dailyData = Array.from({ length: 56 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      downloads: 100,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("pypi.org/pypi/")) {
          return jsonResponse({
            info: {
              version: "1.4.0",
              project_urls: { Source: "https://github.com/modelcontextprotocol/python-sdk" },
            },
            urls: [{ upload_time: "2026-05-10T00:00:00Z" }],
            releases: { "1.4.0": [{ upload_time: "2026-05-10T00:00:00Z" }] },
          });
        }
        if (input.includes("pypistats.org") && input.endsWith("/recent")) {
          return jsonResponse({ data: { last_month: 50000, last_week: 12000 } });
        }
        if (input.includes("pypistats.org") && input.includes("/overall")) {
          return jsonResponse({ data: dailyData });
        }
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchPypi("mcp-server-git");
    expect(result).toEqual({
      package_name: "mcp-server-git",
      latest_version: "1.4.0",
      last_release_date: "2026-05-10T00:00:00Z",
      github_owner_repo: { owner: "modelcontextprotocol", repo: "python-sdk" },
      downloads_last_month: 50000,
      weekly_downloads: [700, 700, 700, 700, 700, 700, 700, 700],
    });
  });

  it("returns null when the package doesn't exist on PyPI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    expect(await fetchPypi("definitely-not-a-real-pkg-xyz")).toBeNull();
  });
});
