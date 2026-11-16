import { asId, type Community, type CommunityId, type Coordinates } from '@/domain/types';
import { REGION_ID } from './regions';

interface Row { slug: string; name: string; county: string; centre: Coordinates }

// Town-centre points are approximate, from memory. Check against a gazetteer before production.
const ROWS: Row[] = [
  { slug: 'helena-west-helena', name: 'Helena-West Helena', county: 'Phillips', centre: { lat: 34.529, lng: -90.592 } },
  { slug: 'pine-bluff', name: 'Pine Bluff', county: 'Jefferson', centre: { lat: 34.228, lng: -92.003 } },
  { slug: 'forrest-city', name: 'Forrest City', county: 'St. Francis', centre: { lat: 35.008, lng: -90.79 } },
  { slug: 'marianna', name: 'Marianna', county: 'Lee', centre: { lat: 34.774, lng: -90.758 } },
  { slug: 'marvell', name: 'Marvell', county: 'Phillips', centre: { lat: 34.556, lng: -90.913 } },
  { slug: 'brinkley', name: 'Brinkley', county: 'Monroe', centre: { lat: 34.888, lng: -91.195 } },
  { slug: 'stuttgart', name: 'Stuttgart', county: 'Arkansas', centre: { lat: 34.5, lng: -91.553 } },
  { slug: 'dumas', name: 'Dumas', county: 'Desha', centre: { lat: 33.887, lng: -91.492 } },
  { slug: 'wynne', name: 'Wynne', county: 'Cross', centre: { lat: 35.224, lng: -90.787 } },
  { slug: 'lake-village', name: 'Lake Village', county: 'Chicot', centre: { lat: 33.329, lng: -91.282 } },
  { slug: 'clarendon', name: 'Clarendon', county: 'Monroe', centre: { lat: 34.693, lng: -91.314 } },
];

export const communityId = (slug: string): CommunityId => asId<CommunityId>(`com-${slug}`);

export function buildCommunities(): Community[] {
  return ROWS.map((r) => ({
    id: communityId(r.slug),
    regionId: REGION_ID,
    slug: r.slug,
    name: r.name,
    county: r.county,
    kind: 'town' as const,
    centre: r.centre,
  }));
}

export function communityBySlug(slug: string): Community {
  const found = buildCommunities().find((c) => c.slug === slug);
  if (!found) throw new Error(`Unknown community slug in seed: ${slug}`);
  return found;
}
