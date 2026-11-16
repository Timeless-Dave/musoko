import { MetaLine } from '@/design-system/primitives';
import { DemoMark } from '@/features/demo';
import { Specimen } from './Spread';

const SIZES = [
  { cls: 'display-xl', text: 'Fresh food near you', token: 'display-xl · 800' },
  { cls: 'display-l', text: 'Pine Bluff farmers', token: 'display-l · 800' },
  { cls: 'display-m', text: 'Available now near Helena-West Helena', token: 'display-m · 800' },
  { cls: 'display-s', text: 'Coming in June', token: 'display-s · 800' },
];

export function TypeSpecimen() {
  return (
    <Specimen name="Scale">
      <div className="type-list">
        {SIZES.map((s) => (
          <div className="type-row" key={s.cls}>
            <p className={s.cls}>{s.text}</p>
            <p className="meta type-row__token">{s.token}</p>
          </div>
        ))}
        <div className="type-row">
          <p className="lead">Pick up Saturday at the Cherry Street market.</p>
          <p className="meta type-row__token">lead · 400</p>
        </div>
        <div className="type-row">
          <p className="body-measure">
            The farmer picks the day and the place. Prices are set by the farm, and so is what is on offer this week.
          </p>
          <p className="meta type-row__token">body · 400 · 65 characters at most</p>
        </div>
        <div className="type-row">
          <MetaLine>
            {'Updated 3 days ago'}
            <DemoMark />
          </MetaLine>
          <p className="meta type-row__token">meta · 400</p>
        </div>
        <div className="type-row">
          <div className="prices">
            <p className="display-s">$15 for a 5 lb box · $3.00 per lb</p>
            <p className="prices__row">$4.50 for a half gallon · $9.00 per gallon</p>
            <p className="prices__row">$5.00 a dozen</p>
          </div>
          <p className="meta type-row__token">tabular figures</p>
        </div>
      </div>
    </Specimen>
  );
}
