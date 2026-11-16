'use client';

import { useMemo } from 'react';
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, Section, Select } from '@/design-system/primitives';
import type { ProductCategory, PublicProduct } from '@/domain/types';
import {
  CATEGORY_ORDER,
  CategoryRail,
  ProductCard,
  ProductCardSkeleton,
  SearchBar,
  useMilesFrom,
  usePublicFarms,
  usePublicProducts,
  useProductTypes,
  useLogSearch,
  useSelectedCommunity,
} from '@/features/catalogue';

const STATUSES = ['available_now', 'coming_soon', 'unconfirmed', 'all'] as const;
const SORTS = ['distance', 'unit_price', 'recent'] as const;
const FULFILMENTS = ['any', 'pickup', 'delivery'] as const;
const PRICE_STEPS = [5, 10, 20];

const params = {
  q: parseAsString.withDefault(''),
  category: parseAsStringLiteral(CATEGORY_ORDER),
  type: parseAsString,
  status: parseAsStringLiteral(STATUSES).withDefault('available_now'),
  get: parseAsStringLiteral(FULFILMENTS).withDefault('any'),
  max: parseAsInteger,
  snap: parseAsBoolean.withDefault(false),
  sort: parseAsStringLiteral(SORTS).withDefault('distance'),
};

const RANK = { available_now: 0, coming_soon: 1, unconfirmed: 2 } as const;

