import type { Clock } from '../../ports/clock';
import type { Services } from '../../ports';
import { createDemoAuth } from './auth';
import { createDemoControls } from './controls';
import { createDemoGateway } from './gateway';
import { createDemoImages } from './images';
import { createDemoMap } from './map';
import { createDemoNotifications } from './notifications';
import { createDemoRuntime, type DemoStorage } from './store';

export type { DemoStorage } from './store';
export { DEMO_SCHEMA_VERSION, DEMO_STORAGE_KEY } from './store';

export function createDemoServices(options: { clock?: Clock; storage?: DemoStorage } = {}): Services {
  const clock: Clock = options.clock ?? { now: () => new Date() };
  const runtime = createDemoRuntime(clock, options.storage);
  const notifications = createDemoNotifications(runtime);
  const { runJobs, ...gateway } = createDemoGateway(runtime, notifications);
  return {
    mode: 'demo',
    gateway,
    auth: createDemoAuth(runtime),
    notifications,
    map: createDemoMap(),
    images: createDemoImages(),
    clock,
    demo: createDemoControls(runtime, runJobs),
  };
}
