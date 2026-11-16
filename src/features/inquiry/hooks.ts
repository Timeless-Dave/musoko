'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { services } from '@/data';
import type { InquiryRequestInput, InquirySignals } from '@/domain/inquiry';

/** The buyer's private status page. The token in the link is the only key. */
export const useBuyerInquiry = (token: string) =>
  useQuery({ queryKey: ['buyer-inquiry', token], queryFn: () => services.gateway.getBuyerInquiry(token) });

export const useSendInquiry = () =>
  useMutation({
    mutationFn: (input: { request: InquiryRequestInput; signals: InquirySignals }) =>
      services.gateway.submitInquiry(input.request, input.signals),
  });

const TAB_KEY = 'musoko.inquiry.tab';
let memoryKey: string | null = null;

/**
 * A random value for this browser tab, used only to count how many inquiries the
 * tab has sent in an hour. It is not stored with an inquiry and is gone when the tab closes.
 */
export function getTabKey(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_KEY);
    if (existing) return existing;
    const made = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_KEY, made);
    return made;
  } catch {
    memoryKey ??= crypto.randomUUID();
    return memoryKey;
  }
}
