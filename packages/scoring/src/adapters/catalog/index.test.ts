import { describe, it, expect } from "vitest";
import { normalizeRepoKey, canonicalKey } from "./index.js";
import type { RawListing } from "./types.js";

function listing(overrides: Partial<RawListing> = {}): RawListing {
  return { providerUid: "abc123", ...overrides };
}

describe("normalizeRepoKey", () => {
  it("strips protocol, .git, trailing slash, and lowercases", () => {
    expect(normalizeRepoKey("https://github.com/Owner/Repo.git")).toBe("github.com/owner/repo");
    expect(normalizeRepoKey("https://github.com/Owner/Repo/")).toBe("github.com/owner/repo");
    expect(normalizeRepoKey("http://github.com/Owner/Repo")).toBe("github.com/owner/repo");
  });

  it("drops a www. prefix", () => {
    expect(normalizeRepoKey("https://www.gitlab.com/A/B")).toBe("gitlab.com/a/b");
  });

  it("normalizes the git@ SSH form to the same key as https", () => {
    expect(normalizeRepoKey("git@github.com:Owner/Repo.git")).toBe("github.com/owner/repo");
  });

  it("collapses casing/.git/https differences to one key (cross-provider dedup)", () => {
    const a = normalizeRepoKey("https://github.com/Owner/Repo");
    const b = normalizeRepoKey("HTTPS://github.com/owner/repo.git");
    expect(a).toBe(b);
  });
});

describe("canonicalKey", () => {
  it("uses the normalized repo URL when present", () => {
    expect(canonicalKey("glama", listing({ repositoryUrl: "https://github.com/O/R.git" }))).toBe(
      "github.com/o/r",
    );
  });

  it("falls back to provider:uid when there is no repo", () => {
    expect(canonicalKey("glama", listing({ providerUid: "q4p13gj6ka" }))).toBe("glama:q4p13gj6ka");
  });

  it("treats a blank repo URL as no repo", () => {
    expect(canonicalKey("smithery", listing({ providerUid: "x", repositoryUrl: "   " }))).toBe(
      "smithery:x",
    );
  });
});
