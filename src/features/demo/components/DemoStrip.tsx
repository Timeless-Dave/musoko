'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { Button, Sheet } from '@/design-system/primitives';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useDemoNotice } from '../hooks/useDemoNotice';
import { ResetDemoData } from './ResetDemoData';
import { RoleSwitcher } from './RoleSwitcher';

/** The accessible statement of demo mode, fixed to the bottom edge of every page. */
export function DemoStrip() {
  if (services.mode !== 'demo') return null;
  return <DemoStripInner />;
}

function DemoStripInner() {
  const wide = useMediaQuery('(min-width: 75rem)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const { data: notice } = useDemoNotice();
  const ref = useRef<HTMLElement | null>(null);

  // Body padding follows the strip, so wrapping text or a message row never covers content.
  const measure = useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty('--demo-strip-h', `${node.offsetHeight}px`);
    write();
    const observer = new ResizeObserver(write);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--demo-strip-h');
    };
  }, []);

  useEffect(() => {
    if (!resetDone) return;
    const timer = window.setTimeout(() => setResetDone(false), 6000);
    return () => window.clearTimeout(timer);
  }, [resetDone]);

  const showNotice = Boolean(notice);

  return (
    <aside className="demo-strip" aria-label="Demo mode" data-tone="ground" ref={measure}>
      {showNotice || resetDone ? (
        <div className="container demo-strip__messages">
          {showNotice ? (
            <div className="demo-strip__message" role="status">
              <span>{copy.demo.reseeded}</span>
              <Button variant="link" onClick={() => void services.demo?.dismissNotice()}>
                {copy.common.dismiss}
              </Button>
            </div>
          ) : null}
          {resetDone ? (
            <div className="demo-strip__message" role="status">
              <span>{copy.demo.resetDone}</span>
              <Button variant="link" onClick={() => setResetDone(false)}>
                {copy.common.dismiss}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="container demo-strip__line">
        <p className="demo-strip__statement">{copy.demo.strip}</p>
        {wide ? (
          <div className="demo-strip__controls">
            <RoleSwitcher layout="inline" />
            <span className="demo-strip__divider" aria-hidden="true" />
            <ResetDemoData variant="link" onDone={() => setResetDone(true)} />
          </div>
        ) : (
          <>
            <Button variant="link" onClick={() => setSheetOpen(true)}>
              {copy.demo.settings}
            </Button>
            <Sheet open={sheetOpen && !wide} onOpenChange={setSheetOpen} title={copy.demo.settings} closeLabel={copy.common.close}>
              <div className="demo-sheet">
                <RoleSwitcher layout="stacked" />
                <hr className="demo-sheet__rule" />
                <ResetDemoData
                  variant="secondary"
                  block
                  onDone={() => {
                    setSheetOpen(false);
                    setResetDone(true);
                  }}
                />
              </div>
            </Sheet>
          </>
        )}
      </div>
    </aside>
  );
}
