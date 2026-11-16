---
name: source-imagery
description: Find, download, grade, compress and credit free-licence photographs for Musoko (produce, farms, fields, market stalls, textures). Use whenever a screen needs a photograph that is not yet in public/images, or when replacing or auditing imagery.
---

# Source imagery

Musoko runs on real photographs. This is how one gets into the project.

## What to look for

- **Produce:** in crates, on soil, in hands, on a truck bed, on worn wood. Imperfect and recently picked. Not isolated on white, not styled for a recipe site.
- **Farms:** rows, fields, hoop houses, barns, tools, irrigation, flat lowland with a big sky. The Arkansas Delta is level row-crop country with cypress and bayous. Avoid mountains, vineyards, terraces and anything plainly from another climate.
- **People:** hands, forearms, backs, boots, silhouettes. **No identifiable face in any image attached to a demo farm, farmer or market.** The brief forbids presenting a real person as a fictional farmer. When unsure whether someone is identifiable, do not use the image.
- **Markets:** stalls, crates, scales, chalk signs, awnings. Crowds only from behind or out of focus.
- **Texture:** paper grain, soil, linen, weathered wood, for backgrounds at very low contrast.

Natural light. No heavy filters. No visible logos, brand names, vehicle plates or real farm signage.

## Where to look

Use sources whose licence allows free commercial use without permission:

- Unsplash (Unsplash Licence)
- Pexels (Pexels Licence)
- Public-domain collections, such as US government agricultural photography

Read the licence on the image's own page. Skip anything marked editorial use only, anything from a paid tier, and anything where the licence is unclear. Do not take images from Pinterest, Dribbble, Google Images or a farm's own website; those are for inspiration only.

## Steps

1. From the design director's spec, write down what each image must show, its orientation and its crop ratio.
2. Search, and pick two or three candidates for each. Prefer photographers whose other work also fits, so the set holds together.
3. Download the original into the scratchpad directory, not into the project.
4. Look at each candidate before using it. Check for faces, logos, signage and plates.
5. Process with `sharp` (a script in `scripts/images/`):
   - Crop to the ratio in the spec.
   - Apply the house grade: slightly warm, contrast slightly lowered, saturation slightly lowered, the same settings for every image.
   - Export AVIF and WebP at 480, 960 and 1600 wide. Strip metadata.
   - Targets: hero under about 120 KB at 960 wide, card images under about 40 KB at 480 wide.
6. Save to `public/images/<produce|farms|markets|texture>/<what-it-shows>-<nn>.<ext>`, named for the subject, for example `collard-greens-crate-01.avif`.
7. Add an entry to `src/content/image-credits.ts`: file, source site, page URL, photographer, licence, date fetched, and the alt text.
8. Write alt text that says what is in the picture in one plain sentence. Not "image of", not the farm's name.

## Rules

- One product photograph may serve several listings of the same product type, but two cards that can appear side by side should not share an image.
- An image shown on a demo farm's profile must not come from a page that names a real farm.
- If a suitable image cannot be found, say so and describe what is missing. Do not substitute a generated image or a grey box without the owner agreeing.
- Keep the credits file complete. An image with no credit entry does not ship.
