/**
 * One-off: register the server + skill grade schemas on the active chain and
 * print their UIDs. Run once per chain (Base Sepolia first, then Base mainnet)
 * and paste the printed UIDs into EAS_SCHEMA_UID / EAS_SKILL_SCHEMA_UID for that
 * environment. Re-running is safe: EAS returns the existing UID for an
 * already-registered schema (the UID is a pure function of schema + resolver +
 * revocable, so it is the same value on every chain).
 *
 *   npx tsx --env-file=.env.local scripts/register-schema.ts
 */
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { getChainConfig } from "../lib/attestations/chains";
import { SERVER_SCHEMA, SKILL_SCHEMA } from "../lib/attestations/schema";

async function main() {
  const pk = process.env.ATTESTER_PRIVATE_KEY;
  const rpc = process.env.BASE_RPC_URL;
  if (!pk || !rpc) throw new Error("Set ATTESTER_PRIVATE_KEY and BASE_RPC_URL");

  const cfg = getChainConfig();
  const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc));
  console.log(`Registering on ${cfg.chain} (chainId ${cfg.chainId}) as ${wallet.address}`);

  const registry = new SchemaRegistry(cfg.schemaRegistry);
  registry.connect(wallet);

  async function register(schema: string): Promise<string> {
    const tx = await registry.register({ schema, resolverAddress: ethers.ZeroAddress, revocable: true });
    return tx.wait();
  }

  const serverUid = await register(SERVER_SCHEMA);
  console.log(`\nEAS_SCHEMA_UID=${serverUid}`);
  const skillUid = await register(SKILL_SCHEMA);
  console.log(`EAS_SKILL_SCHEMA_UID=${skillUid}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
