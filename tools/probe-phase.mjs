export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    return { phase: A.G.phase, mode: A.G.mode, offer: A.G.offer, race: A.G.race, feed0: A.G.feed[0] };
  });
}
