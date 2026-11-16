# Design

Status: direction agreed 2026-11-15. Logo received the same day: a heavy dark-green M with a two-leaf sprout, one leaf green and one yellow. The colour values below are read from the logo image by eye and must be replaced with the exact values from the vector file.

## 1. The feeling

The owner's direction, in one line: the intuitive marketplace experience of DoorDash, the clean minimalism of Uber Eats, and an identity that is Musoko's own, centred on local farmers, fresh food and community. A person opens it and finds what they need in seconds.

So there are three layers, and each has one source:

- **How it works** comes from DoorDash: the structure of browsing.
- **How it looks** comes from Uber Eats: a calm, mostly neutral page, a great deal of white space, very few colours, very little decoration, type and photographs doing the work.
- **What it is about** comes from neither. See "What makes it Musoko" below.

A buyer must be able to answer three questions within seconds on every buyer-facing screen: what fresh food is near me, how much does it cost, where and when can I get it. If a design choice slows any of those, it loses.

### The seconds test

Every buyer-facing screen is checked against this, on a phone:

- The search field and the community selector are visible without scrolling.
- Real food with a price and a pickup place is visible without scrolling, or after one short scroll on the homepage.
- From opening the homepage, a buyer reaches a specific product's price and pickup details in at most two taps, and an inquiry form in at most three.
- No screen opens on an explanation, a carousel of slogans or a sign-up prompt. The food comes first; "How Musoko works" sits below it.
- Remembered choices: the selected community persists, so a returning buyer lands on their own town's food.

### What we take from Uber Eats

- Calm through restraint. One ground colour and one ink per theme, and nothing else coloured except photographs.
- Few elements per screen, each with room. Cut anything that does not help answer the three questions.
- Flat surfaces. No card borders and no shadows on tiles: a photograph, then text beneath it on the page itself.
- Restrained type: one family, two or three sizes per screen, weight for emphasis.
- Quiet controls. Chips, tabs and fields are plain until selected.

### What makes it Musoko

Without these it is a clone with a different logo.

- **The farmer is on every tile.** The farm's name and town sit directly under the product name, at the same visual weight as the price. On a delivery app the seller is a logo; here it is a person and a place.
- **Place is the organising idea.** Shelves are titled by community ("Available now near Helena-West Helena"), not by cuisine or promotion.
- **Honest freshness.** "Available now · confirmed 3 days ago", "Coming in June", "About 20 lb". No delivery app says these things, and they are the brief's own requirements turned into the product's voice.
- **Seasons.** A "coming soon" shelf by expected month, and seasonal language in headings.
- **Photographs of land and hands**, not of plated food or packaged goods. Soil is allowed in the picture.
- **The sprout.** The two-leaf mark from the logo is the one decorative motif: as the available-now mark, as the map pin for farms, as the loading indicator. Used small and rarely.
- **Yellow as the harvest colour.** It is half of the identity: one whole theme is yellow. Rules in section 3.
- **Plain, neighbourly words.** "Contact farmer", "Pick up Saturday at the Cherry Street market", "The farmer will reply when they can".

### What we take from DoorDash

- Search and location first. The search field and community selector are the top of the homepage and stay reachable in the header on every browse screen.
- A horizontal category rail that scrolls sideways on phones: vegetables, fruits, herbs, eggs, and so on, as photographs or simple marks with a word under each.
- Photo-led tiles in tight, scannable grids and side-scrolling shelves ("Available now near Helena-West Helena", "Farmers near you").
- One brand colour doing the work, a heavy friendly sans, generous tap targets, rounded photo corners.
- Speed: skeletons that match the layout, instant filter feedback, sticky filter bar.
- Dense meta lines under each tile, where DoorDash would put rating and delivery time, we put price with unit price, availability, and pickup place and day.

### What we do not take

The brief forbids Musoko looking or reading like a grocery delivery app (Section 2, Positioning). So no cart, no bag icon, no "add" or plus buttons on tiles, no delivery-time or fee chips, no star ratings, no promo banners, no "order" wording. The action on a tile is "Contact farmer". The farmer, not the product, is the hero of a profile page.

For further reference on Pinterest or Dribbble: "food marketplace app", "farm brand identity", "bold two colour brand", "produce photography". Take layout and rhythm from them, never the commerce furniture.

