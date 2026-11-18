'use client';

import { useEffect, useRef, useState } from 'react';
import { copy } from '@/content/copy';
import { Logo } from '@/design-system/brand/Logo';
import { ArrowUp } from '@phosphor-icons/react';
import { Sheet } from '@/design-system/primitives';
import { useSelectedCommunity } from '@/features/catalogue';
import { GuideMessage } from './GuideMessage';
import { answerQuestion } from './retrieve';

type Line = { role: 'user' | 'guide'; text: string };

const STARTERS = [
  'What fresh food is available near me now?',
  'Where are the cheapest eggs?',
  'Which farmers markets are open on Saturday?',
  'How do I get to Delta Saturday Stalls from Pine Bluff?',
  'Can I pay on Musoko?',
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

  const [busy, setBusy] = useState(false);
  const { community } = useSelectedCommunity();

  /** Streams Claude's answer into the last bubble. Falls back to the local guide if the server has no key or fails. */
  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = lines
      .slice(1)
      .filter((line) => line.text)
      .map((line) => ({ role: line.role === 'user' ? ('user' as const) : ('assistant' as const), content: line.text }));
    setLines((prev) => [...prev, { role: 'user', text: q }, { role: 'guide', text: '' }]);
    setInput('');
    setBusy(true);
    const write = (text: string) =>
      setLines((prev) => [...prev.slice(0, -1), { role: 'guide', text }]);
    const fallback = () => write(`${copy.assistant.offline}\n\n${answerQuestion(q).answer}`);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ town: community?.name ?? null, messages: [...history, { role: 'user', content: q }].slice(-20) }),
      });
      if (!res.ok || !res.body) return fallback();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (text.includes('\u0000')) return fallback();
        write(text);
      }
      if (!text.trim()) fallback();
    } catch {
      fallback();
    } finally {
      setBusy(false);
    }
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
          <div className="assistant-thread" role="log" aria-live="polite">
            {lines.map((line, i) =>
              line.role === 'user' ? (
                <p key={i} className="assistant-bubble assistant-bubble--user">
                  {line.text}
                </p>
              ) : (
                <div key={i} className="assistant-row">
                  <span className="assistant-avatar" aria-hidden="true">
                    <Logo size={18} />
                  </span>
                  <div className="assistant-bubble assistant-bubble--guide">
                    {line.text ? (
                      <GuideMessage text={line.text} />
                    ) : (
                      <span className="assistant-typing" aria-label={copy.assistant.thinking}>
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
            {lines.length === 1 ? (
              <div className="assistant-starters" aria-label={copy.assistant.suggestions}>
                {STARTERS.map((prompt) => (
                  <button key={prompt} type="button" className="assistant-starter" onClick={() => void ask(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
            <div ref={end} />
          </div>
          <form
            className="assistant-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <input
              className="assistant-compose__input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label={copy.assistant.ask}
              placeholder={copy.assistant.placeholder}
              maxLength={500}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button
              type="submit"
              className="assistant-compose__send"
              aria-label={copy.assistant.send}
              disabled={busy || !input.trim()}
            >
              <ArrowUp size={18} weight="bold" aria-hidden="true" />
            </button>
          </form>
          <p className="assistant-panel__note">{copy.assistant.body}</p>
        </div>
      </Sheet>
    </>
  );
}