function matches(product: PublicProduct, terms: string[]): boolean {
  if (!terms.length) return true;
  const haystack = [
    product.title,
    product.productType.name,
    product.farm.farmName,
    product.farm.town,
    copy.categories[product.productType.category],
  ]
    .join(' ')
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function Marketplace() {
  const [state, setState] = useQueryStates(params, { history: 'replace', shallow: true });
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: products } = usePublicProducts();
  const { data: farms } = usePublicFarms();
  const { data: productTypes } = useProductTypes();

  const snapFarms = useMemo(
    () => new Set((farms ?? []).filter((f) => f.claims.some((c) => c.type === 'snap_ebt')).map((f) => f.id)),
    [farms],
  );

  const typesInCategory = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products ?? []) {
      if (state.category && p.productType.category !== state.category) continue;
      seen.set(p.productType.slug, p.productType.name);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products, state.category]);

  const results = useMemo(() => {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const miles = (p: PublicProduct) => milesFrom(p.farm.communityId) ?? Number.MAX_SAFE_INTEGER;
    const list = (products ?? []).filter((p) => {
      if (state.category && p.productType.category !== state.category) return false;
      if (state.type && p.productType.slug !== state.type) return false;
      if (state.status !== 'all' && p.availability.status !== state.status) return false;
      if (state.max != null && p.priceCents > state.max * 100) return false;
      if (state.snap && !snapFarms.has(p.farm.id)) return false;
      if (state.get === 'delivery' && !p.pickupOptions.some((o) => o.kind === 'own_delivery')) return false;
      if (state.get === 'pickup' && !p.pickupOptions.some((o) => o.kind !== 'own_delivery')) return false;
      return matches(p, terms);
    });
    const byStatus = (a: PublicProduct, b: PublicProduct) => RANK[a.availability.status] - RANK[b.availability.status];
    if (state.sort === 'unit_price') {
      // Unit prices are only comparable within one product type, so group by type first.
      const price = (p: PublicProduct) => p.normalizedUnitPrice?.cents ?? Number.MAX_SAFE_INTEGER;
      return list.sort(
        (a, b) => a.productType.name.localeCompare(b.productType.name) || price(a) - price(b) || byStatus(a, b),
      );
    }
    if (state.sort === 'recent') {
      return list.sort(
        (a, b) => byStatus(a, b) || b.availability.updatedAt.localeCompare(a.availability.updatedAt),
      );
    }
    return list.sort((a, b) => byStatus(a, b) || miles(a) - miles(b));
  }, [products, state, snapFarms, milesFrom]);

  const searchFilters = useMemo(
    () => ({
      category: state.category ?? undefined,
      productTypeId: state.type ? productTypes?.find((t) => t.slug === state.type)?.id : undefined,
      availability: state.status === 'all' ? undefined : state.status,
      maxPriceCents: state.max != null ? state.max * 100 : undefined,
      fulfilment: state.get === 'any' ? undefined : state.get,
      snapEbt: state.snap || undefined,
      sort: state.sort === 'unit_price' ? ('unit_price' as const) : state.sort === 'recent' ? ('recently_updated' as const) : undefined,
    }),
    [state, productTypes],
  );

  useLogSearch(state.q, searchFilters, community?.id ?? null, products ? results.length : undefined);

  const filtered =
    Boolean(state.q || state.category || state.type || state.max != null || state.snap) ||
    state.status !== 'available_now' ||
    state.get !== 'any';
  const clear = () =>
    void setState({ q: null, category: null, type: null, status: null, get: null, max: null, snap: null, sort: null });

  const categoryHref = (category: ProductCategory | null) => {
    // Built from state, not from window, so the server render and the browser agree.
    const search = new URLSearchParams();
    if (state.q) search.set('q', state.q);
    if (category) search.set('category', category);
    if (state.status !== 'available_now') search.set('status', state.status);
    if (state.get !== 'any') search.set('get', state.get);
    if (state.max != null) search.set('max', String(state.max));
    if (state.snap) search.set('snap', 'true');
    if (state.sort !== 'distance') search.set('sort', state.sort);
    const query = search.toString();
    return query ? `/food?${query}` : '/food';
  };

  return (
    <>
      <Section pad="none" className="food-top" aria-labelledby="food-title">
        <h1 id="food-title" className="food-top__title">
          {copy.food.title}
        </h1>
        <SearchBar key={state.q} initialQuery={state.q} onSearch={(q) => void setState({ q: q || null })} size="compact" />
        <CategoryRail selected={state.category} hrefFor={categoryHref} />
      </Section>

      <Section pad="none" className="food-results">
        <div className="filter-bar">
          <Select
            label={copy.food.status}
            value={state.status}
            onChange={(e) => void setState({ status: e.target.value as (typeof STATUSES)[number] })}
          >
            <option value="available_now">{copy.availability.available_now}</option>
            <option value="coming_soon">{copy.availability.coming_soon}</option>
            <option value="unconfirmed">{copy.availability.unconfirmed}</option>
            <option value="all">{copy.food.statusAll}</option>
          </Select>
          <Select
            label={copy.food.type}
            value={state.type ?? ''}
            onChange={(e) => void setState({ type: e.target.value || null })}
          >
            <option value="">{copy.food.anyType}</option>
            {typesInCategory.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            label={copy.food.fulfilment}
            value={state.get}
            onChange={(e) => void setState({ get: e.target.value as (typeof FULFILMENTS)[number] })}
          >
            <option value="any">{copy.food.fulfilmentAny}</option>
            <option value="pickup">{copy.food.fulfilmentPickup}</option>
            <option value="delivery">{copy.food.fulfilmentDelivery}</option>
          </Select>
          <Select
            label={copy.food.price}
            value={state.max ?? ''}
            onChange={(e) => void setState({ max: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{copy.food.priceAny}</option>
            {PRICE_STEPS.map((dollars) => (
              <option key={dollars} value={dollars}>
                {copy.food.priceUnder(dollars)}
              </option>
            ))}
          </Select>
          <Select
            label={copy.food.sort}
            value={state.sort}
            onChange={(e) => void setState({ sort: e.target.value as (typeof SORTS)[number] })}
          >
            <option value="distance">{copy.food.sortDistance}</option>
            <option value="unit_price">{copy.food.sortUnitPrice}</option>
            <option value="recent">{copy.food.sortRecent}</option>
          </Select>
          <label className="filter-bar__check">
            <input type="checkbox" checked={state.snap} onChange={(e) => void setState({ snap: e.target.checked || null })} />
            <span>{copy.food.snap}</span>
          </label>
        </div>

        <div className="food-results__head">
          <p className="food-results__count" role="status">
            {products ? copy.food.count(results.length) : copy.common.loading}
            {community ? ` near ${community.name}` : ''}
          </p>
          {filtered ? (
            <Button variant="link" onClick={clear}>
              {copy.food.clear}
            </Button>
          ) : null}
        </div>
        {state.sort === 'unit_price' ? <p className="food-results__note">{copy.food.unitPriceNote}</p> : null}

        {products && results.length === 0 ? (
          <EmptyState
            sentence={copy.food.none}
            action={
              <Button variant="secondary" onClick={clear}>
                {copy.food.clear}
              </Button>
            }
          />
        ) : (
          <ul className="product-grid">
            {products
              ? results.map((product, i) => (
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      miles={milesFrom(product.farm.communityId)}
                      priority={i < 2}
                      sizes="(min-width: 75rem) 20rem, (min-width: 48rem) 33vw, 50vw"
                    />
                  </li>
                ))
              : Array.from({ length: 8 }, (_, i) => (
                  <li key={i}>
                    <ProductCardSkeleton />
                  </li>
                ))}
          </ul>
        )}
      </Section>
    </>
  );
}
