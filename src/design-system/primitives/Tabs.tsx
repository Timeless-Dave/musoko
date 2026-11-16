'use client';

import type { ComponentProps } from 'react';
import { Tabs as RadixTabs } from 'radix-ui';
import { cn } from '@/lib/cn';

export function Tabs({ className, ...props }: ComponentProps<typeof RadixTabs.Root>) {
  return <RadixTabs.Root className={cn('tabs', className)} {...props} />;
}
export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return <RadixTabs.List className={cn('tabs__list', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return <RadixTabs.Trigger className={cn('tabs__trigger', className)} {...props} />;
}
export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn('tabs__panel', className)} {...props} />;
}
