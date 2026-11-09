// Navigate every app frame to ?map=<name> via in-frame location assignment.
export default async function run({ page }, args = {}) {
  const map = args.map ?? 'old-earth';
  const apps = page.frames().filter((f) => f.url().startsWith('https://localhost:8081'));
  const before = apps.map((f) => f.url());
  for (const f of apps) {
    try { await f.evaluate((m) => { location.href = `?map=${m}`; }, map); } catch (e) { /* frame may detach */ }
  }
  await page.waitForTimeout(5000);
  const after = page.frames().map((f) => f.url());
  return { map, before, after };
}
