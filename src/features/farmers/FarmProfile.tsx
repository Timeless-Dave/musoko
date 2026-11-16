'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { EmptyState, PhotoFrame } from '@/design-system/patterns';
import { Button, MetaLine, Section } from '@/design-system/primitives';
import {
  ProductCard,
  scheduleLines,
  usePublicFarm,
  usePublicMarkets,
  usePublicProducts,
} from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import { formatDate } from '@/lib/format';

export function FarmProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: farm, isPending } = usePublicFarm(slug);
  const { data: products } = usePublicProducts();
  const { data: markets } = usePublicMarkets();

  if (isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.common.loading}</p>
      </Section>
    );
  }
  if (!farm) {
    return (
      <Section pad="tight">
        <EmptyState
          sentence={copy.farms.notFound}
          action={
            <Button variant="secondary" href="/farmers">
              {copy.farms.back}
            </Button>
          }
        />
      </Section>
    );
  }

  const photo = farm.photos[0];
  const listings = (products ?? []).filter((p) => p.farm.id === farm.id);
  const attends = (markets ?? []).filter((m) => farm.marketIds.includes(m.id));
  const hasContact = Boolean(farm.contact.phone || farm.contact.email);

  return (
    <>
      <Section pad="none" className="farm-head">
        <Button variant="link" href="/farmers" className="farm-head__back">
          {copy.farms.back}
        </Button>
        <div className="farm-head__grid">
          <div className="farm-head__text">
            <h1 className="farm-head__name">{farm.farmName}</h1>
            <p className="farm-head__who">
              {farm.farmerName} · {farm.location.town}, {farm.location.county} County
            </p>
            <p className="farm-head__intro">{farm.intro}</p>
            <MetaLine>
              <span>{copy.claims.listed}</span>
              <span>{copy.farms.listings(listings.length)}</span>
              {farm.isDemo ? <DemoMark /> : null}
            </MetaLine>
          </div>
          {photo ? (
            <PhotoFrame
              ratio="3:2"
              src={photo.src}
              alt={photo.alt}
              sizes="(min-width: 48rem) 50vw, 100vw"
              priority
              blurDataURL={blurFor(photo.src)}
              className="farm-head__photo"
            />
          ) : null}
        </div>
      </Section>

      <Section pad="tight" aria-labelledby="farm-listings">
        <h2 id="farm-listings" className="shelf__title">
          {copy.farms.grows}
        </h2>
        {listings.length ? (
          <ul className="product-grid">
            {listings.map((product) => (
              <li key={product.id} id={product.id}>
                <ProductCard product={product} sizes="(min-width: 75rem) 20rem, (min-width: 48rem) 33vw, 50vw" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState sentence={copy.farms.noListings} />
        )}
        <p className="farm-statement">{copy.transaction.statement}</p>
      </Section>

      <Section tone="inverse" pad="tight" aria-labelledby="farm-story">
        <div className="farm-facts">
          <div>
            <h2 id="farm-story" className="display-s">
              {copy.farms.story}
            </h2>
            <p className="farm-facts__story">{farm.story}</p>
            {farm.openToWholesale ? <p>{copy.farms.wholesale}</p> : null}
          </div>
          <div>
            <h2 className="display-s">{copy.farms.pickup}</h2>
            <ul className="fact-list">
              {farm.pickupOptions.map((option) => (
                <li key={option.id}>
                  <strong>
                    {option.kind === 'own_delivery' ? copy.product.delivery : option.name}
                    {option.town ? `, ${option.town}` : ''}
                  </strong>
                  {option.schedule.length ? <span>{scheduleLines(option.schedule).join(', ')}</span> : null}
                  {option.note ? <span>{option.note}</span> : null}
                </li>
              ))}
            </ul>
            {attends.length ? (
              <>
                <h2 className="display-s">{copy.farms.markets}</h2>
                <ul className="fact-list">
                  {attends.map((market) => (
                    <li key={market.id}>
                      <Link href={`/farmers-markets#${market.slug}`}>
                        <strong>{market.name}</strong>
                      </Link>
                      <span>
                        {market.town} · {scheduleLines(market.schedule).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      </Section>

      <Section pad="tight">
        <div className="farm-facts">
          {farm.claims.length ? (
            <div>
              <h2 className="display-s">{copy.farms.claims}</h2>
              <ul className="fact-list">
                {farm.claims.map((claim) => (
                  <li key={claim.id}>
                    <strong>{claim.label}</strong>
                    <span>
                      {claim.status === 'verified' && claim.verifiedOn
                        ? copy.farms.verifiedOn(formatDate(claim.verifiedOn))
                        : copy.claims.farmer_reported}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="farm-facts__note">{copy.farms.claimsNote}</p>
            </div>
          ) : null}
          <div>
            <h2 className="display-s">{copy.farms.location}</h2>
            <p>
              {farm.location.town}, {farm.location.county} County
            </p>
            {farm.location.precision === 'exact' ? <p className="farm-facts__note">{copy.farms.exact}</p> : null}
            {hasContact ? (
              <>
                <h2 className="display-s">{copy.farms.contact}</h2>
                <ul className="fact-list">
                  {farm.contact.phone ? (
                    <li>
                      <a href={`tel:${farm.contact.phone}`}>{farm.contact.phone}</a>
                    </li>
                  ) : null}
                  {farm.contact.email ? (
                    <li>
                      <a href={`mailto:${farm.contact.email}`}>{farm.contact.email}</a>
                    </li>
                  ) : null}
                </ul>
                <p className="farm-facts__note">{copy.farms.contactPublic}</p>
              </>
            ) : null}
          </div>
        </div>
      </Section>
    </>
  );
}
