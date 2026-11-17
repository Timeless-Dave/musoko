'use client';

import { useMemo } from 'react';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { Button, Section } from '@/design-system/primitives';
import type { CommunityId, PublicProduct } from '@/domain/types';
import {
  CATEGORY_ORDER,
  CATEGORY_PHOTO,
  ChipRail,
  FarmCard,
  ProductCard,
  ProductCardSkeleton,
  Shelf,
  type Chip,
  useMilesFrom,
  usePublicFarms,
  usePublicMarkets,
  usePublicProducts,
  useSelectedCommunity,
} from '@/features/catalogue';
import { MarketCard } from '@/features/farmers-markets';
import { useMounted } from '@/lib/useMounted';
import { HowItWorks } from './HowItWorks';

const BANNER = '/images/farms/carrots-in-hands.jpg';
const DAY_MS = 86_400_000;

function Skeletons({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <li key={i}>
          <ProductCardSkeleton />
        </li>
      ))}
    </>
  );
}

/**
 * The homepage as a marketplace feed: a greeting for the chosen town, a rail of
 * produce chips, then shelves. Search and town live in the top bar.
 */
export function Home() {
  const mounted = useMounted();
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: products } = usePublicProducts();
  const { data: farms } = usePublicFarms();
  const { data: markets } = usePublicMarkets();
  const town = mounted ? (community?.name ?? '') : '';
  const ready = mounted && products != null && farms != null && markets != null;
  const shelfNear = (fn: (t: string) => string) => (town ? fn(town) : fn(''));

  const feed = useMemo(() => {
    const miles = (id: CommunityId) => milesFrom(id) ?? Number.MAX_SAFE_INTEGER;
    const all = products ?? [];
    const available = all.filter((p) => p.availability.status === 'available_now');
    // The clock is read only in the browser: demo data lives there, and a prerender must not bake in a time.
    const now = mounted ? services.clock.now().getTime() : 0;
    const byNear = (a: PublicProduct, b: PublicProduct) => miles(a.farm.communityId) - miles(b.farm.communityId);
    const confirmedAt = (p: PublicProduct) => (p.availability.lastConfirmedAt ? Date.parse(p.availability.lastConfirmedAt) : 0);

    const availableByFarm = new Map<string, number>();
    const listingsByFarm = new Map<string, number>();
    for (const p of all) {
      listingsByFarm.set(p.farm.id, (listingsByFarm.get(p.farm.id) ?? 0) + 1);
      if (p.availability.status === 'available_now') availableByFarm.set(p.farm.id, (availableByFarm.get(p.farm.id) ?? 0) + 1);
    }

    // Produce chips: the kinds with the most listings available now, each shown by one of its photographs.
    const categoryNames = new Set(Object.values(copy.categories).map((n) => n.toLowerCase()));
    const kinds = new Map<string, { name: string; image?: string; count: number }>();
    for (const p of available) {
      const k = kinds.get(p.productType.slug) ?? { name: p.productType.name, image: p.photo?.src, count: 0 };
      k.count += 1;
      kinds.set(p.productType.slug, k);
    }
    const kindChips: Chip[] = mounted
      ? [...kinds.entries()]
          .filter(([, k]) => !categoryNames.has(k.name.toLowerCase()))
          .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
          .slice(0, 10)
          .map(([slug, k]) => ({ key: `type-${slug}`, label: k.name, image: k.image, href: `/food?type=${slug}` }))
      : [];

    return {
      chips: [
        ...CATEGORY_ORDER.map((c) => ({
          key: c,
          label: copy.categories[c],
          image: CATEGORY_PHOTO[c],
          href: `/food?category=${c}`,
        })),
        ...kindChips,
      ],
      available: [...available].sort(byNear).slice(0, 12),
      justConfirmed: available
        .filter((p) => now - confirmedAt(p) < 3 * DAY_MS)
        .sort((a, b) => confirmedAt(b) - confirmedAt(a))
        .slice(0, 12),
      coming: all
        .filter((p) => p.availability.status === 'coming_soon')
        .sort((a, b) => (a.availability.expectedMonth ?? '').localeCompare(b.availability.expectedMonth ?? ''))
        .slice(0, 12),
      farms: [...(farms ?? [])].sort((a, b) => miles(a.location.communityId) - miles(b.location.communityId)),
      markets: [...(markets ?? [])].sort((a, b) => miles(a.communityId) - miles(b.communityId)),
      availableByFarm,
      listingsByFarm,
    };
  }, [products, farms, markets, milesFrom, mounted]);

  return (
    <>
      <Section pad="none" className="home-top" aria-labelledby="home-title">
        <div className="home-top__head">
          <div>
            <h1 id="home-title" className="home-top__title">
              {shelfNear(copy.home.greeting)}
            </h1>
            <p className="home-top__lead">{copy.home.lead}</p>
          </div>
          <div className="home-top__actions">
            <Button href="/food">{copy.home.findFood}</Button>
            <Button variant="link" href="/farmers">
              {copy.home.exploreFarmers}
            </Button>
            <Button variant="link" href="/join">
              {copy.home.joinAsFarmer}
            </Button>
          </div>
        </div>
        <ChipRail label={copy.food.category} chips={feed.chips} />
      </Section>

      <Section pad="none" className="home-shelf" aria-labelledby="home-available">
        <Shelf id="home-available" title={shelfNear(copy.home.availableNear)} more={{ href: '/food', label: copy.home.seeAllFood }}>
          {ready ? (
            feed.available.map((product, i) => (
              <li key={product.id}>
                <ProductCard product={product} miles={milesFrom(product.farm.communityId)} priority={i < 2} />
              </li>
            ))
          ) : (
            <Skeletons n={5} />
          )}
        </Shelf>
      </Section>

      <Section pad="none" className="home-shelf" aria-labelledby="home-farmers">
        <Shelf
          id="home-farmers"
          title={shelfNear(copy.home.farmersNear)}
          more={{ href: '/farmers', label: copy.home.seeAllFarmers }}
          size="wide"
        >
          {ready ? (
            feed.farms.map((farm) => (
              <li key={farm.id}>
                <FarmCard
                  farm={farm}
                  listings={feed.listingsByFarm.get(farm.id) ?? 0}
                  availableNow={feed.availableByFarm.get(farm.id) ?? 0}
                  miles={milesFrom(farm.location.communityId)}
                />
              </li>
            ))
          ) : (
            <Skeletons n={3} />
          )}
        </Shelf>
      </Section>

      <Section pad="none" className="home-shelf" aria-label={copy.home.banner.title}>
        <article className="banner">
          <div className="banner__photo">
            <PhotoFrame ratio="16:9" src={BANNER} alt="" sizes="(min-width: 48rem) 40vw, 100vw" blurDataURL={blurFor(BANNER)} />
          </div>
          <div className="banner__text">
            <h2 className="banner__title">{copy.home.banner.title}</h2>
            <p>{copy.home.banner.body}</p>
            <Button href="/join" variant="secondary">
              {copy.home.banner.action}
            </Button>
          </div>
        </article>
      </Section>

      {ready && feed.justConfirmed.length ? (
        <Section pad="none" className="home-shelf" aria-labelledby="home-confirmed">
          <Shelf id="home-confirmed" title={copy.home.justConfirmed} hint={copy.home.justConfirmedHint}>
            {feed.justConfirmed.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} miles={milesFrom(product.farm.communityId)} />
              </li>
            ))}
          </Shelf>
        </Section>
      ) : null}

      <Section pad="none" className="home-shelf" aria-labelledby="home-markets">
        <Shelf
          id="home-markets"
          title={shelfNear(copy.home.marketsNear)}
          more={{ href: '/farmers-markets', label: copy.home.seeAllMarkets }}
          size="wide"
        >
          {ready ? (
            feed.markets.map((market, i) => (
              <li key={market.id}>
                <MarketCard market={market} index={i} miles={milesFrom(market.communityId)} />
              </li>
            ))
          ) : (
            <Skeletons n={3} />
          )}
        </Shelf>
      </Section>

      {ready && feed.coming.length ? (
        <Section pad="none" className="home-shelf" aria-labelledby="home-coming">
          <Shelf id="home-coming" title={copy.home.comingSoon}>
            {feed.coming.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} miles={milesFrom(product.farm.communityId)} />
              </li>
            ))}
          </Shelf>
        </Section>
      ) : null}

      <Section tone="inverse" id="how-it-works" aria-labelledby="home-how">
        <HowItWorks />
      </Section>

      <Section pad="tight" aria-label={copy.home.compareTitle}>
        <div className="home-facts">
          <div>
            <h2 className="display-s">{copy.home.compareTitle}</h2>
            <p>{copy.home.compareBody}</p>
          </div>
          <div>
            <h2 className="display-s">{copy.home.laterTitle}</h2>
            <p>{copy.home.laterBody}</p>
          </div>
        </div>
      </Section>
    </>
  );
}
