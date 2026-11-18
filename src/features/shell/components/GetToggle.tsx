'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { copy } from '@/content/copy';

type Get = 'pickup' | 'delivery';

function Toggle({ active, current }: { active: Get | null; current: string }) {
  const hrefFor = (kind: Get) => {
    const next = new URLSearchParams(current);
    if (active === kind) next.delete('get');
    else next.set('get', kind);
    const query = next.toString();
    return query ? `/food?${query}` : '/food';
  };
  return (
    <div className="get-toggle" role="group" aria-label={copy.shell.getIt}>
      {(['pickup', 'delivery'] as const).map((kind) => (
        <Link
          key={kind}
          href={hrefFor(kind)}
          className="get-toggle__option"
          aria-current={active === kind ? 'true' : undefined}
        >
          {kind === 'pickup' ? copy.shell.pickup : copy.shell.delivery}
        </Link>
      ))}
    </div>
  );
}

function CurrentToggle() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onFood = pathname === '/food';
  const get = onFood ? params.get('get') : null;
  return (
    <Toggle
      active={get === 'pickup' || get === 'delivery' ? get : null}
      current={onFood ? params.toString() : ''}
    />
  );
}

/**
 * Pickup or the farmer's own delivery. A filter on the marketplace, never a
 * delivery service: Musoko does not deliver and makes no delivery-time promise.
 */
export function GetToggle() {
  return (
    <Suspense fallback={<Toggle active={null} current="" />}>
      <CurrentToggle />
    </Suspense>
  );
}