## 2. Banned

These are the marks of generated design. None of them ship.

- A coloured stripe on the top or left edge of a card. No accent borders of any kind as decoration.
- Teal, purple-to-blue gradients, gradient text, glowing blobs, mesh backgrounds, glassmorphism.
- A row of three or four identical cards each with an icon in a tinted circle.
- One large radius applied to everything without thought. Radius follows the scale in section 7.
- Soft grey drop shadows under everything.
- Emoji as icons. Icons beside every heading and every list item.
- Centered hero with a badge above the headline, two buttons below and a fake browser screenshot.
- Illustrations of faceless people, 3D shapes, isometric scenes.
- Stock photos of people in suits, staged handshakes, produce on a pure white background.
- Placeholder grey boxes where a photograph should be.
- Section headings that are a small uppercase label, then a big heading, then a grey subtitle, repeated down the page.
- Anything that reads as a grocery delivery app: cart icons, "add" buttons on cards, delivery-time chips, star ratings.

## 3. Colour: a yellow theme and a green theme

Decided by the owner on 2026-11-15: one theme is yellow, the other is green. They are the same design with the logo's two colours swapped.

```css
:root {
  --c-yellow: #f2b415;  /* logo leaf yellow, by eye */
  --c-green:  #0b4a12;  /* logo M green, by eye */
  --c-leaf:   #3a8a14;  /* logo leaf green: small marks only */
}
[data-theme='yellow'] { --ground: var(--c-yellow); --ink: var(--c-green); }
[data-theme='green']  { --ground: var(--c-green);  --ink: var(--c-yellow); }
```

The theme names in code are `yellow` and `green`, not light and dark. First visit: `yellow`, or `green` when the system prefers dark.

What this pairing forces:

- **Contrast.** Green and yellow are roughly 5.4:1 against each other with these values. That passes AA for body text and not AAA. So small text is always full `--ink`. Muted tones are for large type, rules and decoration only. A unit test over the token file checks every text pairing reaches 4.5:1; if the exact logo values fall short, deepen the green used for text and keep the logo green for the mark.
- **Minimal on a saturated page.** The Uber Eats calm now comes from restraint, not from a white page: one ground colour, one ink, flat tiles, generous space, nothing else coloured. No white panels. Where content needs to sit apart (forms, dashboards, sheets) it uses `--ground-raised`, a slight shift of the ground itself.
- **Photographs** are the only other colour on the page. They carry 12px corners and enough margin that produce does not fight the ground. Avoid images dominated by yellow on the yellow theme's hero.
- **The logo needs two lockups.** On yellow the yellow leaf vanishes; on green the M and green leaf vanish. Yellow theme: green M, leaf-green leaf, second leaf in deep green outline or cream. Green theme: yellow M, yellow leaf, second leaf in leaf green. Until the vector file arrives the header uses a one-colour mark in `--ink`.

Everything else is derived:

```css
--ink-strong:   var(--ink);
--ink-muted:    color-mix(in oklab, var(--ink) 80%, var(--ground));
--ink-faint:    color-mix(in oklab, var(--ink) 45%, var(--ground));
--rule:         color-mix(in oklab, var(--ink) 18%, var(--ground));
--ground-raised: color-mix(in oklab, var(--ink) 6%, var(--ground));
--ground-sunk:   color-mix(in oklab, var(--ink) 10%, var(--ground));
```

Rules:

- `tokens.css` is the only file that contains a colour value. Components use tokens. A lint rule rejects hex and `rgb()` elsewhere.
- **Section tones.** A section declares `tone="ground"` or `tone="inverse"`. Inverse swaps ground and ink locally: a yellow page with one full-bleed green section, and the reverse in the green theme. At most one or two inverse sections per page.
- The primary button is solid ink with ground-coloured text. Secondary actions are outlined in ink or plain text links. Leaf green is for small marks only. No colour is ever a border on a card.
- Status is never carried by colour alone. "Available now", "Coming soon" and "Availability unconfirmed" are words, with a small filled, half-filled or hollow mark beside them.
- Photographs carry the rest of the colour. That is why the interface can stay at two.

## 4. Theme switch: the page peel

