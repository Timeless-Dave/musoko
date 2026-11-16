import type { ImageRef } from '@/domain/types';

export interface ImageStore {
  save(file: Blob, options: { alt: string; maxWidth: number }): Promise<ImageRef>;
  remove(image: ImageRef): Promise<void>;
}
