import Link from 'next/link';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PageHeader, PhotoFrame } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';

const PHOTO = '/images/farms/carrots-in-hands.jpg';

/** What Musoko is, who it is for, and the rules it keeps. */
export function About() {
  const a = copy.about;
  return (
    <>
      <Section pad="tight">
        <div className="about-head">
          <PageHeader title={a.title} lead={a.lead} />
          <PhotoFrame ratio="16:9" src={PHOTO} alt="" sizes="(min-width: 64rem) 40vw, 100vw" blurDataURL={blurFor(PHOTO)} className="about-head__photo" />
        </div>
      </Section>
      <Section pad="tight" aria-labelledby="about-who">
        <h2 id="about-who" className="display-s">
          {a.whoTitle}
        </h2>
        <ul className="path-cards">
          {a.who.map((p) => (
            <li key={p.title}>
              <Link href={p.href} className="path-card">
                <span className="path-card__title">{p.title}</span>
                <span className="path-card__body">{p.body}</span>
                <span className="path-card__action">
                  {p.action} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section tone="inverse" pad="tight" aria-labelledby="about-how">
        <h2 id="about-how" className="display-s">
          {a.principlesTitle}
        </h2>
        <ul className="about-principles">
          {a.principles.map((p) => (
            <li key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
