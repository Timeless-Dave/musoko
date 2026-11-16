'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

/**
 * A yes or no, as a native checkbox in the same ruled row a ChoiceGroup uses.
 * Put several inside a CheckGroup. `detail` is the second line: what switching
 * it on does.
 */
export function Checkbox({
  label,
  detail,
  ...input
}: { label: ReactNode; detail?: ReactNode } & Omit<ComponentProps<'input'>, 'type' | 'children'>) {
  return (
    <label className="choice">
      <input {...input} type="checkbox" />
      <span className="choice__text">
        <span className="choice__label">{label}</span>
        {detail ? <span className="choice__detail">{detail}</span> : null}
      </span>
    </label>
  );
}

export function CheckGroup({
  legend,
  hint,
  error,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      className="choice-group choice-group--list"
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="choice-group__legend">{legend}</legend>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <div className="choice-group__choices">{children}</div>
      {error ? (
        <p className="field__error" id={errorId}>
          <WarningCircle size={20} weight="fill" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
