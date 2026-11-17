'use client';

import { useId, useState, type FormEvent } from 'react';
import { MagnifyingGlass, MapPin } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { Listbox } from '@/design-system/primitives';
import { useSelectedCommunity } from '../hooks';

export function SearchBar({
  initialQuery = '',
  onSearch,
  size = 'large',
}: {
  initialQuery?: string;
  onSearch: (query: string) => void;
  size?: 'large' | 'compact';
}) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const { community, communities, setCommunitySlug } = useSelectedCommunity();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form className={`search-bar search-bar--${size}`} role="search" onSubmit={submit}>
      <div className="search-bar__field search-bar__field--query">
        <label htmlFor={`${id}-q`} className="search-bar__label">
          {copy.search.label}
        </label>
        <div className="search-bar__control">
          <MagnifyingGlass size={22} weight="bold" aria-hidden="true" />
          <input
            id={`${id}-q`}
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search.placeholder}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={60}
          />
        </div>
      </div>
      <div className="search-bar__field search-bar__field--near">
        <span className="search-bar__label">{copy.search.near}</span>
        <div className="search-bar__control">
          <Listbox
            compact
            searchable
            leading={<MapPin size={22} weight="bold" aria-hidden="true" />}
            label={copy.search.near}
            value={community?.slug ?? ''}
            onValueChange={setCommunitySlug}
            options={communities.map((c) => ({ value: c.slug, label: c.name, hint: c.county }))}
          />
        </div>
      </div>
      <button type="submit" className="search-bar__submit">
        {copy.search.submit}
      </button>
    </form>
  );
}