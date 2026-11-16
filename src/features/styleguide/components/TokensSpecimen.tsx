import { Specimen } from './Spread';

const COLOURS = [
  { token: 'ground', note: 'the page', edge: true },
  { token: 'ink', note: 'all text' },
  { token: 'ink-muted', note: 'ink 80% into ground' },
  { token: 'ink-faint', note: 'ink 45% into ground' },
  { token: 'rule', note: 'ink 18% into ground' },
  { token: 'ground-raised', note: 'ink 6% into ground' },
  { token: 'ground-sunk', note: 'ink 10% into ground' },
  { token: 'watermark-ink', note: 'ink 6% into ground' },
  { token: 'c-leaf', note: 'leaf green, small marks only', label: 'leaf' },
] as const;

const SPACES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];

export function TokensSpecimen() {
  return (
    <>
      <Specimen name="Colour">
        <ul className="swatches">
          {COLOURS.map((c) => (
            <li className="swatch" key={c.token}>
              <span
                className="swatch__chip"
                data-edge={'edge' in c ? 'true' : undefined}
                style={{ background: `var(--${c.token})` }}
              />
              <span>
                <span className="swatch__name">--{'label' in c ? c.label : c.token}</span>
                <span className="swatch__note">{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="specimen">
        <h3 className="specimen__name">Spacing</h3>
        <ul className="space-list">
          {SPACES.map((n) => (
            <li key={n} className="space-list__row">
              <span className="space-list__bar" style={{ width: `var(--space-${n})` }} />
              <span className="meta">
                space-{n} · {n * 4}px
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="specimen">
        <h3 className="specimen__name">Radii</h3>
        <ul className="radii">
          {[
            ['var(--radius-panel)', '12px · photographs and panels'],
            ['var(--radius-field)', '8px · fields and chips'],
            ['var(--radius-pill)', 'Full · buttons and search'],
          ].map(([radius, caption]) => (
            <li key={caption}>
              <span className="radii__box" style={{ borderRadius: radius }} />
              <span className="meta">{caption}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

