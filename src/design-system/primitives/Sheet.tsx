'use client';

import type { ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { X } from '@phosphor-icons/react';

/** Rises from the bottom on phones, slides in from the right from 768px. */
export function Sheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="scrim scrim--sheet" />
        <RadixDialog.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet__header">
            <RadixDialog.Title className="sheet__title">{title}</RadixDialog.Title>
            <RadixDialog.Close className="icon-button" aria-label={closeLabel}>
              <X size={24} weight="bold" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
