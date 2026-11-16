import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

/** The M mark plus the rest of the name. The link’s aria-label still uses the full name. */
export function BrandWordmark({
  logoSize = 32,
  markClassName,
  suffixClassName,
}: {
  logoSize?: number;
  markClassName?: string;
  suffixClassName?: string;
}) {
  return (
    <>
      <Logo size={logoSize} className={cn('brand-wordmark__mark', markClassName)} />
      <span className={cn('brand-wordmark__suffix', suffixClassName)}>{copy.brand.wordmarkSuffix}</span>
    </>
  );
}