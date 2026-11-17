'use client';

import { useState } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { List, X } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { BrandWordmark } from '@/design-system/brand/BrandWordmark';
import { SidebarNav } from './SidebarNav';

/** Below 1024px the sidebar becomes a drawer that slides in from the left. */
export function MenuDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger className="icon-button site-header__menu" aria-label={copy.shell.menu}>
        <List size={24} weight="bold" aria-hidden="true" />
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="scrim scrim--dialog" />
        <RadixDialog.Content className="drawer" aria-describedby={undefined}>
          <div className="drawer__head">
            <RadixDialog.Title className="drawer__title">
              <BrandWordmark logoSize={28} />
            </RadixDialog.Title>
            <RadixDialog.Close className="icon-button" aria-label={copy.shell.closeMenu}>
              <X size={24} weight="bold" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
