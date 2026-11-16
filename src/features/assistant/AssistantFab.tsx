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

export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<Line[]>([{ role: 'guide', text: copy.assistant.welcome }]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lines, open]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const { answer } = answerQuestion(q);
    setLines((prev) => [...prev, { role: 'user', text: q }, { role: 'guide', text: answer }]);
    setInput('');
  };

  return (
    <>
      <button type="button" className="assistant-fab" aria-label={copy.assistant.label} onClick={() => setOpen(true)}>
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