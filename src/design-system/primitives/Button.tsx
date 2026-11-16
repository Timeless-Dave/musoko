'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ComponentProps, type MouseEvent, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { Sprout } from '../brand/Sprout';

type Variant = 'primary' | 'secondary' | 'link';

interface ButtonOwnProps {
  variant?: Variant;
  block?: boolean;
  /** Shows the sprout and ignores clicks. Width stays as it was. */
  loading?: boolean;
  loadingLabel?: string;
  /** Rendered with aria-disabled so it stays focusable and a nearby sentence can explain why. */
  disabled?: boolean;
  href?: string;
  ref?: Ref<HTMLButtonElement & HTMLAnchorElement>;
}

export type ButtonProps = ButtonOwnProps &
  Omit<ComponentProps<'button'>, 'ref' | 'disabled'>;

export function Button({
  variant = 'primary',
  block,
  loading,
  loadingLabel,
  disabled,
  href,
  className,
  children,
  onClick,
  ref,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inner = useRef<HTMLElement | null>(null);
  const restWidth = useRef<number | null>(null);
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);

  // Remember the width at rest so the button does not jump when the label changes.
  useLayoutEffect(() => {
    if (!loading && inner.current) restWidth.current = inner.current.offsetWidth;
    setLockedWidth(loading ? restWidth.current : null);
  }, [loading, children]);

  const inactive = Boolean(disabled || loading);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inactive) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = cn('btn', `btn--${variant}`, block && 'btn--block', className);
  const setRef = (node: HTMLElement | null) => {
    inner.current = node;
    if (typeof ref === 'function') ref(node as HTMLButtonElement & HTMLAnchorElement);
    else if (ref) ref.current = node as HTMLButtonElement & HTMLAnchorElement;
  };
  const content = (
    <>
      {loading ? <Sprout size={18} animate /> : null}
      <span className="btn__label">{loading && loadingLabel ? loadingLabel : children}</span>
    </>
  );
  const common = {
    className: classes,
    'aria-disabled': inactive || undefined,
    'aria-busy': loading || undefined,
    style: lockedWidth ? { minWidth: lockedWidth } : undefined,
  };

  if (href && !inactive) {
    return (
      <Link href={href} ref={setRef} {...common} aria-label={rest['aria-label']}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} ref={setRef} {...common} onClick={handleClick} {...rest}>
      {content}
    </button>
  );
}
