import { describe, expect, it } from "vitest";

import { cliAgentId, listUrl } from "./api.js";

describe("cliAgentId", () => {
  it("reports this package's own name/version", () => {
    expect(cliAgentId()).toMatch(/^polygraphso-cli\/\d+\.\d+\.\d+$/);
  });
});

describe("listUrl", () => {
  it("carries the CLI's identity as query params", () => {
    const url = new URL(listUrl());
    expect(url.pathname).toBe("/api/cli/list");
    expect(url.searchParams.get("source")).toBe("cli");
    expect(url.searchParams.get("agent_id")).toMatch(/^polygraphso-cli\//);
  });
});
