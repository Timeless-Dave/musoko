import { isPubliclyVisible } from './index';
import type { Coordinates, Database, FarmerProfileId } from '../types';

export interface PrivateLeak {
  kind: 'street_address' | 'exact_coordinates' | 'phone' | 'email' | 'unpublished_profile' | 'buyer_contact';
  farmerProfileId: FarmerProfileId | null;
  path: string; // where in the value it was found
}

interface StringNeedle {
  kind: PrivateLeak['kind'];
  farmerProfileId: FarmerProfileId | null;
  text: string;
  match: 'contains' | 'equals';
}

function nonEmpty(text: string | null | undefined): text is string {
  return typeof text === 'string' && text.trim().length > 0;
}

function sameCoordinates(a: Coordinates, b: Coordinates): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

/** Walks any value and reports every private datum from db that appears in it without the opt-in that would allow it. */
export function findPrivateLeaks(value: unknown, db: Database): PrivateLeak[] {
  const profileById = new Map(db.farmer_profiles.map((p) => [p.id, p]));
  const visible = (id: FarmerProfileId): boolean => {
    const profile = profileById.get(id);
    return profile !== undefined && isPubliclyVisible(profile);
  };

  const needles: StringNeedle[] = [];

  for (const loc of db.farm_private_locations) {
    if (nonEmpty(loc.streetAddress)) {
      needles.push({ kind: 'street_address', farmerProfileId: loc.farmerProfileId, text: loc.streetAddress, match: 'contains' });
    }
  }
  for (const contact of db.farmer_private_contacts) {
    const profile = profileById.get(contact.farmerProfileId);
    const isVisible = visible(contact.farmerProfileId);
    if (nonEmpty(contact.phone) && !(isVisible && profile?.showPhone === true)) {
      needles.push({ kind: 'phone', farmerProfileId: contact.farmerProfileId, text: contact.phone, match: 'contains' });
    }
    if (nonEmpty(contact.email) && !(isVisible && profile?.showEmail === true)) {
      needles.push({ kind: 'email', farmerProfileId: contact.farmerProfileId, text: contact.email, match: 'contains' });
    }
  }
  for (const profile of db.farmer_profiles) {
    if (isPubliclyVisible(profile)) continue;
    needles.push({ kind: 'unpublished_profile', farmerProfileId: profile.id, text: profile.id, match: 'equals' });
    if (nonEmpty(profile.slug)) {
      needles.push({ kind: 'unpublished_profile', farmerProfileId: profile.id, text: profile.slug, match: 'equals' });
    }
  }
  for (const buyer of db.inquiry_buyer_contacts) {
    if (nonEmpty(buyer.name)) needles.push({ kind: 'buyer_contact', farmerProfileId: null, text: buyer.name, match: 'equals' });
    if (nonEmpty(buyer.phone)) needles.push({ kind: 'buyer_contact', farmerProfileId: null, text: buyer.phone, match: 'contains' });
    if (nonEmpty(buyer.email)) needles.push({ kind: 'buyer_contact', farmerProfileId: null, text: buyer.email, match: 'contains' });
    if (nonEmpty(buyer.message)) needles.push({ kind: 'buyer_contact', farmerProfileId: null, text: buyer.message, match: 'contains' });
  }

  const protectedPoints = db.farm_private_locations
    .filter((loc) => {
      const profile = profileById.get(loc.farmerProfileId);
      return !(profile !== undefined && isPubliclyVisible(profile) && profile.showExactLocation);
    })
    .map((loc) => ({ farmerProfileId: loc.farmerProfileId, point: loc.exactPoint }));

  const leaks: PrivateLeak[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      for (const needle of needles) {
        const hit = needle.match === 'equals' ? node === needle.text : node.includes(needle.text);
        if (hit) leaks.push({ kind: needle.kind, farmerProfileId: needle.farmerProfileId, path });
      }
      return;
    }
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }

    const record = node as Record<string, unknown>;
    if (typeof record.lat === 'number' && typeof record.lng === 'number') {
      const here = { lat: record.lat, lng: record.lng };
      for (const p of protectedPoints) {
        if (sameCoordinates(here, p.point)) {
          leaks.push({ kind: 'exact_coordinates', farmerProfileId: p.farmerProfileId, path });
        }
      }
    }
    for (const [key, child] of Object.entries(record)) {
      walk(child, path === '' ? key : `${path}.${key}`);
    }
  };

  walk(value, '');
  return leaks;
}
