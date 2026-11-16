import { describe, expect, it } from 'vitest';
import { asId, type Claim, type ClaimId, type FarmerProfileId, type UserId } from '../types';
import { checkVerificationDay, claimsToCheck, removeVerification, verifyClaim, verifyClaimSchema } from './index';

const admin = asId<UserId>('u-admin');
const reported = (n: number, over: Partial<Claim> = {}): Claim =>
  ({
    id: asId<ClaimId>(`c${n}`), farmerProfileId: asId<FarmerProfileId>('f1'), type: 'licence', label: 'Egg handler licence',
    createdAt: `2026-10-0${n}T00:00:00.000Z`, status: 'farmer_reported', verification: null, ...over,
  }) as Claim;

describe('claim verification (TRUST-2)', () => {
  it('needs a recorded evidence note and a real day', () => {
    expect(verifyClaimSchema.safeParse({ evidenceChecked: 'Licence sighted by an administrator.', verifiedOn: '2026-11-10' }).success).toBe(true);
    // A form shows the first code for a field, so that is the one that counts.
    const codes = (input: unknown) => {
      const result = verifyClaimSchema.safeParse(input);
      return result.success ? [] : [result.error.issues[0]!.message];
    };
    expect(codes({ evidenceChecked: '   ', verifiedOn: '2026-11-10' })).toEqual(['evidence_required']);
    expect(codes({ evidenceChecked: 'ok', verifiedOn: '2026-11-10' })).toEqual(['evidence_too_short']);
    expect(codes({ evidenceChecked: 'x'.repeat(301), verifiedOn: '2026-11-10' })).toEqual(['evidence_too_long']);
    expect(codes({ evidenceChecked: 'Licence sighted by an administrator.', verifiedOn: '2026-02-31' })).toEqual(['date_invalid']);
    expect(codes({ evidenceChecked: 'Licence sighted by an administrator.', verifiedOn: 'yesterday' })).toEqual(['date_invalid']);
  });

  it('refuses a day in the future', () => {
    const now = new Date('2026-11-16T10:00:00.000Z');
    expect(checkVerificationDay('2026-11-16', now)).toBeNull();
    expect(checkVerificationDay('2026-11-17', now)).toBe('date_future');
    expect(checkVerificationDay('2026-13-01', now)).toBe('date_invalid');
  });

  it('attaches the evidence, the day and the administrator to this one claim', () => {
    const claim = verifyClaim(reported(1), { evidenceChecked: '  Licence sighted.  ', verifiedOn: '2026-11-10', verifiedBy: admin });
    expect(claim).toMatchObject({
      status: 'verified',
      label: 'Egg handler licence',
      verification: { evidenceChecked: 'Licence sighted.', verifiedOn: '2026-11-10', verifiedBy: admin },
    });
  });

  it('takes verification off and goes back to farmer-reported, leaving the claim as it was', () => {
    const verified = verifyClaim(reported(1), { evidenceChecked: 'Licence sighted.', verifiedOn: '2026-11-10', verifiedBy: admin });
    const back = removeVerification(verified);
    expect(back).toMatchObject({ status: 'farmer_reported', verification: null, label: 'Egg handler licence', id: 'c1' });
  });

  it('lists what still needs checking, oldest first', () => {
    const verified = verifyClaim(reported(1), { evidenceChecked: 'Licence sighted.', verifiedOn: '2026-11-10', verifiedBy: admin });
    expect(claimsToCheck([reported(3), verified, reported(2)]).map((c) => c.id)).toEqual(['c2', 'c3']);
  });
});
