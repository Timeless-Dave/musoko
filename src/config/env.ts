import { z } from "zod";

/**
 * The one place the environment is read. See docs/ARCHITECTURE.md section 2.
 * Only non-secret NEXT_PUBLIC_ values are read here, so this file is safe in
 * the browser bundle. Server secrets are read in src/config/server-env.ts
 * when live mode is built.
 */
const schema = z.object({
  dataMode: z.enum(["demo", "live"]).default("demo"),
  mapStyleUrl: z.url().default("https://tiles.openfreemap.org/styles/positron"),
});

export const env = schema.parse({
  dataMode: process.env.NEXT_PUBLIC_DATA_MODE || undefined,
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || undefined,
});

export type Env = typeof env;
export const isDemo = env.dataMode === "demo";
