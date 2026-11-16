import { asId, type Region, type RegionId } from '@/domain/types';

export const REGION_ID = asId<RegionId>('region-arkansas-delta');

export function buildRegions(): Region[] {
  return [{ id: REGION_ID, slug: 'arkansas-delta', name: 'Arkansas Delta', state: 'AR' }];
}
