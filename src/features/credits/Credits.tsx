import { copy } from '@/content/copy';
import { IMAGE_CREDITS } from '@/content/image-credits';
import { PageHeader } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';

export function Credits() {
  return (
    <Section pad="tight">
      <PageHeader title={copy.credits.title} lead={copy.credits.lead} />
      <ul className="credit-list">
        {IMAGE_CREDITS.map((credit) => (
          <li key={credit.src}>
            <a href={credit.page} target="_blank" rel="noreferrer">
              {credit.alt}
            </a>{' '}
            {copy.credits.by} {credit.author} · {credit.licence} · {credit.source}
          </li>
        ))}
      </ul>
    </Section>
  );
}
