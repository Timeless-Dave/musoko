import { copy } from '@/content/copy';
import { PhotoFrame } from '@/design-system/patterns';
import { blurFor } from '@/content/image-credits';

const STEPS = [
  '/images/farms/kitchen-garden.jpg',
  '/images/markets/produce-close.jpg',
  '/images/farms/carrots-in-hands.jpg',
] as const;

export function HowItWorks() {
  return (
    <>
      <h2 id="home-how" className="display-l">
        {copy.home.howTitle}
      </h2>
      <ol className="home-how">
        {copy.home.how.map((step, i) => (
          <li key={step.title}>
            <div className="home-how__media">
              <PhotoFrame
                ratio="4:3"
                src={STEPS[i]!}
                alt=""
                sizes="(min-width: 48rem) 28rem, 90vw"
                blurDataURL={blurFor(STEPS[i]!)}
              />
              <span className="home-how__number" aria-hidden="true">
                {i + 1}
              </span>
            </div>
            <div className="home-how__copy">
              <h3 className="home-how__title">{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="home-how__statement">{copy.transaction.statement}</p>
    </>
  );
}
