import { copy } from '@/content/copy';

/** The word "Demo" as the last item in a meta line. Not a pill, not a ribbon. */
export function DemoMark() {
  return <span className="demo-mark">{copy.demo.mark}</span>;
}
