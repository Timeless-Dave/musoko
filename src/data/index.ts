import { env } from '@/config/env';
import { createDemoServices } from './adapters/demo';
import { createLiveServices } from './adapters/supabase';
import type { Services } from './ports';

export const services: Services = env.dataMode === 'live' ? createLiveServices() : createDemoServices();
export type { Services } from './ports';
