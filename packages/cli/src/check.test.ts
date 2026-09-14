import { describe, expect, it } from "vitest";

import { __testing } from "./check.js";

const { formatNotAvailable } = __testing;

describe("formatNotAvailable", () => {
  it("offers notify and not a hosted request", () => {
    const out = formatNotAvailable(
      "npm/foo-mcp",
      {},
      "polygraph.so/notify?for=npm/foo-mcp",
    );
    expect(out).toMatch(/not available/i);
    expect(out).not.toContain("polygraphso request");
    expect(out).toContain("polygraph.so/notify?for=npm/foo-mcp");
  });

  it("includes the self-grade command when the API provides one", () => {
    const out = formatNotAvailable(
      "npm/foo-mcp",
      { self_grade: "npx -y -p @polygraphso/litmus polygraphso-litmus litmus npm/foo-mcp" },
      "polygraph.so/notify?for=npm/foo-mcp",
    );
    expect(out).toContain("polygraphso-litmus litmus npm/foo-mcp");
  });

  it("omits the self-grade line when the API doesn't provide one", () => {
    const out = formatNotAvailable("npm/foo-mcp", {}, "polygraph.so/notify?for=npm/foo-mcp");
    expect(out).not.toMatch(/litmus/);
  });
});
