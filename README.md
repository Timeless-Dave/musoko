# Musoko

Local food marketplace for the Arkansas Delta. Buyers find small farmers and contact them directly. An initiative of ReMix Ideas. Tagline: "Connecting Local Farmers and Communities."

Musoko is a discovery and inquiry tool. It is **not** a shop: no cart, no checkout, no payments, no delivery promises.

## Run it

Requires Node 20+ and pnpm 11 (or `corepack enable`).

```bash
pnpm install
pnpm dev
```

The app starts at [http://localhost:3000](http://localhost:3000). It runs with no `.env` file and no external credentials: demo mode is the default. Every page carries a demo watermark and a demo strip. Every seeded farm, product and market shows a "Demo" mark.

The demo strip has a role switcher (buyer, farmer, administrator) and a "Reset demo data" button. All changes (profile edits, listings, confirmations, registrations, inquiries, replies, outcomes, administrator actions) persist in `localStorage` under `musoko.demo.v1`, survive navigation, role switching and reload, and are wiped by "Reset demo data".

## Commands

```bash
pnpm dev            # run in demo mode
pnpm build          # production build
pnpm start          # serve the production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint, includes the import-boundary rules
pnpm test           # vitest, domain and data layers
pnpm test:e2e       # playwright, acceptance flows (one spec per acceptance group)
pnpm format         # prettier
```

The first `pnpm test:e2e` run needs the Playwright browser once:

```bash
pnpm exec playwright install chromium
```

A step is not finished until typecheck, lint, test and build all pass and the app runs.

## Where to read

| File | What it settles |
|---|---|
| [docs/brief/Musoko-Development-Prompt-v5.pdf](docs/brief/Musoko-Development-Prompt-v5.pdf) | The client brief. Sections 1 to 3 are the contract. |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Section 3 as a numbered checklist. The owner review runs against it. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, folder structure, layers, demo switch, data model. |
| [docs/DESIGN.md](docs/DESIGN.md) | Taste, tokens, the two-colour theme, the peel transition, the demo watermark, imagery. |
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | The eight build steps and the agent pipeline that runs each one. |
| [CLAUDE.md](CLAUDE.md) | The rules that are never traded away. |

If two documents disagree, the order of authority is: brief Sections 1 to 3, then the project owner's instructions in DESIGN.md and ARCHITECTURE.md, then the rest of the brief.

## How code is organised

Dependencies point one way:

```
app  →  features  →  domain
                  →  data/ports
                  →  design-system
data/adapters     →  data/ports, domain
```

- `domain/` is pure TypeScript. No React, no Next, no storage, no `Date.now()` — it takes `now` as an argument.
- `features/` never import from `data/adapters/`. They call through `data/ports/`.
- `design-system/` knows nothing about farms, products or inquiries.
- One feature does not import another feature's internals.
- ESLint (`no-restricted-imports` per folder) fails the build on a violation.

The data switch is one environment variable (`NEXT_PUBLIC_DATA_MODE`, default `demo`), read once in `src/config/env.ts` and used in `src/data/index.ts` to pick the demo adapter or the Supabase adapter.

## Environment variables

See [`.env.example`](.env.example). All are optional in demo mode.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | client | `demo` (default) or `live`. Empty or absent means `demo`. |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL. Required when `NEXT_PUBLIC_DATA_MODE=live`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key. Required when `NEXT_PUBLIC_DATA_MODE=live`. Protected by row-level security. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Server actions and scheduled jobs. Never prefix with `NEXT_PUBLIC_`. Never import into client code. |

No secrets reach the browser. Only `NEXT_PUBLIC_*` values are inlined, and none of them is a secret.

## What remains to configure for production

Demo mode is finished. Flipping `NEXT_PUBLIC_DATA_MODE` to `live` turns the Supabase adapter on, but a production launch still needs the following to be set up and signed off. Each line is work that is outside the code the agents built.

### Supabase (database, auth, storage)

- Create the Supabase project.
- Apply the migrations in `supabase/migrations/` (Postgres with PostGIS enabled).
- Load the seed, or an empty start: `supabase/seed.sql` is generated from `src/data/seed` and is suitable for staging only.
- Review row-level security on every table. The brief's privacy rule is that exact coordinates, street addresses, and farmer phone and email live in separate private tables (`farm_private_locations`, `farmer_private_contacts`, `inquiry_buyer_contacts`); these tables must be unreachable by the `anon` key, and readable only by the owning farmer, the writing buyer, and administrators.
- Decide the Storage bucket for farm and product photos; set its CORS and public-read policy.
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the production environment.

### SMS and email provider (required)

Musoko sends two notifications: inquiry notifications to farmers, and reply notifications (and auto-close notices) to buyers. In demo mode these go to the console and the in-app "demo outbox". In production:

- **SMS provider must be configured.** Twilio, Vonage, MessageBird or similar. The buyer's chosen reply method ("text" or "email") is stored with the inquiry; text replies require a working SMS provider. Add its credentials as server-side environment variables and wire them into the notification service in `src/data/adapters/supabase/`.
- Email provider (Resend, Postmark, SES or similar) for the email reply method and for buyer confirmations with the private status-page link.
- Decide the sending phone number (short code or long code, A2P 10DLC registered), the sender domain, SPF / DKIM / DMARC records and the "from" address that matches Musoko's identity.

### Map tiles

Demo mode uses the free OpenFreeMap style with no token. For production decide whether to stay on OpenFreeMap (check its rate limits for the expected audience), move to a paid tile source (MapTiler, Stadia, Protomaps self-hosted), or self-host. Set the tile source in the `MapConfig` port.

### Scheduled jobs

The lifecycle rules (availability lapse, inquiry reminder at 48 hours, auto-close at 14 days, search-event retention, buyer-contact retention) are one pure function in `src/domain/jobs`. Demo mode runs it on app load. In production it must be run on a schedule, as a Supabase scheduled function or a cron-triggered Next route handler, at least daily.

### Settings the project owner still has to decide

Default values are in `src/config/settings.ts`. Confirm each before launch:

- Availability confirmation window (default 14 days).
- Inquiry reminder delay (default 48 hours).
- Inquiry auto-close delay (default 14 days).
- Search-event retention period.
- Buyer-contact retention period after an inquiry closes.
- Minimum sample size for community-level figures ("not enough data" threshold).
- Accepted forms of administrator-recorded consent (in person, by phone, signed form) and the paper trail.

### Observability and operations

- Error reporting (Sentry or similar), with PII scrubbed.
- Logging retention for the scheduled jobs' output.
- A backup and restore policy for the Postgres database and the Storage bucket.
- An administrator account seeded in production and a documented way to add more.

### Review before launch

- Run `acceptance-check` against the live environment and keep the report.
- Re-check the privacy rules in the brief, Section 2: no "Verified farmer" badge; farmer contact and exact location are opt-in; the public API cannot return a private field; the demo watermark and demo strip are hidden in live mode; the "coming soon" note about Phase 2 and 3 features is the only mention of them.
- Confirm initial mobile page load is still under roughly 1 MB.
