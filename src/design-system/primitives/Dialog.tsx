'use client';

import type { ReactNode, RefObject } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { X } from '@phosphor-icons/react';

/** A centred confirm or message. Radix handles focus, Escape and the scrim. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  actions,
  children,
  initialFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  actions: ReactNode;
  children?: ReactNode;
  /** The element to focus on open. For a confirm this is the safe action, not the destructive one. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="scrim scrim--dialog" />
        <RadixDialog.Content
          className="dialog"
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
        >
          <RadixDialog.Title className="dialog__title">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="dialog__description">{description}</RadixDialog.Description>
          ) : null}
          {children}
          <div className="dialog__actions">{actions}</div>
          <RadixDialog.Close className="icon-button dialog__close" aria-label={closeLabel}>
            <X size={24} weight="bold" aria-hidden="true" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
