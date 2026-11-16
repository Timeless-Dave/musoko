import type { ReactNode } from 'react';

/** A ledger grid of figures: hairlines between cells, not borders on cards. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

/**
 * A large numeral with a plain label. When there is too little data, pass
 * `insufficient` with a sentence: it takes the figure's place and keeps its height.
 */
export function StatFigure({
  figure,
  label,
  note,
  insufficient,
}: {
  figure?: string | number;
  label: string;
  note?: string;
  insufficient?: string;
}) {
  return (
    <div className="stat-figure">
      <div className="stat-figure__slot">
        {insufficient ? (
          <p className="stat-figure__insufficient">{insufficient}</p>
        ) : (
          <p className="stat-figure__figure">{figure}</p>
        )}
      </div>
      <p className="stat-figure__label">{label}</p>
      {note ? <p className="stat-figure__note">{note}</p> : null}
    </div>
  );
}
