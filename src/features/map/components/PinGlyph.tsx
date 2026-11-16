import { Signpost, Storefront } from '@phosphor-icons/react/ssr';
import { Sprout } from '@/design-system/brand/Sprout';
import type { PlaceKind } from '../places';

/** The mark inside a pin. Shape and glyph differ by kind, so colour never carries the meaning. */
export function PinGlyph({ kind, size = 22 }: { kind: PlaceKind; size?: number }) {
  if (kind === 'farm') return <Sprout size={size} />;
  if (kind === 'market') return <Storefront size={size} weight="bold" aria-hidden="true" />;
  return <Signpost size={size} weight="bold" aria-hidden="true" />;
}
