import type { ReactNode } from 'react';

/** A sentence and one action. No illustration, no icon. */
export function EmptyState({ sentence, action }: { sentence: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-state__sentence">{sentence}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
