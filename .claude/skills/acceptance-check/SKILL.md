---
name: acceptance-check
description: Check the running Musoko app against docs/ACCEPTANCE.md and produce a pass or fail table. Use at the end of a build step, before showing work to the project owner, or when asked whether the acceptance criteria pass.
---

# Acceptance check

The project owner reviews Musoko against Section 3 of the brief. docs/ACCEPTANCE.md is that section with an ID on every line. This skill produces the table they will read.

## Scope

- For a build step: the IDs listed under that step in docs/BUILD-PLAN.md, plus every ID that passed in an earlier step.
- For a full check: every ID.

## Procedure

1. **Static checks.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Keep the output.
2. **Clean start.** Move any `.env` aside, start `pnpm dev`, confirm the app loads in demo mode with no credential error. Restore the file afterwards.
3. **Automated flows.** `pnpm test:e2e`. Specs live in `tests/e2e/`, one file per acceptance group, each test named with its ID, for example `test('INQ-4 contact me shares phone with that buyer only')`. Add a spec for any ID in scope that lacks one.
4. **By hand, where automation does not fit:** how the theme peel and watermark look, plain-language wording, anything visual. Say it was checked by hand.
5. **Cross-role loop**, whenever inquiry, dashboard or admin code exists: buyer sends, farmer sees and replies, buyer status page shows the reply, admin metrics count both, reload, still there, reset, seed restored.
6. **Negative checks.** These matter more than the positive ones:
   - Fetch each public page and search the rendered HTML and the hydration payload for the seeded private addresses, exact coordinates, and the phone and email of farms that have not opted in. None may appear.
   - Open a draft profile's URL as a signed-out visitor. It must not render.
   - Search for "Verified farmer" and "Verified farm" across `src/`. Zero results.
   - Search for cart, checkout and delivery-time wording. Zero results.
7. **Accessibility.** axe on each screen in scope, both themes. Keyboard through each new flow.
8. **Weight**, in step 8 or when asked: production build, phone-sized viewport, transferred bytes for the first load of the homepage and the marketplace against the 1 MB target.

## Report

```
| ID      | Result        | How checked                     |
|---------|---------------|---------------------------------|
| PRIV-2  | pass          | e2e privacy.spec, unit gateway  |
| INQ-6   | fail          | e2e inquiry.spec, see below     |
| OUT-1   | not yet built | step 6                          |
```

Then, for each failure: steps to reproduce, what happened, what should happen, the likely file.

Then the command results, including any that failed.

## Rules

- "Pass" means it was seen to pass in this run. Not that the code looks right.
- Partly working is fail, with a note.
- A broken build fails the whole check.
- If something could not be checked, list it as not checked with the reason. Do not fold it into pass.
