# Architecture

Status: agreed foundation, 2026-11-15. No application code exists yet. Build step 1 scaffolds this.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js App Router, React, TypeScript strict | Named in the brief (Section 8). |
| Styling | Tailwind CSS v4, tokens as CSS variables | Theme swap is a variable swap, see DESIGN.md. |
| Primitives | Radix UI, wrapped in our own components | Accessible dialogs, selects, tabs and popovers without inheriting a look. |
| Forms | React Hook Form with Zod resolvers | One schema validates the form, the demo store and the server action. |
| Client state | Zustand with `persist` | The demo data store. One store, every screen reads and writes it. |
| Async data | TanStack Query | Same hooks work over the demo adapter and the Supabase adapter. |
| URL state | nuqs | Search, filters and sort live in the URL so results are shareable and survive reload. |
| Map | MapLibre GL with OpenFreeMap vector tiles | No token. Loaded with `next/dynamic` only when the user opens the map. |
| Motion | Motion (formerly Framer Motion), View Transitions API | Component motion and the theme peel. |
| Dates | date-fns | Small and tree-shakeable. |
| Icons | Phosphor (regular weight only), used sparingly | See DESIGN.md on icon restraint. |
| Backend | Supabase: Postgres, PostGIS, Auth, Storage | Named in the brief. Off in demo mode. |
| Tests | Vitest, Testing Library, Playwright, axe-core | Domain rules by unit test, acceptance flows end to end. |
| Tooling | pnpm, ESLint with per-folder import restrictions, Prettier | |

Pin versions to the latest stable release at scaffold time and record them in `package.json`. Do not copy version numbers from memory.

## 2. The demo switch

One environment variable decides everything:

```
NEXT_PUBLIC_DATA_MODE=demo | live      # default: demo
```

`src/config/env.ts` parses the environment with Zod and exports a typed `env`. If the variable is missing the app is in demo mode. If it is `live` and a required server secret is missing, the app fails at startup with a message naming the variable.

`src/data/index.ts` is the only place that reads the mode. It exports one object, `services`, built from the ports:

```ts
export const services: Services = env.dataMode === 'live' ? createLiveServices() : createDemoServices();
```

| Port | Demo adapter | Live adapter |
|---|---|---|
| `DataGateway` | Zustand store persisted to `localStorage`, seeded from `src/data/seed` | Supabase, through server actions |
| `AuthService` | Role switcher with one farmer, one buyer, one administrator | Supabase Auth, phone and email |
| `NotificationService` | Writes to the console and to an in-app "demo outbox" | SMS and email provider, server side |
| `MapConfig` | OpenFreeMap style URL | Same, or a configured tile source |
| `ImageStore` | Compressed in the browser, stored as a data URL in the demo store | Supabase Storage with server-side compression |
| `Clock` | `Date.now()`, overridable in tests | Same |

Adapters are loaded with dynamic import so the Supabase client is never in the demo bundle.

### Demo persistence

- Storage key `musoko.demo.v1`, in `localStorage`, so changes survive navigation, reload and role switching.
- "Reset demo data" clears the key and reseeds. It lives in the demo strip (DESIGN.md) and is reachable from every page.
- Seed dates are stored as offsets from "now" and resolved on first load. The demo never goes stale, and the "Available now" to "Availability unconfirmed" lapse is visible by design in a few seeded listings.
- A schema version sits in the stored state. A version mismatch triggers a reseed and a visible notice, never a silent wipe mid-session.
- Writes are optimistic only inside the store. A screen shows "saved" only after the store write has returned.

### Scheduled behaviour

Reminders, auto-close, availability lapse and retention are one pure function, `runScheduledJobs(state, now, settings)`, in `src/domain/jobs`. Demo mode runs it on app load and on a slow interval. Live mode runs the same rules as a scheduled database function. The rules are written once.

## 3. Layers and the dependency rule

```
app  →  features  →  domain
                  →  data/ports
                  →  design-system
data/adapters  →  data/ports, domain
```

- `domain` is pure TypeScript. No React, no Next, no storage, no `Date.now()` (it takes `now` as an argument).
- `features` never import from `data/adapters`. They call `services` through hooks.
- `design-system` knows nothing about farms or products. Domain-aware components live in `features`.
- One feature does not import another feature's internals. Shared pieces move down to `design-system` or `domain`.
- ESLint (`no-restricted-imports` per folder, in eslint.config.mjs) fails the build on a violation.

## 4. Folder structure

