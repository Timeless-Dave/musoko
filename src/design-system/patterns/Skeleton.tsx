/** A bar standing in for one line of content, laid out exactly like the loaded line. */
export function SkeletonBar({ width = '100%', height = '1em' }: { width?: string; height?: string }) {
  return <span className="skeleton-bar" aria-hidden="true" style={{ width, height }} />;
}

/** Wrap loading content: marks the region busy and announces it once. */
export function SkeletonRegion({
  loadingLabel,
  children,
  as: Tag = 'div',
  className,
}: {
  loadingLabel: string;
  children: React.ReactNode;
  as?: 'div' | 'ul' | 'ol';
  className?: string;
}) {
  return (
    <Tag aria-busy="true" className={className}>
      <span className="visually-hidden" role="status">
        {loadingLabel}
      </span>
      {children}
    </Tag>
  );
}
