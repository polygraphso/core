import { describe, it, expect } from "vitest";
import { getChainConfig, attestationUrl } from "./chains";

describe("getChainConfig", () => {
  it("returns Base mainnet config", () => {
    const c = getChainConfig("base");
    expect(c.chainId).toBe(8453);
    expect(c.easContract).toBe("0x4200000000000000000000000000000000000021");
    expect(c.schemaRegistry).toBe("0x4200000000000000000000000000000000000020");
    expect(c.easscanBase).toBe("https://base.easscan.org");
  });

  it("returns Base Sepolia config", () => {
    const c = getChainConfig("base-sepolia");
    expect(c.chainId).toBe(84532);
    expect(c.easscanBase).toBe("https://base-sepolia.easscan.org");
  });

  it("throws on unknown chain", () => {
    expect(() => getChainConfig("ethereum")).toThrow();
  });
});

describe("attestationUrl", () => {
  it("builds an easscan attestation URL", () => {
    const c = getChainConfig("base");
    expect(attestationUrl(c, "0xabc")).toBe(
      "https://base.easscan.org/attestation/view/0xabc",
    );
  });
});