Switching theme turns the page. The new theme is revealed along a diagonal, as if the sheet were lifted by its top-right corner and drawn down to the bottom-left. Switching back runs the same motion in reverse: the sheet is laid back from bottom-left up to top-right.

Implementation, in `design-system/theme/`:

1. `ThemeToggle` calls `document.startViewTransition(() => applyTheme(next))` and sets `data-peel="forward"` or `data-peel="back"` on the root for the duration.
2. **Forward** (yellow to green): the new snapshot sits on top and is clipped to a growing triangle anchored at the top-right corner.

   ```css
   ::view-transition-new(root) {
     animation: peel-in 720ms cubic-bezier(0.7, 0, 0.2, 1) both;
   }
   @keyframes peel-in {
     from { clip-path: polygon(100% 0, 100% 0, 100% 0); }
     to   { clip-path: polygon(-100% 0, 100% 0, 100% 200%); }
   }
   ```

3. **Back** (green to yellow): the old snapshot sits on top and its triangle shrinks back into the top-right corner, so the motion is a true reverse and not a second forward wipe.
4. **The curl.** A fixed pseudo-element lies along the moving diagonal edge and travels with it: a narrow band with a highlight on the leading side and a soft shadow on the trailing side. This is what makes it read as paper and not as a wipe. Keep it narrow and quiet.
5. `::view-transition-old(root)` and `::view-transition-new(root)` both get `mix-blend-mode: normal` and no default cross-fade.
6. `prefers-reduced-motion: reduce` → no animation, the theme changes at once.
7. Browsers without the View Transitions API → the theme changes at once. Nothing breaks.
8. The choice is stored in `localStorage` and applied by an inline script in `<head>` before first paint, so there is no flash. First visit follows the system setting.

The toggle itself is drawn as a page corner with a small dog-ear, in the top-right of the header. It has a text label for screen readers and a visible focus ring.

## 5. Demo watermark

The word **DEMO DATA** is set very large in the display face and fixed to the viewport, as if printed on the desk under the page. Content scrolls over it. It is faint, and its colour follows whatever section is passing over it.

How it reacts to each section: every page section is a `<Section tone>` primitive. `Section` has `clip-path: inset(0)` and renders its own copy of the watermark as a `position: fixed` child behind its content. The clip means each copy shows only inside its own section, and each copy takes its colour from that section's `--ink` at roughly 5 to 7 percent. Cross a boundary between a yellow section and a green section and the letters change ink exactly at the edge. No blend modes, so photographs and cards are never tinted. Cards, photos and text sit above the watermark and cover it.

- All copies are `aria-hidden`. They are decoration.
- The watermark is slightly rotated and repeats on tall viewports so some of it is always in view.
- Respect `prefers-reduced-motion`: it is static anyway, so nothing to disable.

**The watermark does not replace the labelling the brief requires.** A faint background can be fully covered by content, and screen readers cannot see it. So two quiet pieces stay:

- **Demo strip.** A slim fixed line at the bottom edge of every page: "Demonstration data. Farms, prices and availability are fictional." with the role switcher and "Reset demo data". One line, small type, ground-sunk background, no icon. It is real text, so it is the accessible statement of demo mode. This satisfies the persistent-banner criterion.
- **Demo mark.** Every farm, product and market shows the word "Demo" as a small typographic tag in the card's meta line, set in the same style as the other meta text and separated by a middle dot. It is not a coloured pill and not a corner ribbon.

## 6. Typography

One family, chosen to sit beside the logo's heavy geometric M:

- **Hanken Grotesk**, variable. Weight 800 for display (headlines, shelf titles, prices on profile pages, the watermark), 400 and 600 for text. Plain, wide apertures, good at small sizes on poor screens. One font file keeps the page light.
- Prices and quantities use tabular figures.
- The owner may swap the family once the wordmark exists. Keep the font behind the `--font-display` and `--font-text` tokens.

Rules:

- Base size 17px on phones, 18px from tablet up. Line height 1.55 for text, 1.05 for display.
- Display sizes are fluid with `clamp()` and get genuinely large on the homepage and profile headers.
- Sentence case everywhere. No all-caps labels except the single word in the watermark.
- Maximum text measure 65 characters.
- Plain language. Short sentences. A choice is always preferred to a typed answer.

