'use client';

import { useId, type ComponentProps, type ReactNode, type Ref } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';

interface FieldFrameProps {
  label: string;
  /** Marks the label "(optional)". Required fields carry no marker. */
  optionalLabel?: string;
  hint?: string;
  /** A sentence in words. No colour carries it. */
  error?: string;
}

/** Label, hint, control, error. Shared by Field and Select. */
export function FieldFrame({
  id,
  label,
  optionalLabel,
  hint,
  error,
  children,
}: FieldFrameProps & { id: string; children: (ids: { describedBy?: string }) => ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optionalLabel ? <span className="field__optional"> ({optionalLabel})</span> : null}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children({ describedBy })}
      {error ? (
        <p className="field__error" id={errorId}>
          <WarningCircle size={20} weight="fill" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type InputProps = FieldFrameProps & { multiline?: false; ref?: Ref<HTMLInputElement> } & Omit<
    ComponentProps<'input'>,
    'ref' | 'placeholder'
  >;
type TextAreaProps = FieldFrameProps & { multiline: true; ref?: Ref<HTMLTextAreaElement> } & Omit<
    ComponentProps<'textarea'>,
    'ref' | 'placeholder'
  >;

/** Labels are always visible and placeholders are not allowed. */
export function Field(props: InputProps | TextAreaProps) {
  const autoId = useId();
  const { label, optionalLabel, hint, error, multiline, className, ...rest } = props;
  const id = rest.id ?? autoId;
  return (
    <FieldFrame id={id} label={label} optionalLabel={optionalLabel} hint={hint} error={error}>
      {({ describedBy }) =>
        multiline ? (
          <textarea
            {...(rest as ComponentProps<'textarea'>)}
            id={id}
            className={cn('control', 'control--area', className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        ) : (
          <input
            {...(rest as ComponentProps<'input'>)}
            id={id}
            className={cn('control', className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        )
      }
    </FieldFrame>
  );
}
