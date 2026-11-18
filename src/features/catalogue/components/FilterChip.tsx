'use client';

import { useState } from 'react';
import { Popover } from 'radix-ui';
import { CaretDown, Check } from '@phosphor-icons/react';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A pill that opens a short list of choices. Filled with ink when it holds
 * anything other than its default, so the active filters read at a glance.
 */
export function FilterChip<T extends string>({
  label,
  value,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  value: T;
  defaultValue: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== defaultValue;
  const selected = options.find((o) => o.value === value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="filter-chip" data-active={active ? '' : undefined}>
        <span className="filter-chip__label">{active && selected ? selected.label : label}</span>
        <CaretDown size={14} weight="bold" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover" sideOffset={8} align="start" collisionPadding={16}>
          <p className="popover__title">{label}</p>
          <ul className="popover__list" role="radiogroup" aria-label={label}>
            {options.map((option) => {
              const checked = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className="popover__option"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {checked ? <Check size={18} weight="bold" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A pill that is simply on or off. */
export function ToggleChip({
  label,
  pressed,
  onChange,
}: {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="filter-chip"
      aria-pressed={pressed}
      data-active={pressed ? '' : undefined}
      onClick={() => onChange(!pressed)}
    >
      {pressed ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
      <span className="filter-chip__label">{label}</span>
    </button>
  );
}
