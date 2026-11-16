# Build plan

The eight steps come from Section 11 of the brief and are run in that order. The application must install, build and run after every step, and each step ends in a commit the owner can review.

## The pipeline

Each step passes through the same sequence of specialist agents, defined in `.claude/agents/`. One agent finishes and hands a written note to the next. Builders run on a fast model. The agents that plan and the agents that judge run on the strongest model. A failed gate sends the work back to the builder that owns the problem, and the gate runs again.

| Order | Agent | Model | Does | Hands over |
|---|---|---|---|---|
| 1 | `architect` | inherit (session model) | Reads the step, the brief and the docs. Writes the work order: files, types, port methods, which acceptance IDs are in play. | Work order |
| 2 | `domain-engineer` | sonnet | Pure rules in `src/domain` with unit tests. | Functions, types, test results |
| 3 | `data-steward` | sonnet | Ports, demo adapter, seed data, Supabase migrations and access rules. | Gateway methods, seed notes |
| 4 | `design-director` | opus | Screen-by-screen composition for the step, against DESIGN.md. Chooses imagery. | Screen specs, image list |
| 5 | `ui-engineer` | sonnet | Components and routes from the specs, on the gateway methods. | Running screens |
| 6 | `privacy-auditor` | opus | Read-only review against Section 2 and the privacy criteria. | Findings: pass or blocking |
| 7 | `acceptance-qa` | opus | Runs the app and the tests. Marks each acceptance ID in play. | Step report |

Steps 2 and 3 can run side by side when the work order says their files do not overlap. Everything else is in sequence. A step with no new rules or data skips the agents it does not need; the work order says which.

Run a step with the `build-step` skill.

## Gate for every step

- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass.
- `pnpm dev` starts with an empty `.env` and the new screens work in a browser at 360px and at desktop width, in both themes.
- No blocking finding from `privacy-auditor`.
- The step report lists each acceptance ID in play as pass, fail or not yet built, with how it was checked.
- Committed.

## Steps

### 1. Project structure, design system, seed data, demo mode
Scaffold per ARCHITECTURE.md. Tokens, fonts, primitives, `Section` with the watermark, the demo strip with role switcher and reset, the theme toggle with the peel. Domain types and the core rules (units, availability, privacy projection). Ports, demo store, full seed set. Lint boundaries. A `/styleguide` route in development only, showing every primitive in both themes.
In play: DONE-1, DONE-2, DEMO-1, MODE-1, MODE-3, PRIV-2, all SEED.

### 2. Homepage and navigation
Header, footer, responsive navigation, community selector, search bar, available-now food near the selected community, featured farmers and markets, how Musoko works, the affordable food section, the coming-soon note. Search event logging starts here.
In play: SCOPE-2, SCOPE-3, DEMO-2, CLAIM-1, DATA-1, A11Y.

### 3. Product marketplace, farmer directory, farmer profile
Search, filters, sort, unit-price display, product cards, directory, profile with claims.
In play: AVAIL-1 to 4, QTY-1 to 3, PRICE, TRUST, PRIV-1, PRIV-3, CLAIM-2, DATA-1, DATA-2, DPRIV-1.

### 4. Map and farmers market list
Lazy map with markers for farms, markets and pickup locations, preview, filters, equivalent list view, farmers market list. Preview-open counting.
In play: PRIV-1, DEMO-2, DATA-4, A11Y-2.

### 5. Buyer inquiry flow
Form, confirmation, private status page, notification through the port, abuse protection, lifecycle jobs.
In play: INQ-1, INQ-2, INQ-5, INQ-6, INQ-7, QTY-5, STAT, DATA-3.

### 6. Farmer registration and dashboard
Registration, profile editing, listings with presets, one-tap still available, coming soon, inquiry replies, contact sharing, outcome question, privacy settings, numbers.
In play: AVAIL-5, QTY-4, INQ-3, INQ-4, CONS-2, CONS-4, OUT, MODE-2.

### 7. Administrator dashboard
Registration queue, create and edit on a farmer's behalf with consent and review status, moderation, claim verification, awaiting-response list, pilot metrics with small-sample suppression, retention jobs.
In play: CONS-1 to 3, TRUST-1, TRUST-2, METRIC, DPRIV-2 to 4, DATA-2.

### 8. README and full acceptance check
README with setup and the production list. Run `acceptance-check` across every ID. Page-weight and accessibility pass. Fix what fails.
In play: everything.
