import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { InquiryForm } from '@/features/inquiry';

export const metadata: Metadata = { title: copy.inquiry.title };

export default function NewInquiryPage() {
  // The form reads ?product= or ?farm= in the browser, where the demo data lives.
  return (
    <Suspense>
      <InquiryForm />
    </Suspense>
  );
}
