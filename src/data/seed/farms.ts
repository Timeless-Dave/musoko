import {
  asId,
  type Coordinates,
  type ConsentMethod,
  type FarmPrivateLocation,
  type FarmPublicLocation,
  type FarmerPrivateContact,
  type FarmerProfile,
  type FarmerProfileId,
  type UserId,
} from '@/domain/types';
import { communityBySlug, communityId } from './communities';
import { REGION_ID } from './regions';
import { daysAgo, dayOnly } from './time';
import { DEMO_ADMIN_USER_ID, DEMO_FARMER_USER_ID } from './users';
import { PHOTOS, type PhotoKey } from './photos';

export const farmId = (n: number): FarmerProfileId => asId<FarmerProfileId>(`farm-${String(n).padStart(2, '0')}`);

type Consent =
  | { kind: 'self' }                       // farmer registered and consented while signed in
  | { kind: 'admin'; method: ConsentMethod; reviewed: boolean }
  | { kind: 'draft' };

interface FarmSpec {
  n: number;
  slug: string;
  farmName: string;
  farmerName: string;
  town: string; // community slug
  intro: string;
  story: string;
  consent: Consent;
  wholesale: boolean;
  exact: boolean;
  phone: boolean;
  email: boolean;
  /** Invented private point, kilometres north and east of the town centre. */
  offsetKm: [north: number, east: number];
  street: string;
  contactPhone: string;
  contactEmail: string;
}

