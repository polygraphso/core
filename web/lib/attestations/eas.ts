import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { getChainConfig } from "./chains";
import { encodeFields, type GradeAttestationFields } from "./encode";

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

/** Build, sign, and submit an on-chain EAS attestation for a grade. */
export async function attestGrade(fields: GradeAttestationFields): Promise<AttestResult> {
  const schemaUid = process.env.EAS_SCHEMA_UID;
  if (!schemaUid) throw new Error("EAS_SCHEMA_UID must be set");

  const cfg = getChainConfig();
  const wallet = makeSigner();
  const eas = new EAS(cfg.easContract);
  eas.connect(wallet);

  const data = encodeFields(fields);
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
