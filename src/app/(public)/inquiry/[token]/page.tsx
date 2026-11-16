import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InquiryStatus } from '@/features/inquiry';

// A private link: keep it out of search results, and do not pass it on as a referrer.
export const metadata: Metadata = {
  title: 'Your inquiry',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function InquiryStatusPage() {
  return (
    <Suspense>
      <InquiryStatus />
    </Suspense>
  );
}
