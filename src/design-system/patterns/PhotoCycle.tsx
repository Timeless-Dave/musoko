'use client';

import { useEffect, useState } from 'react';
import { PhotoFrame } from './PhotoFrame';

const INTERVAL_MS = 5200;

export type PhotoShot = {
  src: string;
  focus?: 'center' | 'top' | 'bottom' | 'left' | 'right';
};

const RATIO = { '4:3': '4 / 3', '3:2': '3 / 2', '1:1': '1 / 1', '16:9': '16 / 9', '4:5': '4 / 5' } as const;

/** Cross-fades a stack of photographs. Stops on reduced motion. */
export function PhotoCycle({
  srcs,
  ratio,
  sizes,
  className,
  priority,
  interval = INTERVAL_MS,
}: {
  srcs: readonly (string | PhotoShot)[];
  ratio: keyof typeof RATIO;
  sizes: string;
  className?: string;
  priority?: boolean;
  interval?: number;
}) {
  const photos: PhotoShot[] = srcs
    .map((item) => (typeof item === 'string' ? { src: item } : item))
    .filter((item) => item.src);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => setIndex((n) => (n + 1) % photos.length), interval);
    return () => window.clearInterval(id);
  }, [photos.length, interval]);

  if (photos.length === 0) return null;
  if (photos.length === 1) {
    const shot = photos[0]!;
    return (
      <PhotoFrame
        ratio={ratio}
        src={shot.src}
        alt=""
        sizes={sizes}
        focus={shot.focus}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <div className={`photo-cycle ${className ?? ''}`} style={{ aspectRatio: RATIO[ratio] }}>
      {photos.map((shot, i) => (
        <PhotoFrame
          key={`${shot.src}-${shot.focus ?? 'center'}-${i}`}
          ratio={ratio}
          src={shot.src}
          alt=""
          sizes={sizes}
          focus={shot.focus}
          priority={priority && i === 0}
          className={i === index ? 'photo-cycle__frame is-on' : 'photo-cycle__frame'}
        />
      ))}
    </div>
  );
}
