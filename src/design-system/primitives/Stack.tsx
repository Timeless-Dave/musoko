import type { CSSProperties, ElementType, ReactNode } from 'react';

type Space = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32;

/** Layout only: no colour, no padding. */
export function Stack({
  as: Tag = 'div',
  direction = 'column',
  gap = 4,
  align,
  justify,
  wrap,
  className,
  children,
}: {
  as?: ElementType;
  direction?: 'column' | 'row';
  gap?: Space;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Tag
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: `var(--space-${gap})`,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
      }}
    >
      {children}
    </Tag>
  );
}