// All names, phones (870-555-01xx), emails (.example) and addresses are fictional.
export const FARM_SPECS: FarmSpec[] = [
  { n: 1, slug: 'cypress-knee-gardens', farmName: 'Cypress Knee Gardens', farmerName: 'Odell Fairweather', town: 'helena-west-helena',
    intro: 'Greens, sweet potatoes and high-tunnel tomatoes grown on a few acres outside town.',
    story: 'Odell started with a backyard bed and a borrowed tiller. The garden now feeds a Saturday stall and a handful of regular customers.',
    consent: { kind: 'self' }, wholesale: true, exact: true, phone: true, email: true, offsetKm: [4.2, -3.1],
    street: '412 Demo Road 7, Helena-West Helena, AR', contactPhone: '870-555-0101', contactEmail: 'odell@cypressknee.example' },
  { n: 2, slug: 'willowmere-hens', farmName: 'Willowmere Hens', farmerName: 'Priya Calloway', town: 'helena-west-helena',
    intro: 'Pasture-raised hens, eggs by the dozen and frozen whole chickens.',
    story: 'A small flock that moves across the pasture every few days. Priya sells eggs most mornings.',
    consent: { kind: 'admin', method: 'in_person', reviewed: true }, wholesale: false, exact: false, phone: true, email: false, offsetKm: [-5.5, 3.8],
    street: '88 Demo Lane 2, Helena-West Helena, AR', contactPhone: '870-555-0102', contactEmail: 'priya@willowmerehens.example' },
  { n: 3, slug: 'three-gate-honey', farmName: 'Three Gate Honey', farmerName: 'Tobias Reyes-Whitlow', town: 'helena-west-helena',
    intro: 'Wildflower honey and shelled pecans from three small yards.',
    story: 'Tobias keeps bees beside fields of cover crops and sells honey in two jar sizes.',
    consent: { kind: 'admin', method: 'by_phone', reviewed: true }, wholesale: true, exact: false, phone: false, email: false, offsetKm: [7.4, 5.2],
    street: '1507 Demo Drive 11, Helena-West Helena, AR', contactPhone: '870-555-0103', contactEmail: 'tobias@threegate.example' },
  { n: 4, slug: 'quillfeather-acres', farmName: 'Quillfeather Acres', farmerName: 'Imani Holloway', town: 'pine-bluff',
    intro: 'Herbs, turnips and field tomatoes in season.',
    story: 'Imani grows on two leased acres and dries her own herb blends through the winter.',
    consent: { kind: 'admin', method: 'signed_form', reviewed: true }, wholesale: false, exact: false, phone: false, email: false, offsetKm: [-6.8, -4.4],
    street: '33 Demo Road 4, Pine Bluff, AR', contactPhone: '870-555-0104', contactEmail: 'imani@quillfeather.example' },
  { n: 5, slug: 'stillwater-sorghum-works', farmName: 'Stillwater Sorghum Works', farmerName: 'Garrett Lindqvist', town: 'pine-bluff',
    intro: 'Sorghum syrup, stone-ground cornmeal and pecans.',
    story: 'The cane press runs in autumn. Garrett sells syrup by the pint and the quart.',
    consent: { kind: 'admin', method: 'in_person', reviewed: true }, wholesale: true, exact: false, phone: false, email: false, offsetKm: [9.1, 2.6],
    street: '901 Demo Road 15, Pine Bluff, AR', contactPhone: '870-555-0105', contactEmail: 'garrett@stillwatersorghum.example' },
  { n: 6, slug: 'ninebark-row-farm', farmName: 'Ninebark Row Farm', farmerName: 'Delphine Okafor-Marsh', town: 'forrest-city',
    intro: 'Greenhouse tomatoes, kale and strawberries in spring.',
    story: 'Delphine grows on raised rows and sells at the Friday growers stand.',
    consent: { kind: 'admin', method: 'by_phone', reviewed: true }, wholesale: true, exact: true, phone: false, email: true, offsetKm: [3.6, 6.9],
    street: '270 Demo Lane 9, Forrest City, AR', contactPhone: '870-555-0106', contactEmail: 'delphine@ninebarkrow.example' },
  { n: 7, slug: 'ragged-robin-beef-and-pork', farmName: 'Ragged Robin Beef and Pork', farmerName: 'Wendell Pruitt-Alvarez', town: 'forrest-city',
    intro: 'Grass-fed beef and smoked pork, sold by the pound.',
    story: 'A family herd on rented pasture. Wendell delivers around Forrest City on Fridays.',
    consent: { kind: 'admin', method: 'signed_form', reviewed: true }, wholesale: false, exact: false, phone: false, email: false, offsetKm: [-8.3, -5.0],
    street: '5 Demo Road 21, Forrest City, AR', contactPhone: '870-555-0107', contactEmail: 'wendell@raggedrobin.example' },
  { n: 8, slug: 'larkspur-lane-kitchen-garden', farmName: 'Larkspur Lane Kitchen Garden', farmerName: 'Annelise Boudreaux', town: 'marianna',
    intro: 'Purple hull peas, eggs and summer melons from a kitchen-garden-sized farm.',
    story: 'Annelise freezes peas in the autumn and keeps a few laying hens.',
    consent: { kind: 'admin', method: 'in_person', reviewed: false }, wholesale: false, exact: false, phone: false, email: false, offsetKm: [5.0, -7.7],
    street: '144 Demo Lane 3, Marianna, AR', contactPhone: '870-555-0108', contactEmail: 'annelise@larkspurlane.example' },
  { n: 9, slug: 'marsh-wren-grains', farmName: 'Marsh Wren Grains', farmerName: 'Cornelius Abernathy-Lee', town: 'stuttgart',
    intro: 'Long-grain rice and stone-ground grits, bagged on the farm.',
    story: 'Rice country. Cornelius bags small lots for households instead of the elevator.',
    consent: { kind: 'admin', method: 'signed_form', reviewed: true }, wholesale: true, exact: true, phone: false, email: false, offsetKm: [-3.4, 8.8],
    street: '620 Demo Road 30, Stuttgart, AR', contactPhone: '870-555-0109', contactEmail: 'cornelius@marshwren.example' },
  { n: 10, slug: 'sweetgum-creek-dairy', farmName: 'Sweetgum Creek Dairy', farmerName: 'Rosalind Teague', town: 'dumas',
    intro: 'Whole milk in half-gallon and gallon jugs, and fresh farm cheese.',
    story: 'A dozen Jersey cows and a small bottling room. Rosalind delivers on Wednesdays.',
    consent: { kind: 'admin', method: 'by_phone', reviewed: true }, wholesale: false, exact: false, phone: true, email: false, offsetKm: [6.2, -3.9],
    street: '77 Demo Drive 6, Dumas, AR', contactPhone: '870-555-0110', contactEmail: 'rosalind@sweetgumcreek.example' },
  { n: 11, slug: 'fennel-and-flint-farm', farmName: 'Fennel and Flint Farm', farmerName: 'Mateo Brandvold', town: 'wynne',
    intro: 'Turnips and kale.',
    story: 'A new farm. This profile was started by an administrator and is waiting for the farmer to give consent.',
    consent: { kind: 'draft' }, wholesale: false, exact: false, phone: false, email: false, offsetKm: [4.7, 4.1],
    street: '9 Demo Road 12, Wynne, AR', contactPhone: '870-555-0111', contactEmail: 'mateo@fennelflint.example' },
  { n: 12, slug: 'pelican-slough-orchard', farmName: 'Pelican Slough Orchard', farmerName: 'Nadine Ashcombe', town: 'lake-village',
    intro: 'Apples, persimmons, peaches and blueberries.',
    story: 'A small orchard near the lake. Nadine is the only grower on this list from Lake Village.',
    consent: { kind: 'admin', method: 'in_person', reviewed: true }, wholesale: false, exact: false, phone: false, email: false, offsetKm: [-4.9, 3.3],
    street: '350 Demo Lane 8, Lake Village, AR', contactPhone: '870-555-0112', contactEmail: 'nadine@pelicanslough.example' },
];

