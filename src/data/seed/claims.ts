import { asId, type Claim, type ClaimId, type ClaimType } from '@/domain/types';
import { farmId } from './farms';
import { daysAgo, dayOnly } from './time';
import { DEMO_ADMIN_USER_ID } from './users';

const claimId = (n: number) => asId<ClaimId>(`claim-${String(n).padStart(2, '0')}`);

type Reported = [farm: number, type: ClaimType, label: string];
type Verified = [farm: number, type: ClaimType, label: string, evidence: string, daysAgo: number];

// No SNAP/EBT claim is verified. Verified claims are licence or certification only.
const REPORTED: Reported[] = [
  [1, 'snap_ebt', 'Accepts SNAP/EBT'],
  [6, 'snap_ebt', 'Accepts SNAP/EBT'],
  [8, 'snap_ebt', 'Accepts SNAP/EBT'],
  [1, 'practice', 'No synthetic pesticides'],
  [2, 'practice', 'Pasture raised'],
  [3, 'practice', 'Raw, unheated honey'],
  [4, 'practice', 'Hand harvested'],
  [5, 'practice', 'Pressed on the farm'],
  [6, 'practice', 'Greenhouse grown'],
  [7, 'practice', 'Grass finished'],
  [8, 'practice', 'No-spray garden'],
  [9, 'practice', 'Milled on the farm'],
  [10, 'practice', 'Jersey herd, grass fed in season'],
  [12, 'practice', 'Low-spray orchard'],
  [3, 'practice', 'Bees kept without sugar feeding'],
  [5, 'licence', 'Cottage food registration'],
  [7, 'licence', 'Meat processing licence'],
];
const VERIFIED: Verified[] = [
  [2, 'licence', 'Egg handler licence', 'Licence certificate sighted and number noted by an administrator.', 40],
  [9, 'certification', 'Organic certification', 'Certificate and annual inspection summary sighted by an administrator.', 33],
  [10, 'licence', 'Milk producer permit', 'Permit sighted at the bottling room by an administrator.', 26],
];

export function buildClaims(now: Date): Claim[] {
  const claims: Claim[] = [];
  let n = 1;
  for (const [farm, type, label] of REPORTED) {
    claims.push({
      id: claimId(n), farmerProfileId: farmId(farm), type, label,
      createdAt: daysAgo(now, 60 - n), status: 'farmer_reported', verification: null,
    });
    n += 1;
  }
  for (const [farm, type, label, evidence, ago] of VERIFIED) {
    claims.push({
      id: claimId(n), farmerProfileId: farmId(farm), type, label,
      createdAt: daysAgo(now, ago + 5), status: 'verified',
      verification: { evidenceChecked: evidence, verifiedOn: dayOnly(now, ago), verifiedBy: DEMO_ADMIN_USER_ID },
    });
    n += 1;
  }
  return claims;
}