```
musoko/
├── CLAUDE.md
├── README.md                       setup, and exactly what remains for production (step 8)
├── .env.example                    every variable, documented, all optional in demo mode
├── .claude/
│   ├── agents/                     the expert pipeline, see BUILD-PLAN.md
│   └── skills/                     build-step, musoko-design, acceptance-check, source-imagery
├── docs/
│   ├── brief/                      the client PDF
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── ACCEPTANCE.md
│   └── BUILD-PLAN.md
├── public/
│   ├── images/
│   │   ├── produce/                product photography, AVIF and WebP
│   │   ├── farms/                  fields, rows, barns, hands at work, no identifiable faces
│   │   ├── markets/                stalls and crates
│   │   └── texture/                paper grain, soil, linen
│   └── brand/                      logo files, when they arrive
├── supabase/
│   ├── migrations/                 schema, PostGIS, row-level security
│   └── seed.sql                    generated from src/data/seed
├── tests/
│   └── e2e/                        one Playwright spec per acceptance group
└── src/
    ├── app/                        routes only: layout, page, loading, error, metadata
    │   ├── layout.tsx              fonts, theme, demo watermark and strip, providers
    │   ├── (public)/
    │   │   ├── page.tsx                        homepage
    │   │   ├── food/page.tsx                   product marketplace
    │   │   ├── farmers/page.tsx                farmer directory
    │   │   ├── farmers/[slug]/page.tsx         farmer profile
    │   │   ├── map/page.tsx                    map with equivalent list view
    │   │   ├── farmers-markets/page.tsx        farmers market list
    │   │   ├── inquiry/new/page.tsx            inquiry form
    │   │   ├── inquiry/[token]/page.tsx        buyer's private status page
    │   │   └── join/page.tsx                   farmer registration
    │   ├── (farmer)/dashboard/                 profile, products, inquiries, privacy, numbers
    │   ├── (admin)/admin/                      registrations, profiles, moderation, claims, metrics
    │   └── api/                                live mode only: webhooks, scheduled jobs
    ├── features/                   one folder per part of the product
    │   ├── home/
    │   ├── catalogue/              shared browsing pieces: data hooks, product and farm cards, search bar, category rail, shelves
    │   ├── credits/                photo credits page
    │   ├── marketplace/            search, filters, sort, product card, unit price display
    │   ├── farmers/                directory, profile, claims display
    │   ├── map/                    map view, list view, marker preview
    │   ├── farmers-markets/
    │   ├── inquiry/                form, confirmation, status page, reply
    │   ├── farmer-registration/
    │   ├── farmer-dashboard/
    │   ├── admin/
    │   ├── analytics/              event logging hooks and metric views
    │   ├── demo/                   watermark, strip, role switcher, reset, outbox
    │   ├── shell/                  site header, navigation, footer
    │   ├── auth/                   useSession and useActor, shared by other features
    │   └── styleguide/             development-only specimen page
    │       each feature: components/  hooks/  schemas.ts  index.ts
    ├── domain/                     pure business rules, unit tested
    │   ├── types.ts                entities and branded ids
    │   ├── units/                  unit sizes, normalized unit price, when not to convert
    │   ├── availability/           the three statuses, the confirmation window, ranking
    │   ├── quantity/               optional quantity, kept apart from status
    │   ├── inquiry/                status machine, reminder, auto-close, contact sharing
    │   ├── consent/                draft, published, unpublished, awaiting farmer review
    │   ├── claims/                 farmer-reported and verified
    │   ├── privacy/                public projections, search-text scrubbing, retention
    │   ├── analytics/              aggregation, small-sample suppression
    │   └── jobs/                   runScheduledJobs
    ├── data/
    │   ├── ports/                  DataGateway, AuthService, NotificationService, ImageStore, Clock
    │   ├── adapters/
    │   │   ├── demo/               store, gateway, auth, notifications
    │   │   └── supabase/           gateway, auth, server actions
    │   ├── seed/                   regions, communities, farms, products, markets, inquiries, events
    │   └── index.ts                the switch
    ├── design-system/
    │   ├── tokens/                 tokens.css, the only file with colour values
    │   ├── primitives/             Button, Field, Select, Dialog, Sheet, Tabs, Tag, Stack, Section
    │   ├── patterns/               PageHeader, FilterBar, EmptyState, StatFigure, PhotoFrame
    │   └── theme/                  ThemeProvider, ThemeToggle, peel transition
    ├── content/
    │   ├── copy.ts                 constrained wording, written once
    │   └── image-credits.ts        source, author, licence for every image
    ├── config/
    │   ├── env.ts
    │   └── settings.ts             default values for every configurable period and threshold
    └── lib/                        small generic helpers: format, cn, ids
```

Route names: the product marketplace is `/food` and the farmers market list is `/farmers-markets`, so "market" never means two things in a URL.

## 5. Data model

Table names are the same in the demo store and in Postgres. Anything marked *private* is never returned by a public query.

