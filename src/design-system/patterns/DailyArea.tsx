'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface DailyPoint {
  /** YYYY-MM-DD */
  day: string;
  value: number;
}

const W = 600;
const H = 180;
const PAD_TOP = 14;
const PAD_BOTTOM = 6;

/** A smooth path through the points that never overshoots between them (monotone cubic). */
function smoothPath(points: readonly [number, number][]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx = (i: number) => points[i + 1][0] - points[i][0];
  const slope = (i: number) => (points[i + 1][1] - points[i][1]) / dx(i);
  const tangents = points.map((_, i) => {
    if (i === 0) return slope(0);
    if (i === n - 1) return slope(n - 2);
    const a = slope(i - 1);
    const b = slope(i);
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = (x1 - x0) / 3;
    d += ` C${x0 + h},${y0 + tangents[i] * h} ${x1 - h},${y1 - tangents[i + 1] * h} ${x1},${y1}`;
  }
  return d;
}

/**
 * One series of daily counts as a line with a shaded area under it, like a
 * price chart. Ink only, a crosshair and label on hover or arrow keys, the
 * week-on-week change in the header, and the same numbers as a table.
 */
export function DailyArea({
  title,
  data,
  formatDay,
  unit,
  tableLabel,
  changeLabel,
}: {
  title: string;
  data: readonly DailyPoint[];
  /** "17 Nov" from "2026-11-17". */
  formatDay: (day: string) => string;
  /** "12 views". */
  unit: (n: number) => string;
  tableLabel: string;
  /** "vs the week before". Shown only when there are two full weeks to compare. */
  changeLabel?: string;
}) {
  const id = useId();
  const plot = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const { line, area, points, max, total, change } = useMemo(() => {
    const top = Math.max(1, ...data.map((d) => d.value));
    const niceMax = top <= 4 ? top : Math.ceil(top / 5) * 5;
    const step = data.length > 1 ? W / (data.length - 1) : 0;
    const pts = data.map((d, i) => [i * step, PAD_TOP + (1 - d.value / niceMax) * (H - PAD_TOP - PAD_BOTTOM)] as [number, number]);
    const path = smoothPath(pts);
    const sum = data.reduce((n, d) => n + d.value, 0);
    let delta: number | null = null;
    if (data.length >= 14) {
      const recent = data.slice(-7).reduce((n, d) => n + d.value, 0);
      const before = data.slice(-14, -7).reduce((n, d) => n + d.value, 0);
      // A percentage on a handful of counts misleads, so small weeks show no change figure.
      if (before >= 5) delta = Math.round(((recent - before) / before) * 100);
    }
    return {
      line: path,
      area: pts.length ? `${path} L${pts[pts.length - 1][0]},${H} L0,${H} Z` : '',
      points: pts,
      max: niceMax,
      total: sum,
      change: delta,
    };
  }, [data]);

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || data.length === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setActive(Math.round(ratio * (data.length - 1)));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!data.length) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const from = active ?? data.length - 1;
      setActive(Math.min(data.length - 1, Math.max(0, from + (event.key === 'ArrowRight' ? 1 : -1))));
    }
    if (event.key === 'Escape') setActive(null);
  };

  const shownIndex = active ?? data.length - 1;
  const shown = data[shownIndex];
  const point = points[shownIndex];
  const first = data[0];
  const last = data[data.length - 1];
  const leftPct = point ? (point[0] / W) * 100 : 0;

  return (
    <figure className="daily-area" aria-labelledby={`${id}-title`}>
      <figcaption className="daily-area__head">
        <span id={`${id}-title`} className="daily-area__title">
          {title}
        </span>
        <span className="daily-area__total">{unit(total)}</span>
        {change !== null && changeLabel ? (
          <span className="daily-area__change" data-direction={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}>
            <span aria-hidden="true">{change > 0 ? '▲' : change < 0 ? '▼' : '•'}</span> {change > 0 ? '+' : ''}
            {change}% {changeLabel}
          </span>
        ) : null}
      </figcaption>
      <div
        ref={plot}
        className="daily-area__plot"
        tabIndex={data.length ? 0 : -1}
        role="img"
        aria-label={`${title}: ${unit(total)}. Use the arrow keys to read each day.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <span className="daily-area__max" aria-hidden="true">
          {max}
        </span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className="daily-area__grid" x1="0" x2={W} y1={PAD_TOP} y2={PAD_TOP} />
          <line className="daily-area__grid" x1="0" x2={W} y1={(PAD_TOP + H - PAD_BOTTOM) / 2} y2={(PAD_TOP + H - PAD_BOTTOM) / 2} />
          <path d={area} fill={`url(#${id}-fill)`} />
          <path d={line} className="daily-area__line" />
          {active !== null && point ? (
            <line className="daily-area__crosshair" x1={point[0]} x2={point[0]} y1="0" y2={H} />
          ) : null}
        </svg>
        {point ? (
          <span
            className="daily-area__dot"
            data-live={active === null || undefined}
            style={{ left: `${leftPct}%`, top: `${(point[1] / H) * 100}%` }}
          />
        ) : null}
        {active !== null && shown ? (
          <div
            className="daily-area__tip"
            role="status"
            style={{ left: `${leftPct}%` }}
            data-edge={leftPct < 15 ? 'start' : leftPct > 85 ? 'end' : undefined}
          >
            <strong>{unit(shown.value)}</strong>
            <span>{formatDay(shown.day)}</span>
          </div>
        ) : null}
      </div>
      {first && last ? (
        <div className="daily-area__axis" aria-hidden="true">
          <span>{formatDay(first.day)}</span>
          <span>{formatDay(last.day)}</span>
        </div>
      ) : null}
      <details className="daily-bars__table">
        <summary>{tableLabel}</summary>
        <table>
          <caption className="visually-hidden">{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <th scope="row">{formatDay(d.day)}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
