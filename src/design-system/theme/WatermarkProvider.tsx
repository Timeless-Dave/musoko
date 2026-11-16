'use client';

import { createContext, useContext, type ReactNode } from 'react';

const WatermarkContext = createContext<string | null>(null);

/** Supplies the watermark word, or null (live mode) so no copy is rendered. */
export function WatermarkProvider({ text, children }: { text: string | null; children: ReactNode }) {
  return <WatermarkContext.Provider value={text}>{children}</WatermarkContext.Provider>;
}

export function useWatermarkText(): string | null {
  return useContext(WatermarkContext);
}
