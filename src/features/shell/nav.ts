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
  | 'admin'
  | 'info'
  | 'camera'
  | 'pickup'
  | 'institution';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

/** Footer links, in the order of the primary navigation. Only routes that exist. */
export const NAV: readonly NavItem[] = [
  { href: '/food', label: copy.nav.food, icon: 'basket' },
  { href: '/farmers', label: copy.nav.farmers, icon: 'farm' },
  { href: '/farmers-markets', label: copy.nav.markets, icon: 'store' },
  { href: '/pickup', label: copy.nav.pickup, icon: 'pickup' },
  { href: '/institutions', label: copy.nav.institutions, icon: 'institution' },
  { href: '/about', label: copy.nav.about, icon: 'info' },
];

/** The left sidebar on wide screens and the menu drawer on phones. The first group is the primary navigation. */
export const SIDEBAR: readonly { label?: string; items: readonly NavItem[] }[] = [
  {
    items: [
      { href: '/', label: copy.shell.home, icon: 'home' },
      { href: '/food', label: copy.shell.food, icon: 'basket' },
      { href: '/farmers', label: copy.shell.farmers, icon: 'farm' },
      { href: '/farmers-markets', label: copy.shell.markets, icon: 'store' },
      { href: '/pickup', label: copy.shell.pickup, icon: 'pickup' },
      { href: '/institutions', label: copy.shell.institutions, icon: 'institution' },
      { href: '/about', label: copy.shell.aboutPage, icon: 'info' },
    ],
  },
  {
    label: copy.shell.tools,
    items: [
      { href: '/map', label: copy.shell.map, icon: 'map' },
      { href: '/compare', label: copy.shell.compare, icon: 'compare' },
    ],
  },
  {
    label: copy.shell.forFarmers,
    items: [
      { href: '/join', label: copy.shell.join, icon: 'join' },
      { href: '/dashboard', label: copy.shell.dashboard, icon: 'dashboard' },
      { href: '/admin', label: copy.shell.admin, icon: 'admin' },
    ],
  },
];
