# Acceptance criteria

Section 3 of the brief, numbered so each one can be traced to a test and reported on. Wording follows the brief. Where a line here and the brief differ, the brief is right.

Mark each line in the step report as pass, fail or not yet built. Never mark a line pass without having exercised it in the running app or in a test.

## Definition of done (Section 1)

- **DONE-1** Installs and runs end to end with no external credentials, on seeded demonstration data, in demo mode.
- **DONE-2** Real services (database, authentication, map tiles, notifications) sit behind a clear integration interface and are switched on by environment variables.
- **DONE-3** A README gives setup steps and lists exactly what remains to be configured for production, including that an SMS provider must be configured.
- **DONE-4** Every criterion below passes.

## Scope (Section 1)

- **SCOPE-1** All twelve parts exist and are interactive: design system, homepage and navigation, marketplace, farmer directory, farmer profile, map, farmers market list, inquiry flow with reply, farmer registration, farmer dashboard, administrator dashboard, anonymous logging.
- **SCOPE-2** None of these exist beyond one short "coming soon" mention on the homepage: AI assistant, institutional portal, purchasing requests and quotes, food-access program discovery, checkout, payments, commissions, Musoko-run delivery.
- **SCOPE-3** Nothing looks or reads like a grocery delivery app: no cart, no checkout, no delivery-time promises.

## Demo labelling

- **DEMO-1** A persistent banner on every page states that the site is showing demonstration data. (Met by the demo strip. The watermark is additional.)
- **DEMO-2** Every fictional farm, product and market carries a visible "Demo" badge on cards, profiles and map previews.

## Demo mode behaviour

- **MODE-1** Changes persist across navigation, role switching and reload: profile and listing edits, availability confirmations, new registrations, inquiries, replies, outcomes, administrator actions.
- **MODE-2** Roles share one data set. A buyer's inquiry appears in that farmer's dashboard, the farmer's reply appears on the buyer's status page, and both appear in administrator metrics.
- **MODE-3** "Reset demo data" restores the original seed.
- **MODE-4** No screen appears to save a change that is then lost.

## Privacy

- **PRIV-1** Public farm pins sit at the town centre or a similarly coarse point unless the farmer opted in to the exact location.
- **PRIV-2** Exact coordinates and street addresses are stored in a separate table and are never returned by any public query or API response.
- **PRIV-3** A farmer's phone and email appear publicly only when the farmer switched that on.

## Availability status

- **AVAIL-1** Every listing shows exactly one of "Available now", "Coming soon", "Availability unconfirmed", and a "last updated" date.
- **AVAIL-2** "Available now" means confirmed within the last 14 days, configurable. "Coming soon" carries an expected month.
- **AVAIL-3** "Available now" ranks first by default and "Availability unconfirmed" ranks last.
- **AVAIL-4** A listing moves from "Available now" to "Availability unconfirmed" automatically when the window lapses.
- **AVAIL-5** The farmer dashboard has a one-tap "still available" for each listing and a simple way to set "Coming soon".

## Quantity

- **QTY-1** Status and quantity are separate. A listing may state quantity with its unit and its own last-confirmed date, for example "About 20 lb available · confirmed Nov 12".
- **QTY-2** Nothing about quantity is shown when the farmer has not entered it. "Available now" with no quantity is valid.
- **QTY-3** Quantity is shown as the farmer's estimate, never as guaranteed or reserved. Sending an inquiry does not reduce it.
- **QTY-4** When confirming "still available" the farmer can update the quantity in the same step.
- **QTY-5** When the requested quantity exceeds the stated quantity, the inquiry form says so and still allows sending.

## Assisted onboarding and consent

- **CONS-1** A profile created by an administrator is a draft and is not publicly visible until consent to publish is recorded.
- **CONS-2** Consent is recorded either by the farmer approving after signing in, or by the administrator logging the method (in person, by phone, signed form), the date and who recorded it.
- **CONS-3** When an administrator later changes public information, the profile is marked "awaiting farmer review" in the administrator dashboard until the farmer's review is recorded the same way.
- **CONS-4** A farmer can unpublish their own profile at any time.

## Price comparison

- **PRICE-1** When a listing has a measurable size, the card shows a normalized unit price beside the listed price, for example "$15 for a 5 lb box · $3.00 per lb".
- **PRICE-2** Sorting by price uses the normalized unit price within the same product type.
- **PRICE-3** No conversion is shown when it would be unreliable (bunch, basket, "each" with no weight). Those show listed price and unit only.

## Inquiries and replies

- **INQ-1** A buyer can send an inquiry from a product card or a farmer profile in three steps or fewer, and chooses text or email for the answer.
- **INQ-2** The inquiry is stored, appears in the farmer dashboard, and triggers a notification through the notification interface (console in demo mode).
- **INQ-3** The farmer replies with one tap: "Available", "Sold out" or "Contact me", with an optional short message. The reply goes to the buyer by their chosen method through the notification interface.
- **INQ-4** "Contact me" shares the farmer's phone with that buyer only, and only after the farmer confirms. No other reply reveals contact details.
- **INQ-5** The buyer's contact details are visible only to the farmer they wrote to and to administrators.
- **INQ-6** The inquiry form has basic abuse protection: rate limiting and a spam check.
- **INQ-7** Every inquiry screen states that payment and pickup are arranged directly with the farmer.

