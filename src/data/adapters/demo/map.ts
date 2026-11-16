import type { MapConfig } from '../../ports/map';

// OpenFreeMap's hosted "positron" style: no key, no account. Only the map view loads it, and only when opened.
export function createDemoMap(): MapConfig {
  return {
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    attribution: 'OpenFreeMap, data from OpenStreetMap contributors',
    defaultCentre: { lat: 34.55, lng: -91.2 },
    defaultZoom: 8,
  };
}
