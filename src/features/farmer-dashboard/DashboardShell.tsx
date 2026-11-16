'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { services } from '@/data';
import { EmptyState } from '@/design-system/patterns';
import { Button, MetaLine, Section } from '@/design-system/primitives';
import type { OwnFarm } from '@/domain/farmer';
import { useSession } from '@/features/auth';
import { DemoMark } from '@/features/demo';
import { useMounted } from '@/lib/useMounted';
import { failureWords } from './errors';
import { useApproveProfile, useConfirmReview, useOwnFarm, useOwnInquiries, useSetPublication } from './hooks';

const LINKS = [
  { href: '/dashboard', label: copy.dashboard.nav.today },
  { href: '/dashboard/listings', label: copy.dashboard.nav.listings },
  { href: '/dashboard/inquiries', label: copy.dashboard.nav.inquiries },
  { href: '/dashboard/profile', label: copy.dashboard.nav.profile },
  { href: '/dashboard/privacy', label: copy.dashboard.nav.privacy },
  { href: '/dashboard/numbers', label: copy.dashboard.nav.numbers },
] as const;

/**
 * Wraps every dashboard page. Only a signed-in farmer gets past it; anyone else
 * is told what this area is for and, in the demo, how to look around as a farmer.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const { data: session, isPending } = useSession();

  if (!mounted || isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.dashboard.loading}</p>
      </Section>
    );
  }
  if (!session || session.role !== 'farmer' || !session.farmerProfileId) {
    return (
      <Section pad="tight" aria-labelledby="dash-guard">
        <EmptyState
          sentence={copy.dashboard.notFarmerTitle}
          action={
            <div className="dash-form">
              <p id="dash-guard" className="dash-note">
                {copy.dashboard.notFarmerBody}
              </p>
              {services.mode === 'demo' ? <p className="dash-note">{copy.dashboard.notFarmerDemo}</p> : null}
              <div className="dash-form__actions">
                <Button href="/join">{copy.dashboard.join}</Button>
              </div>
            </div>
          }
        />
      </Section>
    );
  }
  return <Frame>{children}</Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  const { data: farm, isPending, isError } = useOwnFarm();
  const { data: inquiries } = useOwnInquiries();
  const pathname = usePathname();
  const waiting = (inquiries ?? []).filter((r) => r.inquiry.status === 'awaiting_response').length;

  if (isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.dashboard.loading}</p>
      </Section>
    );
  }
  if (isError || !farm) {
    return (
      <Section pad="tight">
        <p role="alert">{copy.dashboard.loadFailed}</p>
      </Section>
    );
  }

  return (
    <>
      <Section pad="none">
        <div className="dash-head">
          <h1 className="dash-head__name">{farm.profile.farmName}</h1>
          <MetaLine>
            <span>{farm.town}</span>
            <span>{copy.dashboard.state[farm.state]}</span>
            {farm.profile.isDemo ? <DemoMark /> : null}
          </MetaLine>
        </div>
      </Section>
      <Section pad="none">
        <nav className="dash-nav" aria-label={copy.dashboard.nav.label}>
          <ul>
            {LINKS.map((link) => {
              const current = link.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link href={link.href} aria-current={current ? 'page' : undefined}>
                    {link.label}
                    {link.href === '/dashboard/inquiries' && waiting > 0 ? ` (${waiting})` : ''}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Section>
      <Section pad="none">
        <div className="dash-body">
          <StateNotice farm={farm} />
          {children}
        </div>
      </Section>
    </>
  );
}

/** What the farmer needs to know about where their profile stands, and the one action that moves it. */
function StateNotice({ farm }: { farm: OwnFarm }) {
  const approve = useApproveProfile();
  const review = useConfirmReview();
  const publish = useSetPublication();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const words = copy.dashboard.notice;

  async function run(action: () => Promise<unknown>, done: string) {
    setFailed(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (error) {
      setFailed(failureWords(error, words.failed));
    }
  }

  if (farm.state === 'listed') return message ? <p role="status" className="dash-status">{message}</p> : null;
  return (
    <div className="dash-notice">
      {farm.state === 'needs_consent' ? (
        <>
          <h2 className="dash-notice__title">{words.needs_consent.title}</h2>
          <p>{words.needs_consent.body}</p>
          <div className="dash-notice__actions">
            <Button loading={approve.isPending} onClick={() => void run(() => approve.mutateAsync(), words.needs_consent.done)}>
              {words.needs_consent.action}
            </Button>
            <Button variant="link" href="/dashboard/profile">
              {copy.dashboard.profile.title}
            </Button>
          </div>
        </>
      ) : null}
      {farm.state === 'pending_review' ? (
        <>
          <h2 className="dash-notice__title">{words.pending_review.title}</h2>
          <p>{words.pending_review.body}</p>
        </>
      ) : null}
      {farm.state === 'listed_awaiting_review' ? (
        <>
          <h2 className="dash-notice__title">{words.listed_awaiting_review.title}</h2>
          <p>{words.listed_awaiting_review.body}</p>
          <div className="dash-notice__actions">
            <Button loading={review.isPending} onClick={() => void run(() => review.mutateAsync(), words.listed_awaiting_review.done)}>
              {words.listed_awaiting_review.action}
            </Button>
            <Button variant="link" href="/dashboard/profile">
              {words.listed_awaiting_review.review}
            </Button>
          </div>
        </>
      ) : null}
      {farm.state === 'unpublished' ? (
        <>
          <h2 className="dash-notice__title">{words.unpublished.title}</h2>
          <p>{words.unpublished.body}</p>
          <div className="dash-notice__actions">
            <Button loading={publish.isPending} onClick={() => void run(() => publish.mutateAsync(true), copy.dashboard.privacy.publishedDone)}>
              {words.unpublished.action}
            </Button>
          </div>
        </>
      ) : null}
      {farm.state === 'rejected' ? (
        <>
          <h2 className="dash-notice__title">{words.rejected.title}</h2>
          <p>{words.rejected.body}</p>
        </>
      ) : null}
      <p role="status" className="dash-status">
        {message}
      </p>
      {failed ? (
        <p role="alert" className="dash-error">
          {failed}
        </p>
      ) : null}
    </div>
  );
}
