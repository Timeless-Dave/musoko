'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { sg } from '../copy';

/** A sticky row of in-page links. The current section is set by an observer. */
export function StyleguideIndex() {
  const [current, setCurrent] = useState<string>(sg.sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    sg.sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sg-index" aria-label={sg.indexLabel}>
      <div className="container sg-index__row">
        {sg.sections.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className={cn('sg-index__link', current === id && 'sg-index__link--current')}
            aria-current={current === id ? 'location' : undefined}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
