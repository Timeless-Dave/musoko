# Musoko

Local food marketplace for the Arkansas Delta. Buyers find small farmers and contact them directly. An initiative of ReMix Ideas. Tagline: "Connecting Local Farmers and Communities."

Musoko is a discovery and inquiry tool. It is **not** a shop: no cart, no checkout, no payments, no delivery promises.

## Read before you work

| File | What it settles |
|---|---|
| [docs/brief/Musoko-Development-Prompt-v5.pdf](docs/brief/Musoko-Development-Prompt-v5.pdf) | The client brief. Sections 1 to 3 are the contract. |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Section 3 as a numbered checklist. The review is run against this. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, folder structure, layers, demo switch, data model. |
| [docs/DESIGN.md](docs/DESIGN.md) | Taste, tokens, the two-colour theme, the peel transition, the demo watermark, imagery. |
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | The eight build steps and the agent pipeline that runs each one. |

If two documents disagree, the order of authority is: brief Sections 1 to 3, then the project owner's instructions recorded in DESIGN.md and ARCHITECTURE.md, then the rest of the brief.

## Rules that are never traded away

1. **Runs with no credentials.** `pnpm install && pnpm dev` must work on a clean machine with an empty `.env`. Demo mode is the default.
2. **Everything in demo mode is fictional and says so.** Demo watermark and demo strip on every page, a Demo mark on every farm, product and market.
3. **Location privacy.** Exact coordinates and street addresses live in a separate private table or collection. No public query, component prop or API response ever carries them. Public pins sit at the town centre unless the farmer opted in.
4. **Contact privacy.** A farmer's phone and email are public only when the farmer switched that on. "Contact me" shares the phone with one buyer, after the farmer confirms.
5. **Consent before publication.** A profile created by an administrator is a draft until consent is recorded (method, date, recorded by). Admin edits to a published profile mark it "awaiting farmer review".
6. **Claims.** "Listed" is the only profile-level label. "Verified" attaches to one claim with recorded evidence. Everything else is "farmer-reported". Never a "Verified farmer" badge. Never imply SNAP/EBT acceptance, health benefits or guaranteed affordability.
7. **No lost saves.** If a screen says something was saved, it survives navigation, role switch and reload.
8. **Phase 2 and 3 are not built.** No AI assistant, institutional portal, quotes, food-access programs, buyer accounts. One short "coming soon" note on the homepage is the only mention. The data model reserves room for them.
9. **No secrets in client code.** Only `NEXT_PUBLIC_*` values reach the browser, and none of them is a secret.

## Stack

Next.js (App Router), React, TypeScript strict, Tailwind CSS v4, Radix primitives, MapLibre GL, Zustand, Zod, TanStack Query, Motion, Vitest, Playwright, pnpm. Supabase (Postgres, PostGIS, Auth) sits behind the data ports and is off in demo mode. Details and reasons in ARCHITECTURE.md.

## Commands

The app is scaffolded in build step 1. Once it exists:

```bash
pnpm dev          # run in demo mode
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, includes the import-boundary rules
pnpm test         # vitest, domain and data layers
pnpm test:e2e     # playwright, acceptance flows
```

A step is not finished until typecheck, lint, test and build all pass and the app runs.

## How code is organised

Dependencies point one way: `app` → `features` → `domain` and `data/ports` and `design-system`. `domain` imports nothing from React, Next or the data adapters. UI never imports an adapter directly; it goes through `data/ports`. ESLint enforces this.

- Business rules (unit price, availability status, inquiry lifecycle, privacy projection, small-sample suppression) are pure functions in `src/domain` with unit tests.
- Every configurable period or threshold comes from `settings`, never a literal in a component.
- All user-facing wording for constrained topics (transaction disclaimer, claim labels, response-time wording) lives in `src/content/copy.ts` so it is written once and reviewed once.

## Design

Load the `musoko-design` skill before writing or changing any UI. The short version: DoorDash's browsing structure, Uber Eats' minimalism, and Musoko's own identity built on farmers, fresh food and community (never a delivery app's cart, ratings or delivery chips). Two themes, one yellow and one green: the logo's two colours swapped. A buyer finds what they need in seconds. No decorative accent borders on cards, no gradient blobs, no stock-looking icon grids. Colour values were read from the logo by eye and will be corrected, so never hardcode a colour value outside the token file.

## Working in steps

Use the `build-step` skill to run a step from BUILD-PLAN.md. It hands the work through the agents in `.claude/agents/` in order and ends with `acceptance-check`. Commit at the end of each step so the owner can review as the build goes.
