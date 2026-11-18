'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { copy } from '@/content/copy';

function SearchForm({ initial, onSubmit }: { initial: string; onSubmit: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value.trim());
  };
  return (
    <form className="top-search" role="search" onSubmit={submit}>
      <MagnifyingGlass size={20} weight="bold" aria-hidden="true" className="top-search__icon" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={copy.search.label}
        placeholder={copy.search.label}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={60}
      />
      {value ? (
        <button
          type="button"
          className="top-search__clear"
          aria-label={copy.search.clear}
          onClick={() => {
            setValue('');
            onSubmit('');
          }}
        >
          <X size={16} weight="bold" aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}

/** On the marketplace the search keeps the other filters; anywhere else it starts a fresh search. */
function hrefFor(q: string, onFood: boolean, current: string): string {
  const next = new URLSearchParams(onFood ? current : '');
  if (q) next.set('q', q);
  else next.delete('q');
  const query = next.toString();
  return query ? `/food?${query}` : '/food';
}

function CurrentSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onFood = pathname === '/food';
  const current = onFood ? (params.get('q') ?? '') : '';
  return (
    <SearchForm
      key={current}
      initial={current}
      onSubmit={(q) => router.push(hrefFor(q, onFood, params.toString()))}
    />
  );
}

/** The search pill in the top bar, on every page. */
export function GlobalSearch() {
  const router = useRouter();
  return (
    <Suspense fallback={<SearchForm initial="" onSubmit={(q) => router.push(hrefFor(q, false, ''))} />}>
      <CurrentSearch />
    </Suspense>
  );
}
