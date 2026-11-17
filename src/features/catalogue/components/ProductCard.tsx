'use client';

import Link from 'next/link';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { PhotoCycle } from '@/design-system/patterns';
import { Button, MetaLine, Tag } from '@/design-system/primitives';
import type { PublicProduct } from '@/domain/types';
import { CompareToggle } from '@/features/compare';
import { DemoMark } from '@/features/demo';
import { formatDate, formatListingPrice, formatUnitPrice } from '@/lib/format';
import { useMounted } from '@/lib/useMounted';
import { listingPhotos, pickupSummary, quantityLine, statusDetail } from '../format';

/**
 * The photograph, then the three answers in order: what it is and who grows it,
 * what it costs, where and when to get it. No border, no shadow, no background.
 */
export function ProductCard({
  product,
  miles,
  sizes = '(min-width: 75rem) 20rem, (min-width: 48rem) 33vw, 70vw',
  priority,
}: {
  product: PublicProduct;
  miles?: number | null;
  sizes?: string;
  priority?: boolean;
}) {
  const mounted = useMounted();
  const detail = mounted ? statusDetail(product, services.clock.now()) : null;
  const pickup = pickupSummary(product.pickupOptions);
  const quantity = quantityLine(product);
  const href = `/farmers/${product.farm.slug}#${product.id}`;
  const photos = listingPhotos(product);

  return (
    <article className="product-card">
      <Link href={href} className="product-card__photo" tabIndex={-1} aria-hidden="true">
        {photos.length ? (
          <PhotoCycle ratio="4:3" srcs={photos} sizes={sizes} priority={priority} />
        ) : (
          <div className="product-card__no-photo" />
        )}
        <span className="product-card__tag">
          <Tag>{copy.availability[product.availability.status]}</Tag>
        </span>
      </Link>
      {detail ? <span className="visually-hidden">{detail}</span> : null}
      <h3 className="product-card__title">
        <Link href={href}>{product.title}</Link>
      </h3>
      <p className="product-card__farm">
        {product.farm.farmName} · {product.farm.town}
      </p>
      <p className="product-card__price">
        <strong>{formatListingPrice(product.priceCents, product.sellingUnit, product.unitSize)}</strong>
        {product.normalizedUnitPrice ? (
          <span className="product-card__unit-price"> · {formatUnitPrice(product.normalizedUnitPrice)}</span>
        ) : null}
      </p>
      {pickup ? <p className="product-card__pickup">{pickup}</p> : null}
      {quantity ? (
        <p className="product-card__quantity">
          {quantity} ({copy.product.estimate})
        </p>
      ) : null}
      {product.licenceSelfConfirmed ? <p className="product-card__quantity">{copy.product.licence}</p> : null}
      <MetaLine>
        {miles != null ? <span>{copy.product.away(miles)}</span> : null}
        <span>{copy.product.updated(formatDate(product.availability.updatedAt))}</span>
        {product.isDemo ? <DemoMark /> : null}
      </MetaLine>
      <div className="product-card__actions">
        <CompareToggle productId={product.id} />
        <Button
          variant="link"
          href={`/inquiry/new?product=${product.id}`}
          className="product-card__contact"
          aria-label={copy.inquiry.contactFarmerAbout(`${product.title}, ${product.farm.farmName}`)}
        >
          {copy.inquiry.contactFarmer}
        </Button>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card product-card--skeleton" aria-hidden="true">
      <div className="product-card__no-photo" />
      <span className="skeleton-bar" style={{ width: '45%', height: '1em' }} />
      <span className="skeleton-bar" style={{ width: '80%', height: '1.2em' }} />
      <span className="skeleton-bar" style={{ width: '60%', height: '1em' }} />
    </div>
  );
}
