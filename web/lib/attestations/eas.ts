import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { getChainConfig } from "./chains";

function makeSigner(): ethers.Wallet {
  const pk = process.env.ATTESTER_PRIVATE_KEY;
  const rpc = process.env.BASE_RPC_URL;
  if (!pk || !rpc) {
    throw new Error("ATTESTER_PRIVATE_KEY and BASE_RPC_URL must be set");
  }
  const provider = new ethers.JsonRpcProvider(rpc);
  return new ethers.Wallet(pk, provider);
}

export interface AttestResult {
  uid: string;
  txHash: string;
  attester: string;
}

/**
 * Sign and submit an on-chain EAS attestation. `data` is the ABI-encoded schema
 * payload (`encodeServerFields` / `encodeSkillFields`) and `schemaUid` selects
 * which registered schema it conforms to (server vs skill).
 */
export async function attestGrade(data: string, schemaUid: string): Promise<AttestResult> {
  if (!schemaUid) throw new Error("schema UID must be set");

  const cfg = getChainConfig();
  const wallet = makeSigner();
  const eas = new EAS(cfg.easContract);
  eas.connect(wallet);

  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: ethers.ZeroAddress,
      expirationTime: BigInt(0),
      revocable: true,
      data,
    },
  });
  const uid = await tx.wait();
  return { uid, txHash: tx.receipt?.hash ?? "", attester: wallet.address };
}
