'use client';

import { useId, type ComponentProps, type Ref } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { FieldFrame } from './Field';

/** A native select, so phones get their own picker. Options are plain text. */
export function Select({
  label,
  optionalLabel,
  hint,
  error,
  className,
  children,
  ref,
  ...rest
}: {
  label: string;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
} & Omit<ComponentProps<'select'>, 'ref'>) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldFrame id={id} label={label} optionalLabel={optionalLabel} hint={hint} error={error}>
      {({ describedBy }) => (
        <div className="select">
          <select
            {...rest}
            ref={ref}
            id={id}
            className={cn('control', 'control--select', className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          >
            {children}
          </select>
          <CaretDown className="select__caret" size={20} weight="bold" aria-hidden="true" />
        </div>
      )}
    </FieldFrame>
  );
}
