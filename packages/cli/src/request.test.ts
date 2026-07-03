import { describe, expect, it } from "vitest";

import { __testing } from "./request.js";

const { formatQueued } = __testing;

describe("formatQueued", () => {
  it("reports a newly queued server with a check-back hint", () => {
    const out = formatQueued("npm/foo-mcp", { created: true, demand: 1 });
    expect(out).toMatch(/queued/i);
    expect(out).toContain("npm/foo-mcp");
    expect(out).toContain("polygraphso check npm/foo-mcp");
  });

  it("notes when the server was already in the queue, with the demand", () => {
    const out = formatQueued("npm/foo-mcp", { created: false, demand: 4 });
    expect(out).toMatch(/already/i);
    expect(out).toContain("4");
  });
});
