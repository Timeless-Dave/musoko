'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { Button, Section } from '@/design-system/primitives';
import {
  CategoryRail,
  FarmCard,
  ProductCard,
  ProductCardSkeleton,
  SearchBar,
  Shelf,
  useMilesFrom,
  usePublicFarms,
  usePublicMarkets,
  usePublicProducts,
  useSelectedCommunity,
} from '@/features/catalogue';
import { MarketRow } from '@/features/farmers-markets';

const HERO = '/images/farms/vegetable-rows.jpg';
const HERO_INSET = '/images/farms/carrots-in-hands.jpg';

export function Home() {
  const router = useRouter();
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: products } = usePublicProducts();
  const { data: farms } = usePublicFarms();
  const { data: markets } = usePublicMarkets();
  const town = community?.name ?? '';

  const byDistance = useMemo(() => {
    const miles = (id: Parameters<typeof milesFrom>[0]) => milesFrom(id) ?? Number.MAX_SAFE_INTEGER;
    return {
      available: (products ?? [])
        .filter((p) => p.availability.status === 'available_now')
        .map((p, i) => ({ p, i, d: miles(p.farm.communityId) }))
        .sort((a, b) => a.d - b.d || a.i - b.i)
        .slice(0, 8)
        .map((x) => x.p),
      coming: (products ?? [])
        .filter((p) => p.availability.status === 'coming_soon')
        .sort((a, b) => (a.availability.expectedMonth ?? '').localeCompare(b.availability.expectedMonth ?? ''))
        .slice(0, 4),
      farms: [...(farms ?? [])].sort((a, b) => miles(a.location.communityId) - miles(b.location.communityId)).slice(0, 3),
      markets: [...(markets ?? [])].sort((a, b) => miles(a.communityId) - miles(b.communityId)).slice(0, 3),
    };
  }, [products, farms, markets, milesFrom]);

  const listingCount = (farmId: string) => (products ?? []).filter((p) => p.farm.id === farmId).length;

  return (
    <>
      <Section pad="none" className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__grid">
          <div className="home-hero__text">
            <h1 id="home-title" className="home-hero__title">
              {copy.home.headline}
            </h1>
            <p className="home-hero__lead">{copy.home.lead}</p>
            <SearchBar onSearch={(q) => router.push(q ? `/food?q=${encodeURIComponent(q)}` : '/food')} />
            <div className="home-hero__links">
              <Button variant="link" href="/farmers" className="home-hero__secondary">
                {copy.home.exploreFarmers}
              </Button>
              <Button variant="link" href="/join" className="home-hero__secondary">
                {copy.home.joinAsFarmer}
              </Button>
            </div>
          </div>
          <div className="home-hero__photos" aria-hidden="true">
            <PhotoFrame
              ratio="4:3"
              src={HERO}
              alt=""
              sizes="(min-width: 75rem) 36rem, 45vw"
              priority
              blurDataURL={blurFor(HERO)}
              className="home-hero__photo"
            />
            <PhotoFrame
              ratio="1:1"
              src={HERO_INSET}
              alt=""
              sizes="12rem"
              blurDataURL={blurFor(HERO_INSET)}
              className="home-hero__inset"
            />
          </div>
        </div>
        <CategoryRail hrefFor={(category) => (category ? `/food?category=${category}` : '/food')} />
      </Section>

      <Section pad="tight" aria-labelledby="home-available">
        <Shelf
          id="home-available"
          title={copy.home.availableNear(town)}
          more={{ href: '/food', label: copy.home.seeAllFood }}
        >
          {products
            ? byDistance.available.map((product, i) => (
                <li key={product.id}>
                  <ProductCard product={product} miles={milesFrom(product.farm.communityId)} priority={i < 2} />
                </li>
              ))
            : Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <ProductCardSkeleton />
                </li>
              ))}
        </Shelf>
      </Section>

      <Section pad="tight" aria-labelledby="home-farmers">
        <Shelf
          id="home-farmers"
          title={copy.home.farmersNear(town)}
          more={{ href: '/farmers', label: copy.home.seeAllFarmers }}
          columns={3}
        >
          {byDistance.farms.map((farm) => (
            <li key={farm.id}>
              <FarmCard farm={farm} listings={listingCount(farm.id)} miles={milesFrom(farm.location.communityId)} />
            </li>
          ))}
        </Shelf>
      </Section>

      <Section tone="inverse" aria-labelledby="home-how">
        <h2 id="home-how" className="display-l">
          {copy.home.howTitle}
        </h2>
        <ol className="home-how">
          {copy.home.how.map((step, i) => (
            <li key={step.title}>
              <span className="home-how__number" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="home-how__title">{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="home-how__statement">{copy.transaction.statement}</p>
      </Section>

      <Section pad="tight" aria-labelledby="home-markets">
        <div className="shelf__head">
          <h2 id="home-markets" className="shelf__title">
            {copy.home.markets}
          </h2>
          <Button variant="link" href="/farmers-markets" className="shelf__more">
            {copy.home.seeAllMarkets}
          </Button>
        </div>
        <ul className="market-list market-list--compact">
          {byDistance.markets.map((market, i) => (
            <li key={market.id}>
              <MarketRow market={market} index={i} compact />
            </li>
          ))}
        </ul>
      </Section>

      {byDistance.coming.length ? (
        <Section pad="tight" aria-labelledby="home-coming">
          <Shelf id="home-coming" title={copy.home.comingSoon}>
            {byDistance.coming.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} miles={milesFrom(product.farm.communityId)} />
              </li>
            ))}
          </Shelf>
        </Section>
      ) : null}

      <Section pad="tight" className="home-notes">
        <div className="home-notes__grid">
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
