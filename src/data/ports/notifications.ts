import type { InquiryId, IsoDateTime } from '@/domain/types';

export type NotificationTemplate =
  | 'inquiry_received'
  | 'inquiry_reminder'
  | 'inquiry_reply'
  | 'inquiry_closed'
  | 'inquiry_confirmation';

export interface OutboundNotification {
  channel: 'sms' | 'email';
  to: string;
  template: NotificationTemplate;
  body: string;
  relatedInquiryId: InquiryId | null;
}

export interface NotificationService {
  send(notification: OutboundNotification): Promise<{ id: string; accepted: boolean }>;
}

export interface DemoOutboxMessage {
  id: string;
  sentAt: IsoDateTime;
  channel: 'sms' | 'email';
  toMasked: string;
  template: NotificationTemplate;
  body: string;
  relatedInquiryId: InquiryId | null;
}
