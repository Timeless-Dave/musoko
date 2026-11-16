/**
 * Measures first-load page weight against a running production server.
 *
 *   pnpm build
 *   pnpm start -p 3200 &
 *   node tests/weight-prod.mjs
 *
 * Reports transferred bytes (what the network actually sends, compressed) and
 * decoded bytes per page, with the ten heaviest requests. The brief's target
 * (ACCEPTANCE A11Y-3) is roughly 1 MB for the first mobile page load.
 */
import { chromium, devices } from '@playwright/test';

const paths = ['/', '/food'];
const browser = await chromium.launch();
for (const path of paths) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  let transferred = 0;
  let decoded = 0;
  const seen = new Set();
  const items = [];
  page.on('requestfinished', async (req) => {
    try {
      const sizes = await req.sizes();
      const t = (sizes.responseBodySize ?? 0) + (sizes.responseHeadersSize ?? 0);
      transferred += t;
      const res = await req.response();
      let bodyLen = 0;
      if (res) {
        const body = await res.body().catch(() => null);
        if (body) { decoded += body.length; bodyLen = body.length; }
      }
      items.push({ t, b: bodyLen, url: req.url(), type: req.resourceType() });
      seen.add(req.url());
    } catch {}
  });
  await page.goto('http://127.0.0.1:3200' + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  console.log(`${path}: transferred ${(transferred/1024).toFixed(1)} KB, decoded ${(decoded/1024).toFixed(1)} KB, ${seen.size} requests`);
  items.sort((a,b)=>b.b-a.b);
  console.log('  top 10 by decoded bytes:');
  for (const it of items.slice(0, 10)) {
    console.log(`    ${(it.b/1024).toFixed(1)} KB (xfer ${(it.t/1024).toFixed(1)}) [${it.type}] ${it.url.slice(0, 120)}`);
  }
  await page.close();
  await ctx.close();
}
await browser.close();
