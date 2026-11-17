'use client';

import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { copy } from '@/content/copy';

/** Round prev and next buttons for a sideways row. Hidden on touch-first phones, where the row swipes. */
export function ScrollButtons({
  back,
  forward,
  onStep,
  controls,
}: {
  back: boolean;
  forward: boolean;
  onStep: (direction: 1 | -1) => void;
  controls?: string;
}) {
  return (
    <div className="scroll-buttons">
      <button
        type="button"
        className="scroll-button"
        aria-label={copy.shell.scrollBack}
        aria-controls={controls}
        disabled={!back}
        onClick={() => onStep(-1)}
      >
        <CaretLeft size={18} weight="bold" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="scroll-button"
        aria-label={copy.shell.scrollForward}
        aria-controls={controls}
        disabled={!forward}
        onClick={() => onStep(1)}
      >
        <CaretRight size={18} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
