'use client';

import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { copy } from '@/content/copy';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/design-system/primitives';
import { recentActivity } from './activity';
import { DailyCharts } from './DailyCharts';
import { useFarmerNumbers, useNow, useOwnFarm, useOwnInquiries, useOwnListings } from './hooks';

const words = copy.dashboard.today;

/**
 * The farmer's home: what needs them and how the farm is seen. The inquiries
 * themselves and the listings each live on their own page.
 * A second tab lists what happened recently, newest first.
 */
export function Today() {
  return (
    <Tabs defaultValue="home" className="dash-tabs">
      <TabsList aria-label={words.tabs.label}>
        <TabsTrigger value="home">{words.tabs.home}</TabsTrigger>
        <TabsTrigger value="activity">{words.tabs.activity}</TabsTrigger>
      </TabsList>
      <TabsContent value="home" className="dash-home">
        <TopTasks />
        <StatsPanel />
      </TabsContent>
      <TabsContent value="activity">
        <RecentActivity />
      </TabsContent>
    </Tabs>
  );
}

function TopTasks() {
  const { data: n } = useFarmerNumbers();
  const { data: farm } = useOwnFarm();
  if (!n || !farm) return null;
  const t = words.tasks;
  return (
    <section className="dash-section" aria-labelledby="today-tasks">
      <h2 id="today-tasks" className="dash-subtitle">
        {t.title}
      </h2>
      <ul className="task-tiles">
        <TaskTile href="/dashboard/inquiries" title={t.inquiries} lines={[t.waiting(n.inquiries.awaiting), t.received(n.inquiries.recent, n.windowDays)]} />
        <TaskTile href="/dashboard/listings" title={t.listings} lines={[t.unconfirmed(n.listings.unconfirmed), t.comingSoon(n.listings.comingSoon)]} />
        <TaskTile
          href="/dashboard/profile"
          title={t.profile}
          lines={[copy.dashboard.state[farm.state], farm.profile.showPhone ? t.phoneShown : t.phoneHidden]}
        />
      </ul>
      <p className="dash-note">{t.note}</p>
    </section>
  );
}

function TaskTile({ href, title, lines }: { href: string; title: string; lines: string[] }) {
  return (
    <li>
      <Link href={href} className="task-tile">
        <span className="task-tile__title">
          {title}
          <span aria-hidden="true"> →</span>
        </span>
        {lines.map((line) => (
          <span key={line} className="task-tile__line">
            {line}
          </span>
        ))}
      </Link>
    </li>
  );
}

function StatsPanel() {
  const { data: n } = useFarmerNumbers();
  if (!n) return null;
  const s = words.stats;
  const figures = [
    { label: s.profileViews, value: n.views.farmProfile },
    { label: s.listingViews, value: n.views.listingCards },
    { label: s.contactTaps, value: n.views.contactClicks },
    { label: s.inquiries, value: n.inquiries.recent },
  ];
  return (
    <section className="dash-section" aria-labelledby="today-stats">
      <div className="dash-section__head">
        <h2 id="today-stats" className="dash-subtitle">
          {s.title}
        </h2>
        <Link href="/dashboard/numbers" className="dash-link">
          {s.viewAll}
        </Link>
      </div>
      <div className="stats-panel">
        <p className="stats-panel__period">
          <strong>{s.period}</strong> {s.window(n.windowDays)}
        </p>
        <dl className="stats-panel__row">
          {figures.map((f) => (
            <div key={f.label} className="stats-panel__figure">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <DailyCharts daily={n.daily} />
      </div>
      <p className="dash-note">{s.note}</p>
    </section>
  );
}

function RecentActivity() {
  const now = useNow();
  const { data: inquiries } = useOwnInquiries();
  const { data: listings } = useOwnListings();
  if (!inquiries || !listings) return <p role="status">{copy.common.loading}</p>;
  const items = recentActivity(inquiries, listings);
  const a = words.activity;
  return (
    <section className="dash-section" aria-labelledby="today-activity">
      <h2 id="today-activity" className="dash-subtitle">
        {a.title}
      </h2>
      {items.length === 0 ? (
        <p className="dash-calm">{a.none}</p>
      ) : (
        <ol className="activity-list">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="activity-list__item">
                <span>{item.text}</span>
                <time dateTime={item.at} className="activity-list__when">
                  {a.ago(formatDistance(new Date(item.at), now))}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
