'use client';

import { useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, MetaLine, Section } from '@/design-system/primitives';
import type { BuyerInquiryView } from '@/domain/inquiry';
import { ProductCard, unitPlural } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import { formatDate } from '@/lib/format';
import { useMounted } from '@/lib/useMounted';
import { useBuyerInquiry } from './hooks';

function askedAbout(view: BuyerInquiryView): string {
  return view.product?.title ?? view.productTypeName ?? copy.inquiry.askedAnythingElse;
}

function pickupLine(view: BuyerInquiryView): string | null {
  const pickup = view.pickup;
  if (!pickup) return null;
  if (pickup.kind === 'own_delivery') return copy.inquiry.pickupDelivery;
  return copy.inquiry.pickupAt(pickup.name ?? '', pickup.town ?? '');
}

/** The buyer's private page for one inquiry. It is also the confirmation, when `?sent=1` is present. */
export function InquiryStatus() {
  const { token } = useParams<{ token: string }>();
  const sent = useSearchParams().get('sent') === '1';
  const mounted = useMounted();
  const { data: view, isPending } = useBuyerInquiry(token);

  if (!mounted || isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.inquiry.loading}</p>
      </Section>
    );
  }
  if (!view) {
    return (
      <Section pad="tight">
        <EmptyState
          sentence={copy.inquiry.notFoundTitle}
          action={
            <>
              <p className="inquiry-status__note">{copy.inquiry.notFoundBody}</p>
              <Button variant="secondary" href="/food">
                {copy.inquiry.findFood}
              </Button>
            </>
          }
        />
      </Section>
    );
  }
  return <StatusBody view={view} sent={sent} token={token} />;
}

function StatusBody({ view, sent, token }: { view: BuyerInquiryView; sent: boolean; token: string }) {
  const quantity = view.requestedQuantity
    ? `${view.requestedQuantity.amount} ${unitPlural(view.requestedQuantity.unit)}`.trim()
    : null;
  const pickup = pickupLine(view);
  const link = `${window.location.origin}/inquiry/${token}`;

  return (
    <>
      <Section pad="none" className="inquiry-status__head" aria-labelledby="inquiry-status-title">
        <Button variant="link" href="/food">
          {copy.inquiry.findFood}
        </Button>
        <h1 id="inquiry-status-title" className="inquiry-status__title">
          {sent ? copy.inquiry.sentTitle(view.farm.name) : copy.inquiry.statusTitle(view.farm.name)}
        </h1>
        <p className="inquiry-status__state" role="status">
          <strong>{copy.inquiry.status[view.status]}</strong>
        </p>
        <MetaLine>
          <span>
            {view.farm.name}, {view.farm.town}
          </span>
          <span>
            {copy.inquiry.askedSent} {formatDate(view.createdAt)}
          </span>
          {view.isDemo ? <DemoMark /> : null}
        </MetaLine>
        {sent ? <p className="inquiry-status__lead">{copy.inquiry.sentLead}</p> : null}
      </Section>

      <Section pad="tight" aria-label={copy.inquiry.nextTitle}>
        <div className="inquiry-status__grid">
          <div>
            {view.reply ? <ReplyBlock view={view} /> : null}
            {view.status === 'closed' && view.closedReason === 'unanswered' ? (
              <div className="inquiry-status__block">
                <h2 className="display-s">{copy.inquiry.closedUnanswered}</h2>
                <p>{view.alternatives.length > 0 ? copy.inquiry.closedUnansweredLead : copy.inquiry.closedUnansweredNone}</p>
              </div>
            ) : null}
            {view.status === 'closed' && view.closedReason !== 'unanswered' ? (
              <div className="inquiry-status__block">
                <h2 className="display-s">{copy.inquiry.closedAnswered}</h2>
              </div>
            ) : null}
            <div className="inquiry-status__block">
              <h2 className="display-s">{copy.inquiry.nextTitle}</h2>
              {view.status === 'awaiting_response' ? (
                <>
                  <p>{copy.response.noPromise}</p>
                  <p>{copy.inquiry.willHear(view.replyChannel)}</p>
                  <p>{copy.inquiry.nextAwaiting}</p>
                </>
              ) : view.status === 'responded' ? (
                <p>{copy.inquiry.nextResponded}</p>
              ) : (
                <p>{copy.inquiry.nextClosed}</p>
              )}
            </div>
          </div>

          <div>
            <div className="inquiry-status__block">
              <h2 className="display-s">{copy.inquiry.youAsked}</h2>
              <ul className="fact-list">
                <li>
                  <strong>{copy.inquiry.askedAbout}</strong>
                  <span>{askedAbout(view)}</span>
                </li>
                {quantity ? (
                  <li>
                    <strong>{copy.inquiry.askedHowMany}</strong>
                    <span>{quantity}</span>
                  </li>
                ) : null}
                {pickup ? (
                  <li>
                    <strong>{copy.inquiry.askedPickup}</strong>
                    <span>{pickup}</span>
                  </li>
                ) : null}
              </ul>
            </div>
            <PrivateLink link={link} />
          </div>
        </div>
        <p className="farm-statement">{copy.transaction.statement}</p>
      </Section>

      {view.alternatives.length > 0 ? (
        <Section pad="tight" aria-labelledby="inquiry-alternatives">
          <h2 id="inquiry-alternatives" className="shelf__title">
            {copy.inquiry.otherListings}
          </h2>
          <ul className="product-grid">
            {view.alternatives.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} sizes="(min-width: 75rem) 20rem, (min-width: 48rem) 33vw, 50vw" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function ReplyBlock({ view }: { view: BuyerInquiryView }) {
  const reply = view.reply!;
  return (
    <div className="inquiry-status__block">
      <h2 className="display-s">{copy.inquiry.reply}</h2>
      <p className="inquiry-status__reply">{copy.inquiry.replies[reply.kind]}</p>
      {reply.message ? (
        <p>
          <span className="inquiry-status__label">{copy.inquiry.replyMessage}: </span>
          {reply.message}
        </p>
      ) : null}
      {reply.farmerPhone ? (
        <p>
          <span className="inquiry-status__label">{copy.inquiry.farmerPhone}: </span>
          <a href={`tel:${reply.farmerPhone}`}>{reply.farmerPhone}</a>
          <span className="inquiry-status__note"> {copy.inquiry.farmerPhoneNote}</span>
        </p>
      ) : null}
    </div>
  );
}

function PrivateLink({ link }: { link: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMessage(copy.inquiry.copied);
    } catch {
      field.current?.select();
      setMessage(copy.inquiry.copyFailed);
    }
  };

  return (
    <div className="inquiry-status__block">
      <h2 className="display-s">{copy.inquiry.privateLink}</h2>
      <p className="inquiry-status__note">{copy.inquiry.privateLinkNote}</p>
      <div className="inquiry-status__link">
        <input
          ref={field}
          className="control"
          readOnly
          value={link}
          aria-label={copy.inquiry.privateLink}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button variant="secondary" onClick={() => void copyLink()}>
          {copy.inquiry.copyLink}
        </Button>
      </div>
      <p role="status" className="inquiry-status__note">
        {message}
      </p>
    </div>
  );
}
