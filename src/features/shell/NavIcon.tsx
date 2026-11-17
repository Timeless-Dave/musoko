'use client';

import {
  ArrowsLeftRight,
  Basket,
  Camera,
  GearSix,
  House,
  Info,
  MapTrifold,
  Plant,
  SquaresFour,
  Storefront,
  UsersThree,
} from '@phosphor-icons/react';
import type { NavIconName } from './nav';

const MAP = {
  home: House,
  basket: Basket,
  farm: UsersThree,
  store: Storefront,
  map: MapTrifold,
  compare: ArrowsLeftRight,
  join: Plant,
  dashboard: SquaresFour,
  admin: GearSix,
  info: Info,
  camera: Camera,
} as const;

export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }) {
  const Icon = MAP[name];
  return <Icon size={size} weight="regular" aria-hidden="true" />;
}
