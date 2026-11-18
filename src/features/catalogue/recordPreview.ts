'use client';

import { services } from '@/data';
import type { PreviewOpenInput } from '@/data/ports/gateway';

/** Anonymous aggregate count: who opened it is never stored (DATA-4, DPRIV-1). */
export function recordPreviewOpen(input: PreviewOpenInput) {
  void services.gateway.recordPreviewOpen(input).catch(() => {
    /* demo or offline */
  });
}