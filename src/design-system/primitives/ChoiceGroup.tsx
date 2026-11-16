'use client';

import { useId, type ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';

export interface Choice {
  value: string;
  label: ReactNode;
  /** A second line: a price, a place, a day. */
  detail?: ReactNode;
}

/**
 * One choice from a short list, as native radio buttons so the keyboard and
 * screen readers behave. `list` is full-width rows with hairlines between them;
 * `chips` is a short row for two or three plain words. A choice before typing.
 */
export function ChoiceGroup({
  legend,
  hint,
  error,
  name,
  value,
  onChange,
  choices,
  layout = 'list',
  optionalLabel,
}: {
  legend: string;
  hint?: string;
  /** A sentence in words. No colour carries it. */
  error?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  choices: readonly Choice[];
  layout?: 'list' | 'chips';
  optionalLabel?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      className={cn('choice-group', `choice-group--${layout}`)}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="choice-group__legend">
        {legend}
        {optionalLabel ? <span className="field__optional"> ({optionalLabel})</span> : null}
      </legend>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <div className="choice-group__choices">
        {choices.map((choice) => (
          <label className="choice" key={choice.value}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span className="choice__text">
              <span className="choice__label">{choice.label}</span>
              {choice.detail ? <span className="choice__detail">{choice.detail}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="field__error" id={errorId}>
          <WarningCircle size={20} weight="fill" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
