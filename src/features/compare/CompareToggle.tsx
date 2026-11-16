'use client';

import { copy } from '@/content/copy';
import { Button } from '@/design-system/primitives';
import type { ProductId } from '@/domain/types';
import { useCompareStore } from './store';

export function CompareToggle({ productId }: { productId: ProductId }) {
  const has = useCompareStore((s) => s.has(productId));
  const toggle = useCompareStore((s) => s.toggle);

  const ids = useCompareStore((s) => s.ids);
  const atCap = !has && ids.length >= 4;

  return (
    <Button
      type="button"
      variant="link"
      className="product-card__compare"
      aria-pressed={has}
      disabled={atCap}
      title={atCap ? copy.compare.full : undefined}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(productId);
      }}
    >
      {has ? copy.compare.added : copy.compare.add}
    </Button>
  );
}