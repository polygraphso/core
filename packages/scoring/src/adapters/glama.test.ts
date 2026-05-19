import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchGlama,
  deriveGradesFromScorePage,
  extractToolCount,
} from "./glama.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
}

describe("deriveGradesFromScorePage", () => {
  it("returns F license when 'missing license' appears", () => {
    expect(deriveGradesFromScorePage("...Missing LICENSE found...")).toMatchObject({
      license_grade: "F",
    });
  });

  it("gives A security when no known vulnerabilities", () => {
    expect(deriveGradesFromScorePage("No known vulnerabilities reported")).toMatchObject({
      security_grade: "A",
    });
  });

  it("gives D security when vulnerabilities reported", () => {
    expect(deriveGradesFromScorePage("Known vulnerabilities: 3")).toMatchObject({
      security_grade: "D",
    });
  });

  it("maps positive checklist points to high quality grade", () => {
    const html = "Has README. Has a release. Provides tools.";
    expect(deriveGradesFromScorePage(html).quality_grade).toBe("A");
  });

  it("maps negative checklist signals to low quality grade", () => {
    const html = "Missing or invalid glama.json. No recent usage. Author not verified.";
    expect(deriveGradesFromScorePage(html).quality_grade).toBe("F");
  });
});

describe("extractToolCount", () => {
  it("parses 'N tools' patterns", () => {
    expect(extractToolCount("This server exposes 12 tools for AI")).toBe(12);
  });

  it("returns null when no tool count appears", () => {
    expect(extractToolCount("nothing here")).toBeNull();
  });
});

describe("fetchGlama", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns API identity + scraped grades when both succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/api/mcp/v1/servers/")) {
          return jsonResponse({
            namespace: "modelcontextprotocol",
            slug: "server-filesystem",
            repository: { url: "https://github.com/modelcontextprotocol/servers" },
            spdxLicense: { name: "MIT" },
          });
        }
        if (input.endsWith("/score")) {
          return htmlResponse(
            "<html>No known vulnerabilities. Has README. Has a release. 8 tools.</html>",
          );
        }
        // main server page
        return htmlResponse("<html>8 tools available</html>");
      }),
    );

    const result = await fetchGlama("modelcontextprotocol", "server-filesystem");
    expect(result).toMatchObject({
      namespace: "modelcontextprotocol",
      slug: "server-filesystem",
      repository_url: "https://github.com/modelcontextprotocol/servers",
      spdx_license: "MIT",
      security_grade: "A",
      tool_count: 8,
    });
  });

  it("returns null when the server isn't on Glama", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    expect(await fetchGlama("nobody", "missing-server")).toBeNull();
  });
});
