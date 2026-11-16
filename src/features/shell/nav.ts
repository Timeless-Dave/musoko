import { copy } from '@/content/copy';

export const NAV = [
  { href: '/food', label: copy.nav.food, icon: 'basket' },
  { href: '/farmers', label: copy.nav.farmers, icon: 'farm' },
  { href: '/farmers-markets', label: copy.nav.markets, icon: 'store' },
  { href: '/map', label: copy.nav.map, icon: 'map' },
  { href: '/compare', label: copy.nav.compare, icon: 'compare' },
] as const;

export type NavIcon = (typeof NAV)[number]['icon'];