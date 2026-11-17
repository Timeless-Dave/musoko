'use client';

import { PhotoCycle } from '@/design-system/patterns';

const HERO = [
  '/images/farms/vegetable-rows.jpg',
  '/images/farms/bedded-field.jpg',
  '/images/farms/apple-orchard.jpg',
  '/images/farms/high-tunnel.jpg',
  '/images/farms/delta-field-road.jpg',
];

const INSET = [
  '/images/farms/carrots-in-hands.jpg',
  '/images/markets/produce-close.jpg',
  '/images/farms/hens-on-pasture.jpg',
  '/images/markets/crates-of-greens.jpg',
];

export function HeroPhotos() {
  return (
    <div className="home-hero__photos" aria-hidden="true">
      <PhotoCycle
        ratio="4:3"
        srcs={HERO}
        sizes="(min-width: 75rem) 42rem, 50vw"
        priority
        className="home-hero__photo"
      />
      <PhotoCycle ratio="1:1" srcs={INSET} sizes="14rem" interval={6400} className="home-hero__inset" />
    </div>
  );
}
