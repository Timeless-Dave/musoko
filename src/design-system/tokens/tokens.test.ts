import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every text pairing must reach 4.5:1 (docs/DESIGN.md section 3).
 * The palette is read from tokens.css, so correcting it from the logo vector
 * re-runs these checks against the true values.
 */
const SRC = join(__dirname, '../..');
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

type Rgb = [number, number, number];

function hexVar(name: string): Rgb {
  const m = css.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${name} not found in tokens.css`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (l: number) => {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, s * 255));
};

function toOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** color-mix(in oklab, a pct%, b) */
function mix(a: Rgb, pct: number, b: Rgb): Rgb {
  const la = toOklab(a);
  const lb = toOklab(b);
  const t = pct / 100;
  return fromOklab([0, 1, 2].map((i) => la[i] * t + lb[i] * (1 - t)) as Rgb);
}

function luminance(c: Rgb) {
  return 0.2126 * toLinear(c[0]) + 0.7152 * toLinear(c[1]) + 0.0722 * toLinear(c[2]);
}
function ratio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The percentages are read from the token file so they cannot drift from it. */
function pct(token: string): number {
  const m = css.match(new RegExp(`--${token}:\\s*color-mix\\(in oklab, var\\(--ink\\) (\\d+)%`));
  if (!m) throw new Error(`--${token} derivation not found`);
  return Number(m[1]);
}

const yellow = hexVar('c-yellow');
const green = hexVar('c-green');
const leaf = hexVar('c-leaf');

const scopes = [
  { name: 'yellow theme, ground tone', ground: yellow, ink: green },
  { name: 'green theme, ground tone', ground: green, ink: yellow },
  { name: 'yellow theme, inverse tone', ground: green, ink: yellow },
  { name: 'green theme, inverse tone', ground: yellow, ink: green },
];

describe('text contrast reaches 4.5:1', () => {
  for (const { name, ground, ink } of scopes) {
    describe(name, () => {
      it('ink on ground', () => expect(ratio(ink, ground)).toBeGreaterThanOrEqual(4.5));
      it('ink on ground-raised', () =>
        expect(ratio(ink, mix(ink, pct('ground-raised'), ground))).toBeGreaterThanOrEqual(4.5));
      it('ink on ground-sunk', () =>
        expect(ratio(ink, mix(ink, pct('ground-sunk'), ground))).toBeGreaterThanOrEqual(4.5));
      it('ground on ink-hover (primary button hover label)', () =>
        expect(ratio(ground, mix(ink, pct('ink-hover'), ground))).toBeGreaterThanOrEqual(4.5));
      it('ink on the watermark (text crosses it)', () =>
        expect(ratio(ink, mix(ink, pct('watermark-ink'), ground))).toBeGreaterThanOrEqual(4.5));
    });
  }

  it('reports the large-type and decoration pairings without failing on them', () => {
    const report = scopes.map(({ name, ground, ink }) => ({
      scope: name,
      inkMutedOnGround: ratio(mix(ink, pct('ink-muted'), ground), ground).toFixed(2),
      inkMutedOnGroundSunk: ratio(
        mix(ink, pct('ink-muted'), ground),
        mix(ink, pct('ground-sunk'), ground),
      ).toFixed(2),
      leafOnGround: ratio(leaf, ground).toFixed(2),
    }));
    console.info('Contrast, not enforced (large type and decoration only):', report);
    expect(report).toHaveLength(4);
  });
});

describe('colour keywords', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.css$/.test(name) ? [path] : [];
    });
  }
  it('only tokens.css names a colour keyword', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).split(sep).join('/');
      if (rel === 'design-system/tokens/tokens.css') continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/(?<![\w-])(black|white|red|blue|gray|grey)(?![\w-])/.test(line.replace(/\/\*.*?\*\//g, '')))
            offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
