'use client';

import { useId, useState } from 'react';

export interface DailyBar {
  /** YYYY-MM-DD */
  day: string;
  value: number;
}

/**
 * One series of daily counts as thin columns on a shared zero baseline. One
 * colour (ink), a hover label per day, the peak and the two end dates labelled,
 * and the same numbers as a table for anyone who does not read the picture.
 */
export function DailyBars({
  title,
  data,
  formatDay,
  unit,
  tableLabel,
}: {
  title: string;
  data: readonly DailyBar[];
  /** "17 Nov" from "2026-11-17". */
  formatDay: (day: string) => string;
  /** "views", "inquiries": used in the hover label and the summary. */
  unit: (n: number) => string;
  tableLabel: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((n, d) => n + d.value, 0);
  const first = data[0];
  const last = data[data.length - 1];
  const shown = hover === null ? null : data[hover];

  return (
    <figure className="daily-bars" aria-labelledby={`${id}-title`}>
      <figcaption className="daily-bars__head">
        <span id={`${id}-title`} className="daily-bars__title">
          {title}
        </span>
        <span className="daily-bars__total">{unit(total)}</span>
      </figcaption>
      <div className="daily-bars__plot" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        <span className="daily-bars__max">{max}</span>
        <div className="daily-bars__cols">
          {data.map((d, i) => (
            <div key={d.day} className="daily-bars__col" data-active={hover === i || undefined} onMouseEnter={() => setHover(i)}>
              <div className="daily-bars__bar" style={{ height: d.value === 0 ? 0 : `max(2px, ${(d.value / max) * 100}%)` }} />
            </div>
          ))}
        </div>
        {shown ? (
          <div
            className="daily-bars__tip"
            style={{ left: `${((hover! + 0.5) / data.length) * 100}%` }}
            data-edge={hover! < 3 ? 'start' : hover! > data.length - 4 ? 'end' : undefined}
          >
            <strong>{unit(shown.value)}</strong>
            <span>{formatDay(shown.day)}</span>
          </div>
        ) : null}
      </div>
      {first && last ? (
        <div className="daily-bars__axis" aria-hidden="true">
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
