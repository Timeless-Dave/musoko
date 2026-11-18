import type { ReactNode } from 'react';
import Link from 'next/link';

/** Merchant-style KPI row: big numeral, short label, optional link — tokens only, no card chrome. */
export function KpiStrip({ children, 'aria-label': ariaLabel }: { children: ReactNode; 'aria-label'?: string }) {
  return (
    <div className="kpi-strip" role="list" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function KpiTile({
  value,
  label,
  note,
  href,
  icon,
  emphasis,
}: {
  value: string | number;
  label: string;
  note?: string;
  href?: string;
  icon?: ReactNode;
  /** Highlights the tile when work is waiting (ink on ground). */
  emphasis?: boolean;
}) {
  const body = (
    <>
      {icon ? (
        <span className="kpi-tile__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="kpi-tile__value">{value}</p>
      <p className="kpi-tile__label">{label}</p>
      {note ? <p className="kpi-tile__note">{note}</p> : null}
    </>
  );
  const className = emphasis ? 'kpi-tile kpi-tile--emphasis' : 'kpi-tile';
  // A link cannot also be a list item, so the item wraps it.
  return (
    <div role="listitem" className="kpi-tile__item">
      {href ? (
        <Link href={href} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </div>
  );
}