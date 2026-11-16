'use client';

import { useEffect, useRef } from 'react';
import { services } from '@/data';
import type { CommunityId, SearchFilters } from '@/domain/types';

/** Log one search when the marketplace view settles (terms, filters, town, count). */
export function useLogSearch(
  rawTerms: string,
  filters: SearchFilters,
  communityId: CommunityId | null,
  resultCount: number | undefined,
) {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (resultCount === undefined || communityId === null) return;
    const key = JSON.stringify({ rawTerms, filters, communityId, resultCount });
    if (lastKey.current === key) return;
    lastKey.current = key;
    void services.gateway.recordSearch({ rawTerms, filters, communityId, resultCount });
  }, [rawTerms, filters, communityId, resultCount]);
}