| Table | Notes |
|---|---|
| `regions` | Arkansas Delta first. Everything hangs off a region so expansion needs no restructuring. |
| `communities` | Towns and counties inside a region, with a town-centre point. Farms, markets, pickup locations, searches and inquiries all reference a community. |
| `users`, `user_roles` | farmer, buyer, administrator. |
| `farmer_profiles` | Name, story, photos, `created_by`, `publication_status` (draft, published, unpublished), `consent_method`, `consent_date`, `consent_recorded_by`, `farmer_reviewed_latest_changes`, `open_to_wholesale`, `show_exact_location`, `show_phone`, `show_email`. |
| `farm_public_locations` | Town, county, coarse coordinates. |
| `farm_private_locations` | *Private.* Street address and exact coordinates. Own table, own access rules, because row-level security does not hide columns. |
| `farmer_private_contacts` | *Private.* Phone and email. Copied into a public projection only when the farmer opted in. |
| `product_types` | The shared list: tomatoes, collard greens, eggs. Each has a category and a comparison measure (weight, volume, count). |
| `products` | Farmer's title, product type, price, selling unit, unit size and measure, stored `normalized_unit_price` (null when conversion is unreliable), licence self-confirmation for meat, poultry, dairy and eggs. |
| `product_availability` | Status, `last_confirmed_at`, `expected_month` for coming soon. |
| `product_availability_history` | Every status change, with time. |
| `product_quantities` | Optional. Amount, unit, own `last_confirmed_at`. Separate from status. |
| `farmers_markets`, `farmer_market_links` | Name, town, days and hours, contact, directions link. |
| `pickup_locations`, `farmer_pickup_options` | Public pickup points, and each farmer's pickup schedule and own-delivery flag. |
| `inquiries` | Product, product type, farmer, community, chosen pickup or delivery option, status (awaiting response, responded, closed), requested quantity, `reminder_sent_at`, `closed_reason`, timestamps, `status_token`. |
| `inquiry_buyer_contacts` | *Private.* Name and the buyer's phone or email. Separate so it can be deleted on schedule while the inquiry row stays for analysis. |
| `inquiry_replies` | Available, Sold out, Contact me, optional short message, `phone_shared`. |
| `inquiry_outcomes` | Yes a sale, Yes a new potential customer, No, Still discussing. No amounts. |
| `claims` | Type (SNAP/EBT, practice, licence, certification), status (farmer-reported, verified), and for verified: evidence checked, date, administrator. |
| `search_events` | Cleaned short terms, matched product type, filters, community, result count, date to the day. No identifiers of any kind. |
| `preview_events` | Aggregate opens of pickup location and market previews, by location and day. |
| `aggregate_counts` | By product type, community, pickup location and period. Outlives the raw events. |
| `settings` | Confirmation window (14 days), reminder (48 hours), auto-close (14 days), retention periods, minimum sample size. |

Reserved, schema only, no screens: `buyer_profiles`, `saved_listings`, `purchasing_requests`, `food_access_programs`, `assistant_conversations`.

### Public projections

The gateway exposes separate public and privileged methods. Public methods return types such as `PublicFarm` and `PublicProduct`, built by functions in `domain/privacy`. Those types have no field for an exact coordinate, an address, or a contact detail the farmer has not opened. A private value cannot reach a public component because there is nowhere in the type to carry it. A unit test asserts that no public gateway method returns a private field for any seeded farm.

In live mode the same split is enforced twice: by views and row-level security in Postgres, and by the projection functions.

## 6. Rules that live in the domain layer

- **Unit price.** `normalizedUnitPrice(product, productType)` returns a value only when the unit has a measurable size in the product type's comparison measure. Bunch, basket and unsized "each" return null. Price sort uses the normalized value within one product type.
- **Availability.** `effectiveStatus(availability, now, settings)` downgrades "Available now" to "Availability unconfirmed" once the window lapses. Default ranking: available, coming soon, unconfirmed.
- **Inquiry lifecycle.** A state machine: awaiting response → responded → closed, with one reminder at 48 hours and auto-close at 14 days. A closed-unanswered inquiry carries alternatives of the same product type that are available now.
- **Contact sharing.** Only a "Contact me" reply with the farmer's confirmation releases the phone, and only to that inquiry's status page.
- **Consent.** `canPublish(profile)` requires recorded consent. An administrator edit to public fields sets `farmer_reviewed_latest_changes = false`.
- **Search scrubbing.** Trim, shorten, strip anything that looks like a phone number, email or street address, store the day only.
- **Small samples.** `suppress(count, basis, settings)` returns "not enough data" below the minimum. Every analytics view goes through it, including outcomes and SNAP/EBT counts.
- **Abuse protection.** Rate limit per browser session, a honeypot field and a minimum fill time in demo mode. The same checks plus server-side limits in live mode.

## 7. Rendering and performance

- Public pages are server-rendered shells with client data islands, because demo data lives in the browser. Live mode can move the same queries to the server without changing the components.
- The map bundle and tiles load only after the user opens the map. On phones the list is the default view.
- Images go through `next/image`: AVIF and WebP, explicit sizes, lazy below the fold, a blurred placeholder. Budget: under roughly 1 MB for the first mobile page load, checked in step 8.
- Fonts are self-hosted through `next/font` with `display: swap` and a subset.

## 8. What stays configurable for production

Kept as a running list for the README in step 8: Supabase project and keys, PostGIS, row-level security review, SMS provider, email provider, tile source limits, image storage bucket, scheduled jobs, the settings values the project owner still has to decide (retention periods, minimum sample size, accepted forms of consent).
