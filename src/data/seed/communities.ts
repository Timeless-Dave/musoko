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
  // Added with the public farm directory: towns where listed real farms are.
  { slug: 'lexa', name: 'Lexa', county: 'Phillips', centre: { lat: 34.598, lng: -90.752 } },
  { slug: 'augusta', name: 'Augusta', county: 'Woodruff', centre: { lat: 35.282, lng: -91.365 } },
  { slug: 'jonesboro', name: 'Jonesboro', county: 'Craighead', centre: { lat: 35.842, lng: -90.704 } },
  { slug: 'brookland', name: 'Brookland', county: 'Craighead', centre: { lat: 35.9, lng: -90.582 } },
  { slug: 'bono', name: 'Bono', county: 'Craighead', centre: { lat: 35.909, lng: -90.802 } },
  { slug: 'tyronza', name: 'Tyronza', county: 'Poinsett', centre: { lat: 35.487, lng: -90.358 } },
  { slug: 'trumann', name: 'Trumann', county: 'Poinsett', centre: { lat: 35.674, lng: -90.507 } },
  { slug: 'harrisburg', name: 'Harrisburg', county: 'Poinsett', centre: { lat: 35.564, lng: -90.717 } },
  { slug: 'lonoke', name: 'Lonoke', county: 'Lonoke', centre: { lat: 34.784, lng: -91.9 } },
  { slug: 'cabot', name: 'Cabot', county: 'Lonoke', centre: { lat: 34.975, lng: -92.017 } },
  { slug: 'marion', name: 'Marion', county: 'Crittenden', centre: { lat: 35.2145, lng: -90.1965 } },
  { slug: 'osceola', name: 'Osceola', county: 'Mississippi', centre: { lat: 35.7051, lng: -89.9695 } },
  { slug: 'newport', name: 'Newport', county: 'Jackson', centre: { lat: 35.6067, lng: -91.2818 } },
  { slug: 'des-arc', name: 'Des Arc', county: 'Prairie', centre: { lat: 34.977, lng: -91.495 } },
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
