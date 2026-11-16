import type { Coordinates } from '@/domain/types';

export interface MapConfig {
  styleUrl: string;
  attribution: string;
  defaultCentre: Coordinates;
  defaultZoom: number;
}
