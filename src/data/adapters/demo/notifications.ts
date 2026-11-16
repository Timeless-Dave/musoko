import { newId } from '@/lib/ids';
import type { NotificationService, OutboundNotification } from '../../ports/notifications';
import type { DemoRuntime } from './store';

/** Last two characters of a phone; first character and domain of an email. */
export function maskRecipient(channel: 'sms' | 'email', to: string): string {
  if (channel === 'sms') return `*****${to.slice(-2)}`;
  const at = to.lastIndexOf('@');
  if (at < 1) return '*****';
  return `${to[0]}*****${to.slice(at)}`;
}

export function createDemoNotifications(runtime: DemoRuntime): NotificationService {
  return {
    async send(n: OutboundNotification) {
      const id = newId('msg');
      const toMasked = maskRecipient(n.channel, n.to);
      await runtime.commit((s) => ({
        ...s,
        outbox: [
          ...s.outbox,
          {
            id,
            sentAt: runtime.clock.now().toISOString(),
            channel: n.channel,
            toMasked,
            template: n.template,
            body: n.body,
            relatedInquiryId: n.relatedInquiryId,
          },
        ],
      }));
      console.info(`[demo outbox] ${n.channel} ${n.template} to ${toMasked}`);
      return { id, accepted: true };
    },
  };
}
