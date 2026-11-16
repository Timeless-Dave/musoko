import type { Settings } from '@/domain/types';

/** The only place these numbers are written. Everything else reads db.settings or gateway.getSettings(). */
export const defaultSettings: Settings = {
  availabilityWindowDays: 14,
  comingSoonHorizonMonths: 12,
  farmerNumbersWindowDays: 30,
  inquiryReminderHours: 48,
  inquiryAutoCloseDays: 14,
  outcomePromptDays: 3,
  searchEventRetentionDays: 90, // owner to decide
  buyerContactRetentionDays: 30, // owner to decide
  minimumSampleSize: 5, // owner to decide
  searchTermMaxLength: 60,
  inquiryRateLimitPerHour: 5,
  inquiryMinFillSeconds: 3,
  scheduledJobsIntervalMinutes: 5,
};