## 7. Layout and shape

- Mobile first. Design every screen at 360px wide before anything else.
- A 4px spacing scale. Sections breathe: large vertical gaps, tight groups inside them.
- Shelves and grids. Side-scrolling shelves on phones for "available now", farmers and markets; a tight grid for full results. A grid may carry one larger feature tile to break the rhythm.
- Corner radius scale: 12px on photographs and panels, 8px on fields and chips, fully rounded on the primary button and the search field. Three values, each with one job.
- Separation by rules and space, in that order. A hairline in `--rule` does most of the work. Shadows are reserved for things that truly float: dialogs, sheets, the map preview.
- Touch targets at least 48px. Primary actions sit within thumb reach on phones.
- One dominant action per screen. On the homepage it is "Find local food". "Explore farmers" and "Join as a farmer" are plain text links.

## 8. Components, in the Musoko way

- **Product card.** The photograph is most of the card. Below it, in order: product name, farmer and town, listed price and unit with the unit price beside it where reliable ("$15 for a 5 lb box · $3.00 per lb"), availability words with their mark, where and when to pick up, then the meta line with last updated and Demo. No border, no shadow, no background of its own: the text sits on the page. The whole card is one link, with a separate "Contact farmer" action.
- **Farmer card.** A landscape photograph of the land or the produce, the farm name set over its lower edge in display type, town beneath. "Listed" in the meta line.
- **Claims.** A plain list. Each line is the claim, then "farmer-reported" or "verified 12 Oct 2026" in muted text. No shield icons, no green ticks.
- **Category rail.** A sideways-scrolling row of categories under the search field, each a small photograph or simple mark with one word. The selected one is underlined in ink.
- **Filters.** A sticky row of chips under the rail, opening a sheet on phones. Chips have a hairline and fill with ink when selected.
- **Forms.** Labels above fields, always visible. Large fields. Presets as buttons before any free-text input. Errors in words beside the field.
- **Inquiry flow.** Three steps at most, each one screen on a phone, with the transaction statement visible on every step.
- **Dashboards.** Figures as large numerals with a short plain label, set on a rule grid like a ledger. No doughnut charts. If a chart is needed, it is a simple bar or line in ink. "Not enough data" is a written sentence in the same place the figure would be.
- **Empty states.** A sentence and one action. No illustration.

## 9. Motion

- Motion explains change: a sheet rising, a filter result settling, the page peel. It never decorates.
- Durations 150 to 250ms for interface feedback. The peel is the one long gesture.
- Photographs fade up from their blurred placeholder. Nothing bounces. Nothing parallaxes.
- Everything respects `prefers-reduced-motion`.

## 10. Imagery

Real photographs, sourced with the `source-imagery` skill.

- Sources: Unsplash, Pexels and public-domain collections. Record source, author and licence for every file in `src/content/image-credits.ts`.
- **No identifiable faces attached to a demo farm.** The brief forbids presenting a real person as a fictional farmer. Farm and farmer imagery shows hands, backs, boots, rows, fields, barns, crates, trucks. A face may appear only in general editorial imagery that is not tied to any named profile, and even there prefer not to.
- The look: natural light, soil and leaf visible, imperfect produce, Southern lowland landscape where possible (flat fields, big sky, cypress, row crops). No studio isolation, no heavy filters, no oversaturated green.
- One consistent grade across the set: slightly warm, slightly lowered contrast, so images from different photographers sit together.
- Every image has alt text that describes what is in it.
- Delivered as AVIF with a WebP fallback, at three widths, lazy-loaded below the fold. Hero under about 120 KB on phones.

## 11. Accessibility

- Keyboard reachable in a sensible order, with a visible focus ring in ink, 2px, offset.
- Every form field has a label. Every icon-only control has a name.
- Contrast as in section 3, checked in both themes and inside inverse sections.
- The map always has an equivalent list.
- Tested with axe in the end-to-end suite.

## 12. Open, waiting on the owner

- The logo as a vector file (SVG) in `public/brand/`, so exact colour values can be read from it.
- Agreement on the two logo lockups described in section 3, or an alternative.
- A wordmark, if one is planned, and whether it changes the typeface.
