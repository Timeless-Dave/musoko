import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

/**
 * The M mark plus the rest of the name. Both are drawing, not words, so they are
 * hidden from assistive technology and the full name is said once instead.
 */
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
      <span className={cn('brand-wordmark__suffix', suffixClassName)} aria-hidden="true">
        {copy.brand.wordmarkSuffix}
      </span>
      <span className="visually-hidden">{copy.brand.name}</span>
    </>
  );
}