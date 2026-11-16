import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Import boundaries. See docs/ARCHITECTURE.md section 3.
 *   app -> features -> domain, data/ports, design-system
 *   data/adapters -> data/ports, domain
 * Inside one feature, use relative imports. Across features, import the
 * feature's index only ("@/features/inquiry"), never its internals.
 */
const restrict = (files, patterns) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns }],
  },
});

const featureInternals = {
  group: ["@/features/*/*"],
  message: "Import a feature through its index, not its internals.",
};
const adapters = {
  group: ["@/data/adapters", "@/data/adapters/**", "@/data/seed", "@/data/seed/**"],
  message: "UI goes through `services` from '@/data' and the ports. Never import an adapter or the seed.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  restrict(["src/domain/**"], [
    {
      group: ["react", "react-dom", "next", "next/**", "zustand", "zustand/**", "@/data/**", "@/data", "@/features/**", "@/app/**", "@/design-system/**", "@/content/**"],
      message: "src/domain is pure TypeScript: no React, Next, storage, data or UI imports.",
    },
  ]),
  restrict(["src/design-system/**"], [
    {
      group: ["@/features/**", "@/data/**", "@/data", "@/domain/**", "@/app/**"],
      message: "The design system knows nothing about farms, products or data.",
    },
  ]),
  restrict(["src/data/**"], [
    {
      group: ["@/features/**", "@/app/**", "@/design-system/**"],
      message: "The data layer does not import UI.",
    },
  ]),
  restrict(["src/features/**"], [adapters, featureInternals, { group: ["@/app/**"], message: "Features do not import routes." }]),
  restrict(["src/app/**"], [adapters, featureInternals]),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
