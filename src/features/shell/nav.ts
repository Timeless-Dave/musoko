import { copy } from '@/content/copy';

/** Only routes that exist. A link is added here when its page ships. */
export const NAV = [
  { href: '/food', label: copy.nav.food },
  { href: '/farmers', label: copy.nav.farmers },
  { href: '/farmers-markets', label: copy.nav.markets },
  { href: '/map', label: copy.nav.map },
] as const;
