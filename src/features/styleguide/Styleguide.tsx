import { PageHeader } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';
import { sg } from './copy';
import { DemoDataSpecimen } from './components/DemoDataSpecimen';
import { PatternsSpecimen } from './components/PatternsSpecimen';
import { PrimitivesSpecimen } from './components/PrimitivesSpecimen';
import { StyleguideIndex } from './components/StyleguideIndex';
import { ThemeSpecimen } from './components/ThemeSpecimen';
import { TokensSpecimen } from './components/TokensSpecimen';
import { TypeSpecimen } from './components/TypeSpecimen';

const BODIES = {
  tokens: TokensSpecimen,
  type: TypeSpecimen,
  primitives: PrimitivesSpecimen,
  patterns: PatternsSpecimen,
  theme: ThemeSpecimen,
  'demo-data': DemoDataSpecimen,
} as const;

/** Development only. Every primitive and pattern, in both themes. */
export function Styleguide() {
  return (
    <>
      <Section tone="ground" pad="none">
        <PageHeader title={sg.title} lead={sg.lead} />
      </Section>
      <StyleguideIndex />
      {sg.sections.map(({ id, label }) => {
        const Body = BODIES[id];
        return (
          <Section key={id} tone="ground" pad="default" id={id} aria-labelledby={`${id}-title`}>
            <h2 className="display-m sg-heading" id={`${id}-title`}>
              {label}
            </h2>
            <Body />
          </Section>
        );
      })}
    </>
  );
}
