'use client';

import { useMemo, useState } from 'react';
import { Popover } from 'radix-ui';
import { CaretDown, Check, MapPin } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { useSelectedCommunity } from '../hooks';

/**
 * The town the visitor browses from, as a pill in the top bar. A choice from a
 * list, kept in their browser. Never a typed address and never device location.
 */
export function TownPicker() {
  const { community, communities, setCommunitySlug } = useSelectedCommunity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? communities.filter((c) => `${c.name} ${c.county}`.toLowerCase().includes(q)) : communities;
  }, [communities, query]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger className="town-pill" aria-label={`${copy.shell.town}: ${community?.name ?? ''}`}>
        <MapPin size={18} weight="bold" aria-hidden="true" />
        <span className="town-pill__name">{community?.name ?? ' '}</span>
        <CaretDown size={14} weight="bold" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover town-picker" sideOffset={8} align="end" collisionPadding={16}>
          <p className="popover__title">{copy.shell.town}</p>
          {communities.length > 6 ? (
            <input
              className="popover__search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search towns"
              aria-label="Search towns"
              autoFocus
            />
          ) : null}
          <ul className="popover__list">
            {shown.map((c) => {
              const selected = c.id === community?.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="popover__option"
                    aria-pressed={selected}
                    onClick={() => {
                      setCommunitySlug(c.slug);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="popover__option-text">
                      <span>{c.name}</span>
                      <span className="popover__hint">{c.county} County</span>
                    </span>
                    {selected ? <Check size={18} weight="bold" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="popover__note">{copy.shell.townHint}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
