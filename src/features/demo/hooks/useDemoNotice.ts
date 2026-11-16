'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/data';
import type { DemoNotice } from '@/data/ports';

export const NOTICE_KEY = ['demo', 'notice'] as const;

export function useDemoNotice() {
  return useQuery<DemoNotice | null>({
    queryKey: NOTICE_KEY,
    queryFn: () => (services.demo ? services.demo.getNotice() : null),
  });
}
