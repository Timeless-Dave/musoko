import { ArrowsLeftRight, Basket, MapTrifold, Storefront, UsersThree } from '@phosphor-icons/react';
import type { NavIcon as NavIconName } from './nav';

const MAP = {
  basket: Basket,
  farm: UsersThree,
  store: Storefront,
  map: MapTrifold,
  compare: ArrowsLeftRight,
} as const;

export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = MAP[name];
  return <Icon size={18} weight="bold" aria-hidden="true" />;
}