export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  await app.evaluate(() => {
    const A = window.__atlas;
    const d = A.G.lootDrops.find((x) => x.relic);
    if (d) { A.G.ci = d.i; A.G.cj = d.j; }
  });
  await new Promise((r) => setTimeout(r, 600));
  return await app.evaluate(() => {
    const A = window.__atlas;
    return { drops: A.G.lootDrops.length, relics: A.G.relics, feed: A.G.feed.slice(0, 3) };
  });
}
