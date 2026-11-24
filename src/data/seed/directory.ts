import { asId, type DirectoryFarm, type DirectoryFarmId } from '@/domain/types';
import { communityBySlug } from './communities';

/**
 * Real farms, listed from what each farm publishes about itself. These are NOT
 * demo data, and they are kept to the farm's own public business facts:
 * - town and county only, never a street address, even when the farm posts one;
 * - no owner's name unless the farm names them as the operator;
 * - no prices and no listings, because the farm has not joined Musoko;
 * - every entry keeps its sources and the date they were checked.
 * A farm can claim its entry or ask for it to be removed from its page.
 */
type Row = Omit<DirectoryFarm, 'id' | 'communityId' | 'town' | 'county' | 'status'> & { townSlug: string };

export const DIRECTORY_ROWS: Row[] = [
  {
    slug: 'sunlight-farm',
    farmName: 'Sunlight Farm',
    townSlug: 'marvell',
    summary:
      'A veteran-owned, family-run farm near Marvell growing vegetables and fruit and raising beef, with a scratch bakery, pickled goods and Farmers Pick CSA boxes.',
    offers: ['Vegetables', 'Fruit', 'Beef', 'Baked goods', 'Pickled goods', 'CSA boxes'],
    categories: ['vegetables', 'fruits', 'meat_poultry', 'other'],
    howToBuy: [
      { kind: 'online_store', detail: 'Order online through the farm store.', url: 'https://app.barn2door.com/sunlightfarm.org/all' },
      { kind: 'csa', detail: 'Farmers Pick CSA boxes, weekly, every two weeks or monthly.', url: 'https://sunlightfarm.org/products/' },
      { kind: 'delivery', detail: 'Delivers to the towns listed below.', url: null },
      { kind: 'visits', detail: 'Farm visits are booked as an Airbnb Experience.', url: null },
    ],
    deliveryTowns: ['Marvell', 'Helena', 'Elaine', 'Marianna', 'Pine Bluff', 'Jonesboro', 'Little Rock', 'Memphis'],
    season: null,
    website: 'https://sunlightfarm.org/',
    social: [
      { label: 'Facebook', url: 'https://www.facebook.com/sunlight.farm.2025/' },
      { label: 'Instagram', url: 'https://www.instagram.com/sunlightfarm_/' },
    ],
    acceptsSnap: null,
    sources: ['https://sunlightfarm.org/', 'https://sunlightfarm.org/about/', 'https://sunlightfarm.org/products/', 'https://sunlightfarm.org/contact/'],
    checkedOn: '2026-11-24',
  },
  {
    slug: 'whitton-farms', farmName: 'Whitton Farms', townSlug: 'tyronza',
    summary: 'A Certified Naturally Grown farm growing vegetables, fruit and cut flowers, best known for peonies, with produce and flower subscriptions.',
    offers: ['Vegetables', 'Fruit', 'Cut flowers', 'Garden transplants', 'Pickled goods'], categories: ['vegetables', 'fruits', 'other'],
    howToBuy: [
      { kind: 'farmers_market', detail: 'Judd Hill market in Jonesboro (Saturdays, May to October), Osceola (Thursdays, mid-April to October) and Memphis markets.', url: null },
      { kind: 'csa', detail: 'Eight-week produce subscription and eight-week flower subscription.', url: 'https://whittonfarms.com' },
      { kind: 'farm_stand', detail: 'Seasonal markets at the farm’s Marketplace on Highway 118.', url: null },
      { kind: 'visits', detail: 'Farm tours by appointment.', url: null },
    ],
    deliveryTowns: [], season: 'Markets about April to October; peonies from late April.', website: 'https://whittonfarms.com',
    social: [{ label: 'Instagram', url: 'https://instagram.com/whittonfarms' }], acceptsSnap: null,
    sources: ['https://whittonfarms.com', 'https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf', 'https://marketspread.com/market/36310/judd-hill-farmers-market/', 'https://farmprogress.com/farm-life/jill-forrester-20-years-of-farming-food-and-flowers'], checkedOn: '2026-11-24',
  },
  {
    slug: 'peebles-farm', farmName: 'Peebles Farm', townSlug: 'augusta',
    summary: 'An organic vegetable farm on Highway 64 between Augusta and McCrory that opens a 60-acre pick-your-own pumpkin patch and corn maze each fall.',
    offers: ['Pumpkins'], categories: ['vegetables'],
    howToBuy: [
      { kind: 'u_pick', detail: 'Pick-your-own pumpkins. The 2026 season ran late September to November 1, Friday afternoons and weekends.', url: 'https://www.peeblesfarm.com' },
      { kind: 'wholesale', detail: 'Pumpkins sold wholesale and retail.', url: null },
      { kind: 'visits', detail: 'Corn maze and farm activities, ticketed.', url: null },
    ],
    deliveryTowns: [], season: 'Late September to November 1.', website: 'https://www.peeblesfarm.com', social: [], acceptsSnap: null,
    sources: ['https://www.peeblesfarm.com/', 'https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf'], checkedOn: '2026-11-24',
  },
  {
    slug: 'huffman-family-farms', farmName: 'Huffman Family Farms', townSlug: 'jonesboro',
    summary: 'A family livestock farm outside Jonesboro selling USDA-inspected beef, pork and chicken by the cut, plus jerky and other farm-made products.',
    offers: ['Beef', 'Pork', 'Chicken', 'Jerky and snack sticks'], categories: ['meat_poultry', 'other'],
    howToBuy: [
      { kind: 'farm_stand', detail: 'On-farm pickup year-round: weekday evenings 5 to 7, Saturday 10 to 2, Sunday 1 to 3, or by appointment. Order through the farm’s social media.', url: null },
      { kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null },
    ],
    deliveryTowns: [], season: 'Year-round.', website: 'https://huffmanfamilyfarmsllc.com', social: [], acceptsSnap: null,
    sources: ['https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf', 'https://arfb.com/news/2026/jun/03/arkansas-farm-trail-huffman-family-farms/', 'https://marketspread.com/vendor/230284/huffman-family-farms/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'esau-farms', farmName: 'Esau Farms (Esau’s Sweet Corn)', townSlug: 'dumas',
    summary: 'A family farm near Dumas growing non-GMO sweet corn on about 180 acres, with melons, blackberries, blueberries and muscadines in season.',
    offers: ['Sweet corn', 'Watermelon', 'Cantaloupe', 'Blackberries', 'Blueberries', 'Muscadines'], categories: ['vegetables', 'fruits'],
    howToBuy: [
      { kind: 'farm_stand', detail: 'Phone orders open May 15; pick up at the farm’s corn shed at the time you choose.', url: 'https://esausweetcorn.com' },
      { kind: 'wholesale', detail: 'Resale pricing and melon truckloads by phone.', url: null },
    ],
    deliveryTowns: [], season: 'Corn about June to July; muscadines August to September.', website: 'https://esausweetcorn.com', social: [], acceptsSnap: null,
    sources: ['https://esausweetcorn.com', 'https://arkansasgrown.org/listing/esau-farms-llc/', 'https://somewhereinarkansas.com/esaus-sweet-corn-a-delta-treasure/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'hayes-family-farm', farmName: 'Hayes Family Farm', townSlug: 'stuttgart',
    summary: 'A diversified farm near Stuttgart selling beef, pasture-raised chicken, eggs, blackberries, vegetables and pumpkins.',
    offers: ['Beef', 'Pasture-raised chicken', 'Eggs', 'Blackberries', 'Vegetables', 'Pumpkins'], categories: ['meat_poultry', 'eggs', 'fruits', 'vegetables'],
    howToBuy: [
      { kind: 'farm_stand', detail: 'On-farm sales Monday to Saturday.', url: null },
      { kind: 'delivery', detail: 'Wednesday delivery in Stuttgart and DeWitt.', url: null },
      { kind: 'online_store', detail: 'Order online.', url: 'https://hayesfamilyfarm.eatfromfarms.com' },
      { kind: 'farmers_market', detail: 'Arkansas County Farmers Market (DeWitt and Stuttgart), Saracen Landing in Pine Bluff and Little Rock markets.', url: null },
    ],
    deliveryTowns: ['Stuttgart', 'DeWitt'], season: 'Beef year-round; blackberries June to September; vegetables May to October.', website: 'https://hayesfamilyfarm.eatfromfarms.com',
    social: [{ label: 'Facebook', url: 'https://www.facebook.com/Hayesfamilyfarms/' }], acceptsSnap: null,
    sources: ['https://arkansasgrown.org/listing/hayes-family-farm-3/', 'https://hayesfamilyfarm.eatfromfarms.com'], checkedOn: '2026-11-24',
  },
  {
    slug: 'southern-outdoors', farmName: 'Southern Outdoors', townSlug: 'lexa',
    summary: 'A business on Highway 1 North in Lexa with a fall pumpkin patch and sunflower field and, per a 2026 guide, a produce stand.',
    offers: ['Pumpkins', 'Produce'], categories: ['vegetables'],
    howToBuy: [
      { kind: 'farm_stand', detail: 'Produce stand on site (from a 2026 guide; check before going).', url: null },
      { kind: 'visits', detail: 'Pumpkin patch on October weekends.', url: null },
    ],
    deliveryTowns: [], season: 'October for the pumpkin patch.', website: null,
    social: [{ label: 'Facebook', url: 'https://www.facebook.com/p/Southern-Outdoors-100063510274937/' }], acceptsSnap: null,
    sources: ['https://somewhereinarkansas.com/best-pumpkin-patches-in-arkansas/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'isaac-acres', farmName: 'Isaac Acres', townSlug: 'trumann',
    summary: 'A small family egg farm, started in 2025, with pasture-raised hens laying brown eggs.',
    offers: ['Eggs'], categories: ['eggs'],
    howToBuy: [
      { kind: 'online_store', detail: 'Order online; the farm’s site mentions next-day delivery.', url: 'https://isaacacres.com' },
      { kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null },
    ],
    deliveryTowns: [], season: null, website: 'https://isaacacres.com', social: [], acceptsSnap: null,
    sources: ['https://isaacacres.com', 'https://marketspread.com/vendor/234759/isaac-acres/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'meadors-homestead', farmName: 'Meadors Homestead', townSlug: 'harrisburg',
    summary: 'A farm raising hogs outdoors on pasture, selling pork as cuts or as half and whole hogs.',
    offers: ['Pork', 'Half and whole hogs'], categories: ['meat_poultry'],
    howToBuy: [{ kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null }],
    deliveryTowns: [], season: null, website: null, social: [], acceptsSnap: null,
    sources: ['https://marketspread.com/vendor/236161/meadors-homestead/', 'https://marketspread.com/market/36310/judd-hill-farmers-market/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'lucky-wright-ranch', farmName: 'Lucky Wright Ranch', townSlug: 'harrisburg',
    summary: 'A small family farm selling fresh produce and microgreens, plus canned goods and gluten-free baking.',
    offers: ['Fresh produce', 'Microgreens', 'Canned goods', 'Gluten-free baked goods'], categories: ['vegetables', 'herbs', 'other'],
    howToBuy: [{ kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null }],
    deliveryTowns: [], season: null, website: null, social: [], acceptsSnap: null,
    sources: ['https://marketspread.com/vendor/235306/lucky-wright-ranch/', 'https://marketspread.com/market/36310/judd-hill-farmers-market/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'pyles-farms', farmName: 'Pyles Farms', townSlug: 'bono',
    summary: 'A small farm selling pasture-raised, free-range chicken and duck eggs.',
    offers: ['Chicken eggs', 'Duck eggs'], categories: ['eggs'],
    howToBuy: [{ kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null }],
    deliveryTowns: [], season: null, website: null, social: [], acceptsSnap: null,
    sources: ['https://marketspread.com/vendor/233477/pyles-farms/', 'https://marketspread.com/market/36310/judd-hill-farmers-market/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'redlick-farm', farmName: 'Redlick Farm', townSlug: 'jonesboro',
    summary: 'A Jonesboro grower selling fresh vegetables and flowers.',
    offers: ['Vegetables', 'Flowers'], categories: ['vegetables', 'other'],
    howToBuy: [{ kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null }],
    deliveryTowns: [], season: null, website: null, social: [], acceptsSnap: null,
    sources: ['https://marketspread.com/vendor/254965/redlick-farm/', 'https://marketspread.com/market/36310/judd-hill-farmers-market/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'mootown-produce', farmName: 'Mootown Produce & Stitchery', townSlug: 'brookland',
    summary: 'A Brookland grower selling a range of vegetables, alongside sewn goods.',
    offers: ['Vegetables'], categories: ['vegetables'],
    howToBuy: [{ kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null }],
    deliveryTowns: [], season: null, website: null, social: [], acceptsSnap: null,
    sources: ['https://marketspread.com/vendor/237240/mootown-produce-stitchery/', 'https://marketspread.com/market/36310/judd-hill-farmers-market/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'sunshine-farms-jonesboro', farmName: 'Sunshine Farms', townSlug: 'jonesboro',
    summary: 'A Jonesboro meat seller with beef, pork and chicken by the cut, half or whole animals, and jerky.',
    offers: ['Beef', 'Pork', 'Chicken', 'Jerky'], categories: ['meat_poultry'],
    howToBuy: [{ kind: 'farmers_market', detail: "Judd Hill Farmers' Market, Jonesboro.", url: null }],
    deliveryTowns: [], season: null, website: null, social: [], acceptsSnap: null,
    sources: ['https://marketspread.com/vendor/227321/sunshine-farms/', 'https://marketspread.com/market/36310/judd-hill-farmers-market/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'hicks-family-farms', farmName: 'Hicks Family Farms', townSlug: 'lonoke',
    summary: 'A fall farm near Lonoke with pumpkin picking, a corn maze and hayrides on October weekends.',
    offers: ['Pumpkins'], categories: ['vegetables'],
    howToBuy: [{ kind: 'u_pick', detail: 'Pumpkin picking on October weekends, Saturday 10 to 6 and Sunday 1 to 6.', url: null }],
    deliveryTowns: [], season: 'October weekends.', website: 'https://sites.google.com/hicksfamilyfarms.com/hicks-family-farms/home', social: [], acceptsSnap: null,
    sources: ['https://somewhereinarkansas.com/best-pumpkin-patches-in-arkansas/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'flying-pig-cattle-co', farmName: 'Flying Pig Cattle Co.', townSlug: 'des-arc',
    summary: 'A small livestock farm selling farm-fresh milk, eggs and beef by appointment.',
    offers: ['Milk', 'Eggs', 'Beef'], categories: ['dairy', 'eggs', 'meat_poultry'],
    howToBuy: [{ kind: 'visits', detail: 'By appointment only.', url: null }],
    deliveryTowns: [], season: null, website: 'https://flyingpigcattleco.com', social: [], acceptsSnap: null,
    sources: ['https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf'], checkedOn: '2026-11-24',
  },
  {
    slug: 'barnhill-orchards', farmName: 'Barnhill Orchards', townSlug: 'cabot',
    summary: 'A veteran-owned family produce farm between Lonoke and Cabot, started in 1980, best known for spring strawberries.',
    offers: ['Strawberries', 'Blackberries', 'Blueberries', 'Peaches', 'Watermelon', 'Sweet corn', 'Vegetables', 'Pecans', 'Eggs', 'Honey'],
    categories: ['fruits', 'vegetables', 'eggs', 'other'],
    howToBuy: [
      { kind: 'farm_stand', detail: 'Drive-thru market: daily 9 to 5 in strawberry season, Monday to Saturday 9 to 5 after June 1.', url: null },
      { kind: 'online_store', detail: 'Order online.', url: 'https://barnhillorchards.com' },
    ],
    deliveryTowns: [], season: 'Strawberries from about April; produce through summer.', website: 'https://barnhillorchards.com',
    social: [{ label: 'Facebook', url: 'https://facebook.com/Barnhillorchards' }], acceptsSnap: null,
    sources: ['https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf', 'https://arkansasgrown.org/listing/barnhill-orchards/'], checkedOn: '2026-11-24',
  },
  {
    slug: 'holland-bottom-farm', farmName: 'Holland Bottom Farm', townSlug: 'cabot',
    summary: 'A family farm growing strawberries in Cabot since 1982, with other seasonal produce and homemade jams.',
    offers: ['Strawberries', 'Watermelons', 'Tomatoes', 'Okra', 'Peaches', 'Jams'], categories: ['fruits', 'vegetables', 'other'],
    howToBuy: [
      { kind: 'farm_stand', detail: 'Store open March to July 4, daily 10 to 6; strawberry drive-through daily 8 to 6.', url: null },
      { kind: 'online_store', detail: 'Online store on the farm’s website.', url: 'https://hollandbottomfarmllc.com' },
    ],
    deliveryTowns: [], season: 'March to July 4; later hours posted on Facebook.', website: 'https://hollandbottomfarmllc.com',
    social: [{ label: 'Facebook', url: 'https://facebook.com/HollandBottomFarmLLC' }], acceptsSnap: null,
    sources: ['https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf', 'https://hollandbottomfarmllc.com'], checkedOn: '2026-11-24',
  },
  {
    slug: 'the-cabot-patch', farmName: 'The Cabot Patch', townSlug: 'cabot',
    summary: 'A seasonal produce farm on Highway 89 South selling berries, peaches, melons and summer vegetables.',
    offers: ['Strawberries', 'Blackberries', 'Blueberries', 'Peaches', 'Melons', 'Okra', 'Summer squash'], categories: ['fruits', 'vegetables'],
    howToBuy: [{ kind: 'farm_stand', detail: 'April to August, daily 9 to 6. Opening days are posted on Facebook.', url: null }],
    deliveryTowns: [], season: 'April to August.', website: null, social: [], acceptsSnap: null,
    sources: ['https://www.arfb.com/uploads/pages/3.8189_x_8.5_arkansas_farm_trail_2026_passport.pdf', 'https://somewhereinarkansas.com/strawberries-in-arkansas/'], checkedOn: '2026-11-24',
  },
];

export const directoryFarmId = (slug: string) => asId<DirectoryFarmId>(`dir-${slug}`);

export function buildDirectoryFarms(): DirectoryFarm[] {
  return DIRECTORY_ROWS.map(({ townSlug, ...row }) => {
    const town = communityBySlug(townSlug);
    return { ...row, id: directoryFarmId(row.slug), communityId: town.id, town: town.name, county: town.county, status: 'unclaimed' as const };
  });
}
