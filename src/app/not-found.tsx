import { Button, Section } from '@/design-system/primitives';
import { copy } from '@/content/copy';

export default function NotFound() {
  return (
    <Section tone="ground" pad="default">
      <h1 className="display-l">{copy.notFound.title}</h1>
      <div className="not-found__action">
        <Button variant="link" href="/">
          {copy.notFound.home}
        </Button>
      </div>
    </Section>
  );
}
