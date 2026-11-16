/**
 * A circle that is full, half or hollow. Always decoration: the words beside it
 * carry the meaning. Mapping from availability to fill happens in features.
 */
export function StatusMark({ fill, size = 'meta' }: { fill: 'full' | 'half' | 'hollow'; size?: 'meta' | 'body' }) {
  const px = size === 'body' ? 14 : 12;
  return (
    <svg
      className="status-mark"
      viewBox="0 0 12 12"
      width={px}
      height={px}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="6"
        cy="6"
        r="5.25"
        fill={fill === 'full' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {fill === 'half' ? (
        <path d="M0.75 6 H11.25 A5.25 5.25 0 0 1 0.75 6 Z" fill="currentColor" />
      ) : null}
    </svg>
  );
}
