import Image from 'next/image';
import { cn } from '@/lib/cn';

const RATIOS = {
  '4:3': '4 / 3',
  '3:2': '3 / 2',
  '1:1': '1 / 1',
  '16:9': '16 / 9',
  '16:10': '16 / 10',
  '4:5': '4 / 5',
} as const;
const FOCUS = {
  center: 'center',
  top: 'center top',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
} as const;

type Common = {
  ratio: keyof typeof RATIOS;
  focus?: keyof typeof FOCUS;
  className?: string;
};

type Photo = Common & {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  blurDataURL?: string;
  specimen?: undefined;
};
type Specimen = Common & {
  /** Styleguide only. No page ships a placeholder. */
  specimen: string;
  src?: undefined;
  alt?: undefined;
};

export function PhotoFrame(props: Photo | Specimen) {
  const style = { aspectRatio: RATIOS[props.ratio] };
  if (props.specimen !== undefined) {
    return (
      <div className={cn('photo-frame photo-frame--specimen', props.className)} style={style}>
        <span className="photo-frame__specimen">{props.specimen}</span>
      </div>
    );
  }
  return (
    <div className={cn('photo-frame', props.className)} style={style}>
      <Image
        src={props.src}
        alt={props.alt}
        fill
        sizes={props.sizes}
        priority={props.priority}
        placeholder={props.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={props.blurDataURL}
        style={{ objectFit: 'cover', objectPosition: FOCUS[props.focus ?? 'center'] }}
      />
    </div>
  );
}
