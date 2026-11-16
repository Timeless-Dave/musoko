'use client';

import { useRef, useState } from 'react';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { Button, Dialog } from '@/design-system/primitives';

/** Confirms, resets, and reports success only after the store has been reset. */
export function ResetDemoData({
  variant = 'link',
  block,
  onDone,
}: {
  variant?: 'secondary' | 'link';
  block?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  async function confirm() {
    if (!services.demo) return;
    setBusy(true);
    setFailed(false);
    try {
      await services.demo.reset();
      setOpen(false);
      onDone?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} block={block} onClick={() => setOpen(true)}>
        {copy.demo.reset}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title={copy.demo.reset}
        description={copy.demo.resetConfirm}
        closeLabel={copy.common.close}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button loading={busy} loadingLabel={copy.common.saving} onClick={() => void confirm()}>
              {copy.demo.reset}
            </Button>
            <Button variant="secondary" ref={cancelRef} onClick={() => setOpen(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      >
        {failed ? (
          <p className="dialog__error" role="alert">
            {copy.demo.resetFailed}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
