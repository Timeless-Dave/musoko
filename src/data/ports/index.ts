import type { Clock } from './clock';
import type { AuthService } from './auth';
import type { DataGateway } from './gateway';
import type { DemoControls } from './demo';
import type { ImageStore } from './images';
import type { MapConfig } from './map';
import type { NotificationService } from './notifications';

export * from './clock';
export * from './errors';
export * from './auth';
export * from './notifications';
export * from './map';
export * from './images';
export * from './gateway';
export * from './inquiries';
export * from './institutions';
export * from './farmer';
export * from './admin';
export * from './demo';

export interface Services {
  mode: 'demo' | 'live';
  gateway: DataGateway;
  auth: AuthService;
  notifications: NotificationService;
  map: MapConfig;
  images: ImageStore;
  clock: Clock;
  /** null in live mode. */
  demo: DemoControls | null;
}
