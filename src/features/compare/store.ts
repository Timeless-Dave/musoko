'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductId } from '@/domain/types';

const MAX = 4;

type CompareStore = {
  ids: ProductId[];
  toggle: (id: ProductId) => boolean;
  remove: (id: ProductId) => void;
  clear: () => void;
  has: (id: ProductId) => boolean;
};

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      ids: [],
      has: (id) => get().ids.includes(id),
      toggle: (id) => {
        const ids = get().ids;
        if (ids.includes(id)) {
          set({ ids: ids.filter((x) => x !== id) });
          return true;
        }
        if (ids.length >= MAX) return false;
        set({ ids: [...ids, id] });
        return true;
      },
      remove: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
      clear: () => set({ ids: [] }),
    }),
    { name: 'musoko.compare.v1' },
  ),
);