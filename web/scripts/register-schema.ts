/**
 * One-off: register the grade schema on the active chain and print its UID.
 * Run once per chain (Base Sepolia first, then Base mainnet) and paste the
 * printed UID into EAS_SCHEMA_UID for that environment.
 *
 *   npx tsx --env-file=.env.local scripts/register-schema.ts
 */
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { getChainConfig } from "../lib/attestations/chains";
import { GRADE_SCHEMA } from "../lib/attestations/schema";

async function main() {
  const pk = process.env.ATTESTER_PRIVATE_KEY;
  const rpc = process.env.BASE_RPC_URL;
  if (!pk || !rpc) throw new Error("Set ATTESTER_PRIVATE_KEY and BASE_RPC_URL");

  const cfg = getChainConfig();
  const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc));
  console.log(`Registering on ${cfg.chain} (chainId ${cfg.chainId}) as ${wallet.address}`);

  const registry = new SchemaRegistry(cfg.schemaRegistry);
  registry.connect(wallet);

  const tx = await registry.register({
    schema: GRADE_SCHEMA,
    resolverAddress: ethers.ZeroAddress,
    revocable: true,
  });
  const uid = await tx.wait();
  console.log(`\nSchema registered. EAS_SCHEMA_UID=${uid}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
