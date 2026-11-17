import { copy } from '@/content/copy';

export type NavIconName =
  | 'home'
  | 'basket'
  | 'farm'
  | 'store'
  | 'map'
  | 'compare'
  | 'join'
  | 'dashboard'
  | 'info'
  | 'camera';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

/** Footer links. Only routes that exist. */
export const NAV: readonly NavItem[] = [
  { href: '/food', label: copy.nav.food, icon: 'basket' },
  { href: '/farmers', label: copy.nav.farmers, icon: 'farm' },
  { href: '/farmers-markets', label: copy.nav.markets, icon: 'store' },
  { href: '/map', label: copy.nav.map, icon: 'map' },
  { href: '/compare', label: copy.nav.compare, icon: 'compare' },
];

/** The left sidebar on wide screens and the menu drawer on phones, in three groups. */
export const SIDEBAR: readonly { label?: string; items: readonly NavItem[] }[] = [
  {
    items: [
      { href: '/', label: copy.shell.home, icon: 'home' },
      { href: '/food', label: copy.shell.food, icon: 'basket' },
      { href: '/farmers', label: copy.shell.farmers, icon: 'farm' },
      { href: '/farmers-markets', label: copy.shell.markets, icon: 'store' },
      { href: '/map', label: copy.shell.map, icon: 'map' },
      { href: '/compare', label: copy.shell.compare, icon: 'compare' },
    ],
  },
  {
    label: copy.shell.forFarmers,
    items: [
      { href: '/join', label: copy.shell.join, icon: 'join' },
      { href: '/dashboard', label: copy.shell.dashboard, icon: 'dashboard' },
    ],
  },
  {
    label: copy.shell.about,
    items: [
      { href: '/#how-it-works', label: copy.shell.how, icon: 'info' },
      { href: '/credits', label: copy.shell.credits, icon: 'camera' },
    ],
  },
];
