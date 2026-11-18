import Link from 'next/link';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';

const PHOTO = {
  src: '/images/farms/carrots-in-hands.jpg',
  alt: 'Two gloved hands holding a bunch of freshly pulled carrots over a field.',
};

/** The intro page: what Musoko is in one line, then two choices. Nobody is sent here; it is linked. */
export function Welcome() {
  const w = copy.intro;
  return (
    <>
      <Section pad="none" aria-labelledby="welcome-title">
        <div className="welcome">
          <div className="welcome__text">
            <h1 id="welcome-title" className="welcome__title">
              {w.title}
            </h1>
            <p className="welcome__lead">{w.lead}</p>
            <h2 className="welcome__choose">{w.choose}</h2>
            <ul className="welcome__choices">
              {[w.buyer, w.farmer].map((choice) => (
                <li key={choice.href}>
                  <Link href={choice.href} className="welcome-choice">
                    <span className="welcome-choice__title">
                      {choice.title} <span aria-hidden="true">→</span>
                    </span>
                    <span className="welcome-choice__body">{choice.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="welcome__dashboard">
              {w.dashboard}
            </Link>
          </div>
          <PhotoFrame
            ratio="4:5"
            src={PHOTO.src}
            alt={PHOTO.alt}
            sizes="(min-width: 64rem) 40vw, 100vw"
            priority
            blurDataURL={blurFor(PHOTO.src)}
            className="welcome__photo"
          />
        </div>
      </Section>
      <Section pad="tight" aria-labelledby="welcome-how">
        <h2 id="welcome-how" className="welcome__how-title">
          {w.howTitle}
        </h2>
        <ol className="welcome__steps">
          {w.steps.map((step, i) => (
            <li key={step.title} className="welcome-step">
              <span className="welcome-step__n" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="welcome-step__title">{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
