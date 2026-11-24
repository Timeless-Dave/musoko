import {
  asId,
  type Institution,
  type InstitutionContact,
  type InstitutionId,
  type InstitutionKind,
  type InstitutionNeed,
  type InstitutionNeedId,
  type NeedCadence,
  type YearMonth,
} from '@/domain/types';
import { communityId } from './communities';
import { productTypeId } from './product-types';
import { daysAgo } from './time';

/**
 * Demo institutional buyers. Fictional names, contacts (.example) and needs;
 * the towns are real. Months are offsets from the month the seed is built.
 */
interface Spec {
  n: number;
  slug: string;
  name: string;
  kind: InstitutionKind;
  town: string;
  about: string;
  receivingNote: string;
  showName: boolean;
  contactName: string;
  needs: [type: string, amount: number, cadence: NeedCadence, fromMonth: number, toMonth: number, note: string][];
}

const SPECS: Spec[] = [
  {
    n: 1, slug: 'cottonwood-elementary', name: 'Cottonwood Elementary School', kind: 'school', town: 'helena-west-helena',
    about: 'A public elementary school serving about 400 lunches a day. We want more local vegetables on the tray.',
    receivingNote: 'Kitchen door on the east side, weekdays 6:30 to 9:30 am.', showName: true, contactName: 'Food service manager',
    needs: [
      ['sweet-potatoes', 120, 'monthly', 0, 4, 'Washed, any size. Used for baked fries.'],
      ['collard-greens', 40, 'weekly', 1, 4, 'Bagged or bunched is fine.'],
      ['apples', 60, 'weekly', 0, 2, 'Small apples for lunch trays.'],
    ],
  },
  {
    n: 2, slug: 'bayou-bend-hospital-kitchen', name: 'Bayou Bend Community Hospital', kind: 'hospital', town: 'forrest-city',
    about: 'A rural hospital kitchen cooking for patients, staff and visitors.',
    receivingNote: 'Loading dock behind the main building, before 11 am.', showName: false, contactName: 'Dietary office',
    needs: [
      ['eggs', 30, 'weekly', 0, 5, 'Graded and cartoned.'],
      ['tomatoes', 50, 'weekly', 3, 5, 'Slicing tomatoes for the salad bar.'],
      ['milk', 20, 'weekly', 0, 5, 'Gallons.'],
    ],
  },
  {
    n: 3, slug: 'levee-street-cafe', name: 'Levee Street Cafe', kind: 'restaurant', town: 'pine-bluff',
    about: 'A lunch counter with a seasonal menu built around what Delta farms have.',
    receivingNote: 'Back door, Tuesday to Saturday mornings.', showName: true, contactName: 'Owner and chef',
    needs: [
      ['okra', 25, 'weekly', 5, 5, 'For the summer menu.'],
      ['field-peas', 30, 'monthly', 0, 3, 'Shelled, fresh or frozen.'],
      ['honey', 12, 'monthly', 0, 5, 'Pint jars or bulk.'],
    ],
  },
  {
    n: 4, slug: 'delta-plains-college-dining', name: 'Delta Plains College Dining', kind: 'university', town: 'marianna',
    about: 'Campus dining for about 600 students during term.',
    receivingNote: 'Dining hall dock, weekdays 7 to 10 am.', showName: false, contactName: 'Dining services',
    needs: [
      ['sweet-potatoes', 200, 'monthly', 1, 4, 'Any grade.'],
      ['rice', 300, 'monthly', 0, 5, 'Long grain, 25 lb bags.'],
      ['strawberries', 80, 'weekly', 4, 5, 'For the spring menu.'],
    ],
  },
  {
    n: 5, slug: 'eastside-community-pantry', name: 'Eastside Community Food Pantry', kind: 'food_pantry', town: 'helena-west-helena',
    about: 'A volunteer pantry giving out groceries twice a week.',
    receivingNote: 'Church hall, Tuesdays and Fridays after 1 pm.', showName: true, contactName: 'Volunteer coordinator',
    needs: [
      ['sweet-potatoes', 100, 'one_time', 0, 0, 'For holiday boxes.'],
      ['turnips', 40, 'monthly', 0, 3, ''],
    ],
  },
];

const monthOffset = (now: Date, n: number): YearMonth => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const institutionId = (n: number) => asId<InstitutionId>(`inst-${String(n).padStart(2, '0')}`);

export function buildInstitutions(now: Date): { institutions: Institution[]; contacts: InstitutionContact[]; needs: InstitutionNeed[] } {
  const created = daysAgo(now, 40);
  const institutions: Institution[] = SPECS.map((s) => ({
    id: institutionId(s.n), slug: s.slug, name: s.name, kind: s.kind, communityId: communityId(s.town),
    about: s.about, receivingNote: s.receivingNote, showName: s.showName,
    editToken: `demo-institution-${s.n}`, isDemo: true, createdAt: created, updatedAt: created,
  }));
  const contacts: InstitutionContact[] = SPECS.map((s) => ({
    institutionId: institutionId(s.n), contactName: s.contactName, phone: `870-555-02${String(s.n).padStart(2, '0')}`,
    email: `buying@${s.slug}.example`,
  }));
  const needs: InstitutionNeed[] = SPECS.flatMap((s) =>
    s.needs.map(([type, amount, cadence, from, to, note], i) => ({
      id: asId<InstitutionNeedId>(`need-${s.n}-${i + 1}`), institutionId: institutionId(s.n), productTypeId: productTypeId(type),
      amount, cadence, startMonth: monthOffset(now, from), endMonth: monthOffset(now, to), note, createdAt: created,
    })),
  );
  return { institutions, contacts, needs };
}
