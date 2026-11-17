'use client';

import { useMemo } from 'react';
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, Section } from '@/design-system/primitives';
import type { ProductCategory, PublicProduct } from '@/domain/types';
import {
  CATEGORY_ORDER,
  CATEGORY_PHOTO,
  ChipRail,
  FilterChip,
  ProductCard,
  ProductCardSkeleton,
  ToggleChip,
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
  farm: parseAsString,
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
      if (state.farm && p.farm.slug !== state.farm) return false;
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

  const farmOptions = useMemo(
    () =>
      [...(farms ?? [])]
        .sort((a, b) => a.farmName.localeCompare(b.farmName))
        .map((f) => ({ value: f.slug, label: `${f.farmName}, ${f.location.town}` })),
    [farms],
  );

  const filtered =
    Boolean(state.q || state.category || state.type || state.farm || state.max != null || state.snap) ||
    state.status !== 'available_now' ||
    state.get !== 'any';
  const clear = () =>
    void setState({ q: null, category: null, type: null, farm: null, status: null, get: null, max: null, snap: null, sort: null });

  const categoryHref = (category: ProductCategory | null) => {
    // Built from state, not from window, so the server render and the browser agree.
    const search = new URLSearchParams();
    if (state.q) search.set('q', state.q);
    if (category) search.set('category', category);
    if (state.farm) search.set('farm', state.farm);
    if (state.status !== 'available_now') search.set('status', state.status);
    if (state.get !== 'any') search.set('get', state.get);
    if (state.max != null) search.set('max', String(state.max));
    if (state.snap) search.set('snap', 'true');
    if (state.sort !== 'distance') search.set('sort', state.sort);
    const query = search.toString();
    return query ? `/food?${query}` : '/food';
  };

  const heading = state.q
    ? copy.food.resultsFor(state.q)
    : state.category
      ? copy.categories[state.category]
      : copy.food.title;

  return (
    <>
      <Section pad="none" className="food-top" aria-labelledby="food-title">
        <div className="food-top__head">
          <h1 id="food-title" className="food-top__title">
            {heading}
          </h1>
          <p className="food-results__count" role="status">
            {products ? copy.food.count(results.length) : copy.common.loading}
            {community ? ` near ${community.name}` : ''}
          </p>
        </div>
        <ChipRail
          label={copy.food.category}
          chips={[
            { key: 'all', label: copy.food.allCategories, href: categoryHref(null), current: !state.category },
            ...CATEGORY_ORDER.map((c) => ({
              key: c,
              label: copy.categories[c],
              image: CATEGORY_PHOTO[c],
              href: categoryHref(c),
              current: state.category === c,
            })),
          ]}
        />
      </Section>

      <Section pad="none" className="food-results">
        <div className="filter-row" role="group" aria-label={copy.food.filters}>
          <FilterChip
            label={copy.food.status}
            value={state.status}
            defaultValue="available_now"
            options={[
              { value: 'available_now', label: copy.availability.available_now },
              { value: 'coming_soon', label: copy.availability.coming_soon },
              { value: 'unconfirmed', label: copy.availability.unconfirmed },
              { value: 'all', label: copy.food.statusAll },
            ]}
            onChange={(status) => void setState({ status })}
          />
          <FilterChip
            label={copy.food.type}
            value={state.type ?? ''}
            defaultValue=""
            options={[{ value: '', label: copy.food.anyType }, ...typesInCategory.map(([value, label]) => ({ value, label }))]}
            onChange={(type) => void setState({ type: type || null })}
          />
          <FilterChip
            label={copy.food.farm}
            value={state.farm ?? ''}
            defaultValue=""
            options={[{ value: '', label: copy.food.anyFarm }, ...farmOptions]}
            onChange={(farm) => void setState({ farm: farm || null })}
          />
          <FilterChip
            label={copy.food.fulfilment}
            value={state.get}
            defaultValue="any"
            options={[
              { value: 'any', label: copy.food.fulfilmentAny },
              { value: 'pickup', label: copy.food.fulfilmentPickup },
              { value: 'delivery', label: copy.food.fulfilmentDelivery },
            ]}
            onChange={(get) => void setState({ get })}
          />
          <FilterChip
            label={copy.food.price}
            value={state.max != null ? String(state.max) : ''}
            defaultValue=""
            options={[
              { value: '', label: copy.food.priceAny },
              ...PRICE_STEPS.map((dollars) => ({ value: String(dollars), label: copy.food.priceUnder(dollars) })),
            ]}
            onChange={(max) => void setState({ max: max ? Number(max) : null })}
          />
          <ToggleChip label={copy.food.snap} pressed={state.snap} onChange={(snap) => void setState({ snap: snap || null })} />
          <FilterChip
            label={copy.food.sort}
            value={state.sort}
            defaultValue="distance"
            options={[
              { value: 'distance', label: copy.food.sortDistance },
              { value: 'unit_price', label: copy.food.sortUnitPrice },
              { value: 'recent', label: copy.food.sortRecent },
            ]}
            onChange={(sort) => void setState({ sort })}
          />
          {filtered ? (
            <Button variant="link" onClick={clear} className="filter-row__clear">
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
