'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { ThemeProvider, WatermarkProvider } from '@/design-system/theme';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } } }),
  );

  // Every screen follows every store change, role switch and reset.
  useEffect(() => services.demo?.subscribe(() => void queryClient.invalidateQueries()), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WatermarkProvider text={services.mode === 'demo' ? copy.demo.watermark : null}>{children}</WatermarkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
