import type { applyProfileEdit } from '@/domain/farmer';
import type { Community, Coordinates, Database, FarmerProfileId } from '@/domain/types';

/** Demo only: there is no geocoder, so an exact point is invented from the address, within a few kilometres of the town. */
export function demoExactPoint(centre: Coordinates, address: string): Coordinates {
  let hash = 2166136261;
  for (const ch of address) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  const north = ((hash % 1000) / 1000) * 12 - 6;
  const east = (((hash >>> 10) % 1000) / 1000) * 12 - 6;
  const lat = centre.lat + north / 111;
  const lng = centre.lng + east / (111.32 * Math.cos((centre.lat * Math.PI) / 180));
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
}

/**
 * Writes an edited profile to every table it touches: the profile, its public
 * location (the town centre), its private address and its private contact. The
 * farmer's own edit and an administrator's edit share it, so the two cannot
 * drift apart on where a private detail is kept.
 */
export function writeProfileEdit(
  db: Database,
  farmId: FarmerProfileId,
  edit: ReturnType<typeof applyProfileEdit>,
  community: Community,
): Database {
  const previous = db.farm_private_locations.find((l) => l.farmerProfileId === farmId);
  const privateLocation =
    edit.streetAddress === null
      ? null
      : {
          farmerProfileId: farmId,
          streetAddress: edit.streetAddress,
          // Keep the point unless the address changed.
          exactPoint:
            previous && previous.streetAddress === edit.streetAddress
              ? previous.exactPoint
              : demoExactPoint(community.centre, edit.streetAddress),
        };
  return {
    ...db,
    farmer_profiles: db.farmer_profiles.map((f) => (f.id === farmId ? edit.profile : f)),
    farm_public_locations: db.farm_public_locations.map((l) =>
      l.farmerProfileId === farmId
        ? { ...l, communityId: community.id, town: community.name, county: community.county, coarsePoint: community.centre }
        : l,
    ),
    farm_private_locations: [
      ...db.farm_private_locations.filter((l) => l.farmerProfileId !== farmId),
      ...(privateLocation ? [privateLocation] : []),
    ],
    farmer_private_contacts: [
      ...db.farmer_private_contacts.filter((c) => c.farmerProfileId !== farmId),
      { farmerProfileId: farmId, ...edit.contact },
    ],
  };
}
