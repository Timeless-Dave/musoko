import { z } from 'zod';
import type { Claim, ClaimType, IsoDate, UserId } from '../types';

/**
 * Claims. "Verified" belongs to one claim, never to a farmer or a farm, and only
 * when an administrator has recorded what evidence was checked and on what day
 * (TRUST-2). Everything a farmer enters stays "farmer-reported" (TRUST-3).
 */

export const CLAIM_EVIDENCE_LIMITS = { min: 10, max: 300 } as const;

export type ClaimEvidenceError = 'evidence_required' | 'evidence_too_short' | 'evidence_too_long' | 'date_invalid' | 'date_future';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (now: Date): IsoDate => now.toISOString().slice(0, 10);

export function isRealDay(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The evidence note and the day it was checked. The day may not be in the future. */
export const verifyClaimSchema = z.object({
  evidenceChecked: z
    .string()
    .trim()
    .min(1, 'evidence_required')
    .min(CLAIM_EVIDENCE_LIMITS.min, 'evidence_too_short')
    .max(CLAIM_EVIDENCE_LIMITS.max, 'evidence_too_long'),
  verifiedOn: z.string().refine(isRealDay, 'date_invalid'),
});
export type VerifyClaimInput = z.input<typeof verifyClaimSchema>;

/** Null when the day is fine, else a code. Kept apart from the schema because it needs "now". */
export function checkVerificationDay(day: IsoDate, now: Date): ClaimEvidenceError | null {
  if (!isRealDay(day)) return 'date_invalid';
  return day > dayOf(now) ? 'date_future' : null;
}

/** Records the evidence on the claim. A claim already verified is replaced, so an administrator can correct the note. */
export function verifyClaim(claim: Claim, input: { evidenceChecked: string; verifiedOn: IsoDate; verifiedBy: UserId }): Claim {
  return {
    id: claim.id,
    farmerProfileId: claim.farmerProfileId,
    type: claim.type,
    label: claim.label,
    createdAt: claim.createdAt,
    status: 'verified',
    verification: {
      evidenceChecked: input.evidenceChecked.trim(),
      verifiedOn: input.verifiedOn,
      verifiedBy: input.verifiedBy,
    },
  };
}

/** Takes the verification off: the claim goes back to what it was, "farmer-reported". */
export function removeVerification(claim: Claim): Claim {
  return {
    id: claim.id,
    farmerProfileId: claim.farmerProfileId,
    type: claim.type,
    label: claim.label,
    createdAt: claim.createdAt,
    status: 'farmer_reported',
    verification: null,
  };
}

/** Claims an administrator has not yet checked, oldest first. */
export function claimsToCheck(claims: readonly Claim[]): Claim[] {
  return claims.filter((c) => c.status === 'farmer_reported').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const CLAIM_TYPES: readonly ClaimType[] = ['snap_ebt', 'practice', 'licence', 'certification'];
