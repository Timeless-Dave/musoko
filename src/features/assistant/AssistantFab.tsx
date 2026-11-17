'use client';

import { useEffect, useRef, useState } from 'react';
import { copy } from '@/content/copy';
import { Logo } from '@/design-system/brand/Logo';
import { Button, Field, Sheet } from '@/design-system/primitives';
import { answerQuestion } from './retrieve';

type Line = { role: 'user' | 'guide'; text: string };

const STARTERS = [
  'How do I find food near me?',
  'How do I contact a farmer?',
  'Is this real data?',
  'How do I join as a farmer?',
];

/** How long the page must sit untouched before the guide says hello. */
const IDLE_MS = 20_000;
/** Delay between typed characters in the hello bubble. */
const TYPE_MS = 35;
/** How long the finished hello stays up before it fades on its own. */
const LINGER_MS = 8_000;
const NUDGE_SEEN_KEY = 'musoko:assistant-nudge-seen';

function nudgeSeen(): boolean {
  try {
    return window.sessionStorage.getItem(NUDGE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markNudgeSeen() {
  try {
    window.sessionStorage.setItem(NUDGE_SEEN_KEY, '1');
  } catch {
    // Storage blocked: the in-memory flag still stops repeats on this page.
  }
}

/** Shows a short typed hello beside the button after the page has been idle, once per session. */
function useIdleNudge(paused: boolean) {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState('');
  const shown = useRef(false);
  const full = copy.assistant.nudge;

  useEffect(() => {
    if (paused || shown.current || nudgeSeen()) return;
    let timer = window.setTimeout(fire, IDLE_MS);
    function fire() {
      shown.current = true;
      markNudgeSeen();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTyped(reduce ? full : '');
      setVisible(true);
      cleanup();
    }
    function reset() {
      window.clearTimeout(timer);
      timer = window.setTimeout(fire, IDLE_MS);
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    function cleanup() {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, reset));
    }
    return cleanup;
  }, [paused, full]);

  useEffect(() => {
    if (!visible) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = reduce ? full.length : 0;
    let linger: number | undefined;
    const tick = window.setInterval(() => {
      if (i >= full.length) {
        window.clearInterval(tick);
        linger = window.setTimeout(() => setVisible(false), LINGER_MS);
        return;
      }
      i += 1;
      setTyped(full.slice(0, i));
    }, TYPE_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(linger);
    };
  }, [visible, full]);

  return { visible: visible && !paused, typed, done: typed.length === full.length, dismiss: () => setVisible(false) };
}

export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<Line[]>([{ role: 'guide', text: copy.assistant.welcome }]);
  const [tone, setTone] = useState<'ground' | 'inverse'>('ground');
  const end = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const nudge = useIdleNudge(open);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lines, open]);

  useEffect(() => {
    const button = fab.current;
    if (!button) return;
    const read = () => {
      const box = button.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const stack = document.elementsFromPoint(x, y);
      const section = stack.find((el) => el instanceof HTMLElement && el.hasAttribute('data-tone') && el !== button);
      const next = section instanceof HTMLElement && section.getAttribute('data-tone') === 'inverse' ? 'inverse' : 'ground';
      setTone(next);
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const { answer } = answerQuestion(q);
    setLines((prev) => [...prev, { role: 'user', text: q }, { role: 'guide', text: answer }]);
    setInput('');
  };

  return (
    <>
      {nudge.visible ? (
        <div className="assistant-nudge" data-done={nudge.done || undefined}>
          <button
            type="button"
            className="assistant-nudge__text"
            aria-label={copy.assistant.nudge}
            onClick={() => {
              nudge.dismiss();
              setOpen(true);
            }}
          >
            <span aria-hidden="true">
              {nudge.typed}
              {nudge.done ? null : <span className="assistant-nudge__caret" />}
            </span>
          </button>
          <button
            type="button"
            className="assistant-nudge__close"
            aria-label={copy.assistant.nudgeDismiss}
            onClick={nudge.dismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
      <button
        ref={fab}
        type="button"
        className="assistant-fab"
        data-tone={tone}
        aria-label={copy.assistant.label}
        onClick={() => {
          nudge.dismiss();
          setOpen(true);
        }}
      >
        <Logo size={28} />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={copy.assistant.title} closeLabel={copy.assistant.close}>
        <div className="assistant-panel">
          <p className="assistant-panel__note">{copy.assistant.body}</p>
          <div className="assistant-thread" role="log" aria-live="polite">
            {lines.map((line, i) => (
              <p key={`${line.role}-${i}`} className={`assistant-bubble assistant-bubble--${line.role}`}>
                {line.text}
              </p>
            ))}
            <div ref={end} />
          </div>
          <div className="assistant-starters">
            {STARTERS.map((prompt) => (
              <button key={prompt} type="button" className="assistant-starter" onClick={() => ask(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="assistant-compose"
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
          >
            <Field label={copy.assistant.ask} value={input} onChange={(event) => setInput(event.target.value)} />
            <Button type="submit" variant="primary">
              {copy.assistant.send}
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}