'use client';

import { copy } from '@/content/copy';
import { DailyArea } from '@/design-system/patterns';
import type { DailyCount } from '@/domain/farmer';
import { dayShort } from './format';

const s = copy.dashboard.today.stats;

/** Views and inquiries per day, as two shaded line charts: their scales differ, so they never share an axis. */
export function DailyCharts({ daily }: { daily: readonly DailyCount[] }) {
  return (
    <div className="daily-charts">
      <DailyArea
        title={s.viewsPerDay}
        data={daily.map((d) => ({ day: d.day, value: d.views }))}
        formatDay={dayShort}
        unit={s.viewsUnit}
        tableLabel={s.asTable}
        changeLabel={s.vsLastWeek}
      />
      <DailyArea
        title={s.inquiriesPerDay}
        data={daily.map((d) => ({ day: d.day, value: d.inquiries }))}
        formatDay={dayShort}
        unit={s.inquiriesUnit}
        tableLabel={s.asTable}
        changeLabel={s.vsLastWeek}
      />
    </div>
  );
}
