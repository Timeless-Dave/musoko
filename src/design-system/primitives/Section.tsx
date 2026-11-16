'use client';

import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useWatermarkText } from '../theme/WatermarkProvider';

/**
 * Every page section. It sets the tone (ground or inverse) and draws its own
 * copy of the demo watermark, clipped to the section, in the section's own ink.
 * Never put transform, filter or contain on an ancestor of a Section: the
 * watermark is position: fixed and would stop following the viewport.
 */
export function Section({
  tone = 'ground',
  as: Tag = 'section',
  pad = 'default',
  contained = true,
  className,
  children,
  ...rest
}: {
  tone?: 'ground' | 'inverse';
  as?: ElementType;
  pad?: 'default' | 'tight' | 'none';
  contained?: boolean;
  className?: string;
  children?: ReactNode;
  id?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  const watermark = useWatermarkText();
  return (
    <Tag data-tone={tone} className={cn('section', `section--pad-${pad}`, className)} {...rest}>
      {watermark ? (
        <div className="watermark" aria-hidden="true">
          <span className="watermark__word">{watermark}</span>
        </div>
      ) : null}
      {contained ? <div className="container">{children}</div> : children}
    </Tag>
  );
}
