// Finds free-licence candidate photographs on Wikimedia Commons and builds
// contact sheets for a human (or agent) to look at before anything is used.
// Usage: node scripts/images/commons-candidates.mjs <outDir> [queries.json]
// See .claude/skills/source-imagery/SKILL.md.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import net from 'node:net';
import sharp from 'sharp';

net.setDefaultAutoSelectFamilyAttemptTimeout(8000);

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (res.ok) return res;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

const UA = 'image-candidate-script/0.1 (local development tool)';
const OK_LICENCE = /^(cc0|public domain|pd|cc by(-sa)? [1-4]\.0)/i;
const PER_QUERY = 4;

const outDir = process.argv[2];
const queries = JSON.parse(await readFile(process.argv[3], 'utf8'));
await mkdir(outDir, { recursive: true });

async function search(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '30',
    gsrsearch: `${query} filetype:bitmap filemime:image/jpeg`,
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1280',
  });
  const res = await get(url);
  if (!res) return [];
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages
    .map((p) => {
      const ii = p.imageinfo?.[0];
      const meta = ii?.extmetadata ?? {};
      const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return {
        title: p.title, page: ii?.descriptionurl, thumb: ii?.thumburl, width: ii?.width, height: ii?.height,
        licence: strip(meta.LicenseShortName?.value), author: strip(meta.Artist?.value).slice(0, 80),
      };
    })
    .filter((c) => c.thumb && c.width >= 1200 && c.width / c.height >= 1.15 && c.width / c.height <= 1.9 && OK_LICENCE.test(c.licence));
}

const manifest = {};
for (const [key, query] of Object.entries(queries)) {
  const found = (await search(query)).slice(0, PER_QUERY);
  manifest[key] = [];
  const tiles = [];
  for (const [i, c] of found.entries()) {
    try {
      const res = await get(c.thumb);
      if (!res) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const file = join(outDir, `${key}-${i}.jpg`);
      await writeFile(file, buf);
      manifest[key].push({ ...c, file, i });
      tiles.push(await sharp(buf).resize(300, 225, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer());
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  manifest[key].tiles = undefined;
  manifest[key]._tiles = tiles;
  console.log(key, found.length);
}

// Contact sheets: one row per key, 4 tiles, 8 keys per sheet.
const keys = Object.keys(manifest);
for (let s = 0; s * 8 < keys.length; s++) {
  const rows = keys.slice(s * 8, s * 8 + 8);
  const composite = [];
  rows.forEach((key, r) => manifest[key]._tiles.forEach((input, c) => composite.push({ input, left: c * 304, top: r * 229 })));
  await sharp({ create: { width: 4 * 304, height: rows.length * 229, channels: 3, background: '#888' } })
    .composite(composite).jpeg({ quality: 72 }).toFile(join(outDir, `sheet-${s}.jpg`));
  console.log(`sheet-${s}:`, rows.join(', '));
}
for (const key of keys) {
  delete manifest[key]._tiles;
  delete manifest[key].tiles;
}
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
