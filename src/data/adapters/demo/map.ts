import type { MapConfig } from '../../ports/map';

// Confirm the style URL in step 4. Nothing loads it in step 1.
export function createDemoMap(): MapConfig {
  return {
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    attribution: 'OpenFreeMap, data from OpenStreetMap contributors',
    defaultCentre: { lat: 34.55, lng: -91.2 },
    defaultZoom: 8,
  };
}
