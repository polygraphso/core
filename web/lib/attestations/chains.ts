/**
 * Per-chain EAS deployment config. EAS + SchemaRegistry share the same
 * predeploy addresses on both Base networks (OP-stack predeploys).
 * Verified against docs.attest.org/docs/quick--start/contracts.
 */
export type EasChain = "base" | "base-sepolia";

export interface ChainConfig {
  chain: EasChain;
  chainId: number;
  easContract: string;
  schemaRegistry: string;
  easscanBase: string;
}

const CONFIGS: Record<EasChain, ChainConfig> = {
  base: {
    chain: "base",
    chainId: 8453,
    easContract: "0x4200000000000000000000000000000000000021",
    schemaRegistry: "0x4200000000000000000000000000000000000020",
    easscanBase: "https://base.easscan.org",
  },
  "base-sepolia": {
    chain: "base-sepolia",
    chainId: 84532,
    easContract: "0x4200000000000000000000000000000000000021",
    schemaRegistry: "0x4200000000000000000000000000000000000020",
    easscanBase: "https://base-sepolia.easscan.org",
  },
};

/** Resolve the active chain config. Defaults to `base` (mainnet) in prod. */
export function getChainConfig(name: string = process.env.EAS_CHAIN ?? "base"): ChainConfig {
  const cfg = CONFIGS[name as EasChain];
  if (!cfg) {
    throw new Error(`Unknown EAS_CHAIN "${name}" (expected "base" or "base-sepolia")`);
  }
  return cfg;
}

/** Public easscan link for a given attestation UID. */
export function attestationUrl(cfg: ChainConfig, uid: string): string {
  return `${cfg.easscanBase}/attestation/view/${uid}`;
}
