'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowUpRight, SealCheck } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { EmptyState, PhotoFrame } from '@/design-system/patterns';
import { Button, MetaLine, Section } from '@/design-system/primitives';
import type { DirectoryFarm } from '@/domain/types';
import { CATEGORY_PHOTO, useDirectoryFarm } from '@/features/catalogue';
import { formatDate } from '@/lib/format';

const d = copy.directory;
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
/** The kind of food the farm grows, shown as a category photograph. It is never presented as the farm itself. */
const photoFor = (farm: DirectoryFarm) => CATEGORY_PHOTO[farm.categories[0] ?? 'vegetables'];

export function PublicListingMark() {
  return (
    <span className="public-mark" title={d.badgeHint}>
      <SealCheck size={14} weight="fill" aria-hidden="true" />
      {d.badge}
    </span>
  );
}

/** A real farm from its own public pages: what it offers and how to buy, with no prices. */
export function DirectoryCard({ farm, miles }: { farm: DirectoryFarm; miles: number | null }) {
  const href = `/farmers/public/${farm.slug}`;
  const ways = [...new Set(farm.howToBuy.map((h) => d.channel[h.kind]))].slice(0, 3).join(' · ');
  return (
    <article className="farm-card dir-card">
      <div className="farm-card__media">
        <div className="farm-card__photo">
          <PhotoFrame ratio="16:9" src={photoFor(farm)} alt="" sizes="(min-width: 75rem) 22rem, (min-width: 48rem) 40vw, 80vw" blurDataURL={blurFor(photoFor(farm))} />
          <Link href={href} className="farm-card__photo-link" tabIndex={-1} aria-hidden="true" />
        </div>
        <p className="farm-card__intro">{farm.offers.join(', ')}</p>
      </div>
      <h3 className="farm-card__name">
        <Link href={href}>{farm.farmName}</Link>
      </h3>
      <p className="farm-card__place">{[farm.town, miles != null ? copy.product.away(miles) : null].filter(Boolean).join(' · ')}</p>
      <div className="farm-card__foot">
        {ways ? <span className="pill-note">{ways}</span> : null}
        <MetaLine>
          <PublicListingMark />
        </MetaLine>
      </div>
    </article>
  );
}

export function DirectoryProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: farm, isPending } = useDirectoryFarm(slug);
  if (isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.common.loading}</p>
      </Section>
    );
  }
  if (!farm) {
    return (
      <Section pad="tight">
        <EmptyState sentence={d.missing} action={<Button variant="secondary" href="/farmers">{d.back}</Button>} />
      </Section>
    );
  }
  const claimHref = `/join?claim=${encodeURIComponent(farm.slug)}`;
  return (
    <>
      <Section pad="none" className="farm-head">
        <Button variant="link" href="/farmers" className="farm-head__back">
          {d.back}
        </Button>
        <div className="farm-head__grid">
          <div className="farm-head__text">
            <h1 className="farm-head__name">{farm.farmName}</h1>
            <p className="farm-head__who">
              {farm.town}, {farm.county} County
            </p>
            <p className="farm-head__intro">{farm.summary}</p>
            <MetaLine>
              <PublicListingMark />
              <span>{d.checked(formatDate(farm.checkedOn))}</span>
            </MetaLine>
            <div className="farm-head__actions">
              {farm.website ? (
                <a href={farm.website} target="_blank" rel="noreferrer" className="btn btn--primary">
                  {d.website} <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
          <figure className="farm-head__photo dir-photo">
            <PhotoFrame ratio="3:2" src={photoFor(farm)} alt="" sizes="(min-width: 48rem) 50vw, 100vw" priority blurDataURL={blurFor(photoFor(farm))} />
            <figcaption>{d.photoNote}</figcaption>
          </figure>
        </div>
      </Section>

      <Section pad="tight">
        <div className="farm-facts">
          <div>
            <h2 className="display-s">{d.offers}</h2>
            <ul className="dir-offers">
              {farm.offers.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            {farm.season ? (
              <p>
                <strong>{d.season}:</strong> {farm.season}
              </p>
            ) : null}
            {farm.acceptsSnap ? <p className="farm-facts__note">{d.snap}</p> : null}
          </div>
          <div>
            <h2 className="display-s">{d.howToBuy}</h2>
            <ul className="fact-list">
              {farm.howToBuy.map((h, i) => (
                <li key={`${h.kind}-${i}`}>
                  <strong>
                    {h.url ? (
                      <a href={h.url} target="_blank" rel="noreferrer" className="inline-link">
                        {d.channel[h.kind]}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      d.channel[h.kind]
                    )}
                  </strong>
                  <span>{h.detail}</span>
                </li>
              ))}
            </ul>
            {farm.deliveryTowns.length ? (
              <p>
                <strong>{d.deliversTo}:</strong> {farm.deliveryTowns.join(', ')}
              </p>
            ) : null}
            {farm.social.length ? (
              <p className="dir-social">
                {farm.social.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ))}
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section tone="inverse" pad="tight" aria-labelledby="dir-claim">
        <div className="farm-facts">
          <div>
            <h2 id="dir-claim" className="display-s">
              {d.claimTitle}
            </h2>
            <p>{d.claimBody}</p>
            <div className="farm-head__actions">
              <Button href={claimHref}>{d.claim}</Button>
              <Button variant="secondary" href={`${claimHref}&remove=1`}>
                {d.remove}
              </Button>
            </div>
          </div>
          <div>
            <h2 className="display-s">{d.sources}</h2>
            <ul className="fact-list">
              {farm.sources.map((s) => (
                <li key={s}>
                  <a href={s} target="_blank" rel="noreferrer">
                    {host(s)}
                    {new URL(s).pathname.length > 1 ? new URL(s).pathname : ''}
                  </a>
                </li>
              ))}
            </ul>
            <p className="farm-facts__note">{d.privacy}</p>
          </div>
        </div>
      </Section>
    </>
  );
}
