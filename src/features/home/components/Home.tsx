'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { Button, Section } from '@/design-system/primitives';
import {
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
import { useMounted } from '@/lib/useMounted';
import { HeroPhotos } from './HeroPhotos';
import { HowItWorks } from './HowItWorks';

export function Home() {
  const router = useRouter();
  const mounted = useMounted();
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: products } = usePublicProducts();
  const { data: farms } = usePublicFarms();
  const { data: markets } = usePublicMarkets();
  const town = community?.name ?? '';

  const catalogueReady = mounted && products != null && farms != null && markets != null;

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
          <HeroPhotos />
        </div>
      </Section>

      <Section pad="tight" aria-labelledby="home-available">
        <Shelf
          id="home-available"
          title={copy.home.availableNear(town)}
          more={{ href: '/food', label: copy.home.seeAllFood }}
        >
          {catalogueReady
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
          {catalogueReady
            ? byDistance.farms.map((farm) => (
                <li key={farm.id}>
                  <FarmCard farm={farm} listings={listingCount(farm.id)} miles={milesFrom(farm.location.communityId)} />
                </li>
              ))
            : Array.from({ length: 3 }, (_, i) => (
                <li key={i}>
                  <ProductCardSkeleton />
                </li>
              ))}
        </Shelf>
      </Section>

      <Section tone="inverse" aria-labelledby="home-how">
        <HowItWorks />
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
          {catalogueReady
            ? byDistance.markets.map((market, i) => (
                <li key={market.id}>
                  <MarketRow market={market} index={i} compact />
                </li>
              ))
            : null}
        </ul>
      </Section>

      {catalogueReady && byDistance.coming.length ? (
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
          <article className="home-notes__card" tabIndex={0}>
            <PhotoFrame
              ratio="16:9"
              src="/images/markets/fruit-stall.jpg"
              alt=""
              sizes="(min-width: 48rem) 40vw, 100vw"
              blurDataURL={blurFor('/images/markets/fruit-stall.jpg')}
            />
            <div className="home-notes__reveal">
              <h2 className="display-s">{copy.home.compareTitle}</h2>
              <p>{copy.home.compareBody}</p>
            </div>
          </article>
          <article className="home-notes__card" tabIndex={0}>
            <PhotoFrame
              ratio="16:9"
              src="/images/farms/ploughed-field.jpg"
              alt=""
              sizes="(min-width: 48rem) 40vw, 100vw"
              blurDataURL={blurFor('/images/farms/ploughed-field.jpg')}
            />
            <div className="home-notes__reveal">
              <h2 className="display-s">{copy.home.laterTitle}</h2>
              <p>{copy.home.laterBody}</p>
            </div>
          </article>
        </div>
      </Section>
    </>
  );
}