export function offsetPoint(centre: Coordinates, northKm: number, eastKm: number): Coordinates {
  const lat = centre.lat + northKm / 111.0;
  const lng = centre.lng + eastKm / (111.32 * Math.cos((centre.lat * Math.PI) / 180));
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
}

/** One landscape photograph per farm: land, animals or produce, never a person's face. */
const FARM_PHOTO: Record<number, PhotoKey> = {
  1: 'farms/high-tunnel',
  2: 'farms/hens-on-pasture',
  3: 'farms/beehives',
  4: 'farms/garden-beds',
  5: 'farms/sorghum-heads',
  6: 'farms/bedded-field',
  7: 'farms/cattle-at-fence',
  8: 'farms/kitchen-garden',
  9: 'farms/delta-field-road',
  10: 'farms/dairy-herd',
  11: 'farms/ploughed-field',
  12: 'farms/apple-orchard',
};

export function buildFarms(now: Date): {
  profiles: FarmerProfile[];
  publicLocations: FarmPublicLocation[];
  privateLocations: FarmPrivateLocation[];
  privateContacts: FarmerPrivateContact[];
} {
  const profiles: FarmerProfile[] = [];
  const publicLocations: FarmPublicLocation[] = [];
  const privateLocations: FarmPrivateLocation[] = [];
  const privateContacts: FarmerPrivateContact[] = [];

  for (const s of FARM_SPECS) {
    const community = communityBySlug(s.town);
    const id = farmId(s.n);
    const self = s.consent.kind === 'self';
    const draft = s.consent.kind === 'draft';
    const createdBy: UserId = self ? DEMO_FARMER_USER_ID : DEMO_ADMIN_USER_ID;
    const method: ConsentMethod | null = s.consent.kind === 'self' ? 'farmer_signed_in' : s.consent.kind === 'admin' ? s.consent.method : null;
    const reviewed = s.consent.kind === 'self' ? true : s.consent.kind === 'admin' ? s.consent.reviewed : false;
    const created = 100 - s.n * 3;

    profiles.push({
      id,
      userId: self ? DEMO_FARMER_USER_ID : null,
      slug: s.slug,
      farmName: s.farmName,
      farmerName: s.farmerName,
      intro: s.intro,
      story: s.story,
      photos: FARM_PHOTO[s.n] ? [PHOTOS[FARM_PHOTO[s.n]]] : [],
      regionId: REGION_ID,
      communityId: communityId(s.town),
      createdBy,
      createdByRole: self ? 'farmer' : 'administrator',
      registrationStatus: draft ? 'pending_review' : 'approved',
      publicationStatus: draft ? 'draft' : 'published',
      consentMethod: method,
      consentDate: draft ? null : dayOnly(now, created - 2),
      consentRecordedBy: draft ? null : createdBy,
      farmerReviewedLatestChanges: reviewed,
      reviewMethod: reviewed ? method : null,
      reviewDate: reviewed ? dayOnly(now, created - 2) : null,
      reviewRecordedBy: reviewed ? createdBy : null,
      openToWholesale: s.wholesale,
      showExactLocation: s.exact,
      showPhone: s.phone,
      showEmail: s.email,
      isDemo: true,
      createdAt: daysAgo(now, created),
      updatedAt: daysAgo(now, reviewed ? created - 2 : 3),
    });
    publicLocations.push({
      farmerProfileId: id,
      communityId: community.id,
      town: community.name,
      county: community.county,
      coarsePoint: community.centre,
    });
    privateLocations.push({
      farmerProfileId: id,
      streetAddress: s.street,
      exactPoint: offsetPoint(community.centre, s.offsetKm[0], s.offsetKm[1]),
    });
    privateContacts.push({ farmerProfileId: id, phone: s.contactPhone, email: s.contactEmail });
  }
  return { profiles, publicLocations, privateLocations, privateContacts };
}
