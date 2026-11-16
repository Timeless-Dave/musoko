---
name: musoko-design
description: Musoko's visual taste and UI rules. Load before creating or changing any component, page, style, token, image or animation in this project, and when reviewing how a screen looks.
---

# Musoko design

The full system is in docs/DESIGN.md. Read it once per session before UI work. This is the working checklist.

## The idea

The owner's direction: the intuitive marketplace experience of DoorDash, the clean minimalism of Uber Eats, and an identity of Musoko's own, centred on local farmers, fresh food and community. A person opens it and finds what they need in seconds.

- **Structure from DoorDash:** search and location first, a category rail, photo shelves titled by community, tight grids, sticky filters, dense meta lines.
- **Look from Uber Eats:** calm through restraint (one ground, one ink), lots of space, flat tiles with no border or shadow, one type family, very little colour.
- **Identity from neither:** the farm's name and town on every tile at the weight of the price, honest freshness wording, seasons, photographs of land and hands, the sprout from the logo as the one motif, yellow as the harvest highlight, neighbourly words.
- **Never their commerce furniture:** the brief forbids anything that reads as a grocery delivery app.

### The seconds test

On a phone: search and community selector visible without scrolling; real food with price and pickup place visible at once or after one short scroll; a product's price and pickup details within two taps of the homepage, the inquiry form within three; no screen opens on an explanation or a sign-up prompt.

Every buyer-facing screen answers, within seconds: what fresh food is near me, how much does it cost, where and when can I get it.

## Before you write a component

1. Is there already a primitive or pattern in `src/design-system` that does this? Use it.
2. What is the one dominant action on this screen?
3. What is the one thing that makes this screen Musoko's and not a template?
4. What does it look like at 360px wide?

## Colour

- Two tokens carry the design: `--ground` and `--ink`. Light and dark themes are the same design with the two swapped.
- Two themes, named `yellow` and `green`: logo green on logo yellow, and the swap. No white panels; content that must sit apart uses `--ground-raised`.
- Every other tone is a `color-mix` of ground and ink, defined in `src/design-system/tokens/tokens.css`. That is the only file with colour values. The values were read from the logo by eye and will be corrected from the vector file, so a hardcoded colour anywhere else will be wrong later.
- The pair is only about 5.4:1. Small text is always full `--ink`; muted tones are for large type and rules.
- `tone="inverse"` on a `Section` swaps the pair locally. One or two per page at most.
- Status is words plus a mark, never colour alone.

## Never

- A coloured stripe or accent border on any edge of a card.
- Teal. Gradients, gradient text, glows, blobs, glass.
- Rows of identical cards with an icon in a tinted circle.
- One radius applied to everything, soft shadows under everything.
- Emoji as icons, or an icon beside every heading.
- Illustrations of people, 3D shapes, isometric art.
- Grey placeholder boxes in place of photographs.
- Small-uppercase-label, big heading, grey subtitle, repeated for every section.
- Carts, "add" buttons, delivery-time chips, star ratings.
- A "Verified farmer" badge, shield icons or green ticks beside claims.

## Always

- `Section` for every page section, so the demo watermark and tone work.
- The Demo mark in the meta line of every farm, product and market.
- Radius: 12px on photographs and panels, 8px on fields and chips, fully rounded on the primary button and search field. Hairline rules and space before shadows.
- Sentence case. Plain words. A choice before a typed answer.
- Labels above fields, always visible.
- Touch targets 48px or more. Visible focus ring.
- Real photographs through `next/image` with alt text. No identifiable faces tied to a demo farm.
- Motion only to explain a change, 150 to 250ms, off under reduced motion.
- Check both themes, and switch between them to watch the peel.

## Signature pieces, do not reinvent

- **Theme peel:** `src/design-system/theme/`. DESIGN.md section 4.
- **Demo watermark and strip:** `src/features/demo/` and the `Section` primitive. DESIGN.md section 5.
- **Product card anatomy:** DESIGN.md section 8.

## Self-review before handing over

Look at the screen and ask: if the logo were removed, would someone know this was not a generated template? If not, find what is generic and change it. Then walk the Never list once more against what you built.
