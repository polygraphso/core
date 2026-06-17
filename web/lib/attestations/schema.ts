/**
 * The EAS schema for polygraph grade attestations. This EXACT string is used
 * both to register the schema on-chain (scripts/register-schema.ts) and to
 * encode each attestation (encode.ts). It must never drift between the two.
 */
export const GRADE_SCHEMA =
  "string server,string version,string grade,string methodologyVersion,string toolDefsFingerprint,bytes32 evidenceHash,string evidenceURI,uint64 issuedAt";
