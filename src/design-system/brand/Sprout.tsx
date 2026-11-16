/**
 * The stem and two leaves of the interim mark. With `animate` the leaves sway:
 * the loading indicator. Static under reduced motion (see primitives.css).
 */
export function Sprout({ size = 18, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg
      viewBox="14 0 38 30"
      width={size}
      height={size * (30 / 38)}
      aria-hidden="true"
      focusable="false"
      className="sprout"
      data-animate={animate ? 'true' : undefined}
    >
      <rect x="30.2" y="19.5" width="3.6" height="8.5" rx="0.8" fill="currentColor" />
      <path
        className="sprout__leaf sprout__leaf--left"
        d="M32 21 C31.5 14 28 7.5 16 6 C16 12 19 17.5 27 18.6 C29.5 19 31 20 32 21 Z"
        fill="currentColor"
      />
      <path
        className="sprout__leaf sprout__leaf--right"
        d="M32.4 19.5 C32 10 37 2.5 49.5 1 C49.5 9 46.5 15.5 37 17.5 C34.5 18 33 19 32.4 19.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
