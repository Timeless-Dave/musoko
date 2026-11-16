/**
 * INTERIM MARK. A one-colour stand-in drawn by hand from the logo raster.
 * Replace it whole when the vector file lands in public/brand/. Do not refine it.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="-1 0 66 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M0 18 H17 L32 40 L47 18 H64 V63 H49 V38 L35.5 60 H28.5 L15 38 V63 H0 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="30.2" y="19.5" width="3.6" height="8.5" rx="0.8" fill="currentColor" />
      <path
        d="M32 21 C31.5 14 28 7.5 16 6 C16 12 19 17.5 27 18.6 C29.5 19 31 20 32 21 Z"
        fill="currentColor"
      />
      <path
        d="M32.4 19.5 C32 10 37 2.5 49.5 1 C49.5 9 46.5 15.5 37 17.5 C34.5 18 33 19 32.4 19.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
