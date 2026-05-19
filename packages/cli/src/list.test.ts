import { describe, expect, it } from "vitest";

import { __testing } from "./list.js";

const { chooseRefWidth, truncate, padRight } = __testing;

describe("chooseRefWidth", () => {
  it("fits the longest ref when terminal is wide enough", () => {
    const refs = ["npm/lodash", "pypi/mcp-server-git"];
    expect(chooseRefWidth(refs, 120)).toBe("pypi/mcp-server-git".length);
  });

  it("caps at the MAX_WIDTH (100) budget on very wide terminals", () => {
    const huge = "npm/" + "x".repeat(120);
    // fixedTail = 4 + 8 + 4 + 9 = 25; cap = 100 - 25 = 75
    expect(chooseRefWidth([huge], 200)).toBe(75);
  });

  it("respects narrow terminals (80 cols)", () => {
    const longest = "npm/@modelcontextprotocol/server-filesystem";
    const refs = [longest, "npm/lodash"];
    // fixedTail = 25; cap = 80 - 25 = 55. longest fits, so we pick its length.
    expect(chooseRefWidth(refs, 80)).toBe(longest.length);
  });

  it("never goes below the MIN_REF_WIDTH floor on very narrow terminals", () => {
    const refs = ["npm/x"];
    // Terminal is 30 cols, fixedTail = 25, so naive cap would be 5,
    // but the floor is 30. Pick 5 (since longest is shorter), but cap
    // is still computed via floor: max(30, min(30, 100) - 25) = 30.
    // longest = 5, so result is min(5, 30) = 5.
    expect(chooseRefWidth(refs, 30)).toBe(5);
  });
});

describe("truncate", () => {
  it("leaves short strings alone", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("appends ellipsis when over width", () => {
    expect(truncate("npm/very-long-name", 10)).toBe("npm/very-…");
  });
});

describe("padRight", () => {
  it("pads to the requested width", () => {
    expect(padRight("hi", 5)).toBe("hi   ");
  });

  it("leaves over-width strings untouched", () => {
    expect(padRight("hello world", 5)).toBe("hello world");
  });
});
