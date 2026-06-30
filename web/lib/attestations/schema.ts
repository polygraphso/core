/**
 * The EAS schemas for polygraph grade attestations — kept in LOCKSTEP with the
 * canonical definitions in the public litmus repo
 * (`litmus/packages/onchain/src/eas.ts` `LITMUS_SCHEMA` and
 * `eas-skill.ts` `LITMUS_SKILL_SCHEMA`). These EXACT strings are used both to
 * register the schemas on-chain (`scripts/register-schema.ts`) and to encode
 * each attestation (`encode.ts`). They must never drift between the two repos —
 * a verifier reads with litmus, so a mismatch makes an attestation unreadable.
 *
 * Every probe category is a per-category `uint8` slot (`0=pass, 1=fail,
 * 2=skipped`); a category absent from an older methodology version encodes as
 * the skipped sentinel, disambiguated by `methodologyVersion`. Evidence is
 * referenced by `bytes32 evidenceHash` (keccak256 of the canonical bundle) plus
 * a public `evidenceURI` — no IPFS.
 */
export const SERVER_SCHEMA =
  "string serverRef,bytes32 toolDefsFingerprint,uint8 gradeC01,uint8 gradeC02,uint8 gradeC03,uint8 gradeC04,string overallGrade,bytes32 evidenceHash,string evidenceURI,string methodologyVersion,uint64 ranAt,string resolvedVersion";

// litmus-skill-v1 grades exactly S-01/S-03/S-04; S-02 and S-05 are advisory
// (a static scan can't decide them), so they have no on-chain slot.
export const SKILL_SCHEMA =
  "string skillRef,bytes32 contentHash,uint8 gradeS01,uint8 gradeS03,uint8 gradeS04,string overallGrade,bytes32 evidenceHash,string evidenceURI,string methodologyVersion,uint64 ranAt,string resolvedRef";
