export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    A.G.houses = 3;
    A.G.terrainDirty = true;
    return { houses: A.G.houses, haven: [A.G.havenI, A.G.havenJ], pos: [A.G.ci, A.G.cj] };
  });
}
