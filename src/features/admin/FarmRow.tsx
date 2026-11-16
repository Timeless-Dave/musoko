import Link from 'next/link';
import { copy } from '@/content/copy';
import { MetaLine } from '@/design-system/primitives';
import type { AdminFarmRow } from '@/domain/admin';
import { DemoMark } from '@/features/demo';
import { formatDate } from '@/lib/format';

/** One profile in a list: its name, where it stands, who started it. No phone, email or address. */
export function FarmRow({ row, showConsent }: { row: AdminFarmRow; showConsent?: boolean }) {
  const words = copy.admin;
  return (
    <li className="admin-row">
      <div className="admin-row__main">
        <h3 className="admin-row__title">
          <Link href={`/admin/farms/${row.id}`}>{row.farmName}</Link>
        </h3>
        <MetaLine>
          <span>{row.town}</span>
          <span>{words.state[row.state]}</span>
          <span>{words.startedBy[row.createdByRole]}</span>
          <span>{words.registrations.added(formatDate(row.createdAt))}</span>
          <span>{copy.admin.farms.listings(row.listingCount)}</span>
          {row.isDemo ? <DemoMark /> : null}
        </MetaLine>
        {showConsent ? (
          <p className="admin-note">
            {row.consentMethod && row.consentDate
              ? words.registrations.consentLine(words.methods[row.consentMethod], formatDate(row.consentDate))
              : words.registrations.noConsent}
          </p>
        ) : null}
        {row.awaitingFarmerReview ? <p className="admin-note">{words.farms.awaitingFlag}</p> : null}
      </div>
    </li>
  );
}
