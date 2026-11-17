'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { PhotoFrame } from './PhotoFrame';

const INTERVAL_MS = 5200;

export type PhotoShot = {
  src: string;
  focus?: 'center' | 'top' | 'bottom' | 'left' | 'right';
};

const RATIO = {
  '4:3': '4 / 3',
  '3:2': '3 / 2',
  '1:1': '1 / 1',
  '16:9': '16 / 9',
  '16:10': '16 / 10',
  '4:5': '4 / 5',
} as const;

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
  const pauseUntil = useRef(0);

  const step = useCallback(
    (direction: 1 | -1) => {
      pauseUntil.current = Date.now() + interval * 2;
      setIndex((n) => (n + direction + photos.length) % photos.length);
    },
    [interval, photos.length],
  );

  useEffect(() => {
    if (photos.length < 2) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      setIndex((n) => (n + 1) % photos.length);
    }, interval);
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
      <div className="photo-cycle__nav">
        <button
          type="button"
          className="photo-cycle__btn"
          aria-label={copy.shell.scrollBack}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            step(-1);
          }}
        >
          <CaretLeft size={16} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="photo-cycle__btn"
          aria-label={copy.shell.scrollForward}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            step(1);
          }}
        >
          <CaretRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
