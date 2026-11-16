'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WarningCircle } from '@phosphor-icons/react';
import { services } from '@/data';
import { GatewayError } from '@/data/ports';
import type { PublicProduct } from '@/domain/types';
import { copy } from '@/content/copy';
import { Button, MetaLine, StatusMark } from '@/design-system/primitives';
import { EmptyState, SkeletonBar, SkeletonRegion } from '@/design-system/patterns';
import { useActor, useSession } from '@/features/auth';
import { DemoMark, ResetDemoData } from '@/features/demo';
import { formatDate, formatListingPrice, formatUnitPrice } from '@/lib/format';

/** The demo farmer owns this farm in the seed. Public data only is read here. */
const DEMO_FARMER_FARM_ID = 'farm-01';

const FILL = { available_now: 'full', coming_soon: 'half', unconfirmed: 'hollow' } as const;

const PRODUCTS_KEY = ['styleguide', 'products'] as const;

function Listing({ product, enabled }: { product: PublicProduct; enabled: boolean }) {
  const queryClient = useQueryClient();
  const actor = useActor();
  const [confirmed, setConfirmed] = useState(false);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!actor) throw new GatewayError('forbidden', 'No session');
      await services.gateway.farmerConfirmAvailability(actor, product.id);
      // Show the result only once the store holds it and the list has read it back.
      await queryClient.refetchQueries({ queryKey: PRODUCTS_KEY });
    },
    onSuccess: () => setConfirmed(true),
    onMutate: () => setConfirmed(false),
  });

  const error = confirm.error;
  const errorText = !error
    ? null
    : error instanceof GatewayError && error.code === 'forbidden'
      ? copy.listing.confirmForbidden
      : error instanceof GatewayError && error.code === 'not_found'
        ? copy.listing.confirmNotFound
        : copy.listing.confirmFailed;

  const { availability } = product;
  const price = [
    formatListingPrice(product.priceCents, product.sellingUnit, product.unitSize),
    product.normalizedUnitPrice ? formatUnitPrice(product.normalizedUnitPrice) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="listing" data-testid={`listing-${product.id}`} data-status={availability.status}>
      <div className="listing__text">
        <p className="listing__title">{product.title}</p>
        <p className="listing__price">{price}</p>
        <p className="listing__status">
          <StatusMark fill={FILL[availability.status]} />
          <span data-testid="listing-status">{copy.availability[availability.status]}</span>
        </p>
        <MetaLine as="div">
          {availability.lastConfirmedAt
            ? `${copy.listing.lastConfirmed} ${formatDate(availability.lastConfirmedAt)}`
            : copy.listing.neverConfirmed}
          <DemoMark />
        </MetaLine>
        {confirmed ? (
          <p className="listing__confirmed" role="status">
            {copy.listing.confirmedNow}
          </p>
        ) : null}
      </div>
      <div className="listing__action">
        <Button
          variant="secondary"
          disabled={!enabled}
          loading={confirm.isPending}
          loadingLabel={copy.common.saving}
          onClick={() => confirm.mutate()}
        >
          {copy.listing.stillAvailable}
        </Button>
      </div>
      {errorText ? (
        <p className="listing__error" role="alert">
          <WarningCircle size={20} weight="fill" aria-hidden="true" />
          <span>{errorText}</span>
        </p>
      ) : null}
    </li>
  );
}

export function DemoDataSpecimen() {
  if (services.mode !== 'demo' || !services.demo) {
    return <p>Demo data is not available in live mode.</p>;
  }
  return <DemoData />;
}

function DemoData() {
  const { data: session } = useSession();
  const counts = useQuery({
    queryKey: ['styleguide', 'counts'],
    queryFn: () => services.demo!.getTableCounts(),
  });
  const products = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: () => services.gateway.listPublicProducts(),
  });

  const isFarmer = session?.role === 'farmer';
  const listings = products.data?.filter((p) => p.farm.id === DEMO_FARMER_FARM_ID);
  const failed = counts.isError || products.isError;

  if (failed) {
    return (
      <EmptyState sentence="The demo data could not be read." action={<ResetDemoData variant="secondary" />} />
    );
  }

  return (
    <div className="demo-data">
      <div className="specimen">
        <h3 className="specimen__name">Table counts</h3>
        {counts.data ? (
          <ul className="ledger">
            {Object.entries(counts.data).map(([table, count]) => (
              <li className="ledger__row" key={table} data-testid={`count-${table}`}>
                <span>{table}</span>
                <span className="ledger__count">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <SkeletonRegion as="ul" className="ledger" loadingLabel={copy.common.loading}>
            {Array.from({ length: 12 }, (_, i) => (
              <li className="ledger__row" key={i}>
                <SkeletonBar width="10rem" />
                <SkeletonBar width="3rem" height="1.6rem" />
              </li>
            ))}
          </SkeletonRegion>
        )}
      </div>

      <div className="specimen">
        <h3 className="specimen__name">The demo farmer&rsquo;s listings</h3>
        {!isFarmer ? (
          <p className="role-note">Switch to Farmer in the demo strip to confirm listings.</p>
        ) : null}
        {listings ? (
          listings.length ? (
            <ul className="listings">
              {listings.map((p) => (
                <Listing key={p.id} product={p} enabled={isFarmer} />
              ))}
            </ul>
          ) : (
            <EmptyState sentence="The demo farmer has no listings." action={<ResetDemoData variant="secondary" />} />
          )
        ) : (
          <SkeletonRegion as="ul" className="listings" loadingLabel={copy.common.loading}>
            {Array.from({ length: 4 }, (_, i) => (
              <li className="listing" key={i}>
                <div className="listing__text">
                  <SkeletonBar width="14rem" />
                  <SkeletonBar width="18rem" />
                  <SkeletonBar width="10rem" />
                </div>
              </li>
            ))}
          </SkeletonRegion>
        )}
      </div>
    </div>
  );
}
