import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A small typographic label for a fact. Not interactive, not a status. */
export function Tag({ quiet, children }: { quiet?: boolean; children: ReactNode }) {
  return <span className={cn('tag', quiet && 'tag--quiet')}>{children}</span>;
}
