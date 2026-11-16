import { Children, type ReactNode } from 'react';

/** Small facts in one line, joined by a middle dot. The dot trails its item, so a line never starts on one. */
export function MetaLine({ children, as: Tag = 'p' }: { children: ReactNode; as?: 'p' | 'div' }) {
  const items = Children.toArray(children);
  return (
    <Tag className="meta-line">
      {items.map((item, i) => (
        <span className="meta-line__item" key={i}>
          {item}
          {i < items.length - 1 ? (
            <>
              <span className="meta-line__dot" aria-hidden="true">
                ·
              </span>{' '}
            </>
          ) : null}
        </span>
      ))}
    </Tag>
  );
}
