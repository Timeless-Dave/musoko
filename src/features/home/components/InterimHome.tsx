import { copy } from '@/content/copy';
import { Button, Section, VisuallyHidden } from '@/design-system/primitives';

/**
 * Interim page. The tagline is one headline broken across the section edge:
 * "Connecting Local Farmers" on the ground, "and Communities." on the inverse.
 * Step 2 replaces this page.
 */
export function InterimHome() {
  const [first, second] = ['Connecting Local Farmers', 'and Communities.'];
  return (
    <>
      <Section tone="ground" pad="none" className="home-a">
        <h1 className="home-headline">
          {first}
          <VisuallyHidden> {second}</VisuallyHidden>
        </h1>
      </Section>
      <Section tone="inverse" pad="none" className="home-b">
        <p className="home-headline" aria-hidden="true">
          {second}
        </p>
        <p className="home-lead">{copy.home.interim}</p>
        {process.env.NODE_ENV === 'development' ? (
          <div className="home-dev">
            <Button variant="link" href="/styleguide">
              {copy.home.styleguideLink}
            </Button>
          </div>
        ) : null}
      </Section>
      <Section tone="ground" pad="tight">
        <p className="home-initiative">{copy.brand.initiative}</p>
      </Section>
    </>
  );
}
