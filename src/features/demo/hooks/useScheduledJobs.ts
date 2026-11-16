'use client';

import { useEffect } from 'react';
import { services } from '@/data';

/**
 * Demo mode has no database to run scheduled functions, so the app runs the
 * same rules itself: once on load, then on the interval in settings. Reminders,
 * auto-close and retention (src/domain/jobs) all happen there. Live mode runs
 * them in the database and this does nothing.
 */
export function useScheduledJobs(): void {
  useEffect(() => {
    const demo = services.demo;
    if (!demo) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const run = () => void demo.runScheduledJobs().catch((error: unknown) => console.warn('[jobs] run failed', error));

    run();
    void services.gateway
      .getSettings()
      .then((settings) => {
        if (!stopped) timer = setInterval(run, settings.scheduledJobsIntervalMinutes * 60_000);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);
}