## Inquiry status and unanswered inquiries

- **STAT-1** Every inquiry shows "Awaiting response", "Responded" or "Closed" to the buyer, the farmer and administrators.
- **STAT-2** The buyer's confirmation includes a private link to a status page for that inquiry.
- **STAT-3** After a configurable period, default 48 hours, an unanswered inquiry sends the farmer one reminder.
- **STAT-4** After a further configurable period, default 14 days, an unanswered inquiry closes automatically. The buyer is told and is pointed to other "Available now" listings of the same product type.
- **STAT-5** A responded inquiry closes when the farmer records an outcome, or automatically after the same period.
- **STAT-6** Musoko never promises a response or a response time. Confirmation wording says the farmer will reply when they can.

## Trust labels

- **TRUST-1** "Listed" means only that Musoko reviewed the profile for publication. Approving a registration never produces a "Verified" label.
- **TRUST-2** "Verified" attaches to a single claim, never to a farmer or farm, and appears only when an administrator has recorded what evidence was checked and when.
- **TRUST-3** Every other claim (SNAP/EBT, practices, licences, certifications) appears only when the farmer entered it and is labelled "farmer-reported".
- **TRUST-4** No "Verified farmer" or "Verified farm" badge exists anywhere.

## Outcome follow-up

- **OUT-1** Some days after an inquiry is answered, the farmer dashboard optionally asks "Did this inquiry result in a sale or new customer relationship?" with "Yes, a sale", "Yes, a new potential customer", "No", "Still discussing".
- **OUT-2** No sale amount or payment detail is requested. Skipping has no consequence.

## Local supply and demand data

- **DATA-1** Each search is logged with terms, filters, selected community and result count, with no name, contact detail or account.
- **DATA-2** Searches with no results are recorded and visible to administrators.
- **DATA-3** Each inquiry records the pickup location, farmers market or farmer-managed delivery option chosen.
- **DATA-4** Opens of pickup location and market previews, on the map and in lists, are counted in aggregate by location, tied to no individual.

## Data privacy

- **DPRIV-1** Search events store no IP address, device identifier or precise location, only the selected community. Time is stored to the day. Search text is kept short, and anything resembling a phone number, email or street address is stripped before storage.
- **DPRIV-2** Raw search events are reduced to aggregate counts and deleted after a configurable period. Buyer contact details are deleted a configurable period after the inquiry closes, leaving product type, community, status and outcome.
- **DPRIV-3** Community-level figures are not displayed when they rest on fewer than a configurable minimum of farms, searches or inquiries. The dashboard shows "not enough data". This applies to every analytics view, including outcomes and SNAP/EBT counts.
- **DPRIV-4** Raw search events and individual inquiries are visible only to administrators.

## Pilot metrics (Section 4, shown in the administrator dashboard)

- **METRIC-1** Inquiries sent; answered and how quickly; closed without a response.
- **METRIC-2** Farmer-reported outcomes, labelled self-reported.
- **METRIC-3** Listings confirmed in the last 14 days. Active farmers by community.
- **METRIC-4** Farmers reporting SNAP/EBT acceptance, labelled self-reported.
- **METRIC-5** Most-inquired products by community. Searches with no results. Most-chosen pickup locations and farmers markets.
- **METRIC-6** Wherever counts appear, the page states they reflect only people who used Musoko and that early pilot numbers are small.

## Claims wording (Section 2)

- **CLAIM-1** Nothing implies every farmer accepts SNAP/EBT, that a product qualifies for a health or nutrition benefit, or that prices are guaranteed affordable.
- **CLAIM-2** Meat, poultry, dairy and egg listings show the farmer's licence confirmation as "farmer-reported". Musoko does not verify it.

## Accessibility and performance

- **A11Y-1** Keyboard navigable, sufficient contrast, labelled form fields, alt text on images.
- **A11Y-2** The product list, not the map, is the default on phones. The map loads only when the user opens it.
- **A11Y-3** Images are compressed and lazy-loaded. Initial mobile page load is under roughly 1 MB.
- **A11Y-4** Plain language, large touch targets, and no step that requires typing when a choice will do.

## Seed data (Section 10)

- **SEED-1** About 12 farms across Helena-West Helena, Pine Bluff, Forrest City and surrounding Delta communities. Invented names that match no real business.
- **SEED-2** About 40 products across all eight categories, covering all three statuses, with varied prices, units and seasons.
- **SEED-3** Same product type in different unit sizes across farms, plus a few listings where no conversion is possible.
- **SEED-4** Mostly farmer-reported claims, with two or three verified.
- **SEED-5** Sample search events, some with no results.
- **SEED-6** Some listings with quantity and some without, including one "Available now" with a small quantity.
- **SEED-7** One administrator-created draft awaiting consent, and one published profile marked "awaiting farmer review".
- **SEED-8** At least one community with too little data, so "not enough data" is visible.
- **SEED-9** 5 farmers markets and 3 public pickup locations.
- **SEED-10** A mix of privacy settings: some exact locations, most not; some public contact details, most not.
- **SEED-11** A few farms with farmer-reported SNAP/EBT, most without.
- **SEED-12** Inquiries in all three statuses, including one closed without a response and some with outcomes.
- **SEED-13** One farmer, one buyer and one administrator demo account.
