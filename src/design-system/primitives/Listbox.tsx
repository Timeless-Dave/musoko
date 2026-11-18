'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { FieldFrame } from './Field';

export type ListOption = {
  value: string;
  label: string;
  image?: string;
  hint?: string;
};

/**
 * One custom menu used everywhere a choice is picked. Search is optional.
 * The panel is a real listbox, not a native select, so photographs can sit beside labels.
 */
export function Listbox({
  label,
  optionalLabel,
  hint,
  error,
  value,
  onValueChange,
  options,
  searchable,
  disabled,
  leading,
  compact,
  placeholder,
  className,
}: {
  label: string;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ListOption[];
  searchable?: boolean;
  disabled?: boolean;
  leading?: ReactNode;
  compact?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const shown = selected?.label || placeholder || label;
  // The accessible name carries the visible text, so voice control and screen readers agree.
  const name = shown === label ? label : `${label}: ${shown}`;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
    setQuery('');
  };

  const onKey = (event: KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      const item = filtered[active];
      if (item) choose(item.value);
    }
  };

  const trigger = (
    <div className={cn('listbox', compact && 'listbox--compact', className)} ref={root} onKeyDown={onKey}>
      <button
        type="button"
        id={autoId}
        className="listbox__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={name}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {leading}
        <span className="listbox__value">{shown}</span>
        <CaretDown className="listbox__caret" size={16} weight="bold" aria-hidden="true" />
      </button>
      {open ? (
        <div className="listbox__panel" id={listId} role="listbox" aria-label={label}>
          {searchable ? (
            <input
              ref={searchRef}
              className="listbox__search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              aria-label={label}
            />
          ) : null}
          <ul className="listbox__options">
            {filtered.map((option, i) => (
              <li key={option.value || `empty-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className="listbox__option"
                  data-active={i === active ? true : undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option.value)}
                >
                  {option.image ? (
                    <span className="listbox__thumb">
                      <Image src={option.image} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
                    </span>
                  ) : null}
                  <span>
                    <span className="listbox__option-label">{option.label}</span>
                    {option.hint ? <span className="listbox__option-hint">{option.hint}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  if (compact) return trigger;
  return (
    <FieldFrame id={autoId} label={label} optionalLabel={optionalLabel} hint={hint} error={error}>
      {() => trigger}
    </FieldFrame>
  );
}