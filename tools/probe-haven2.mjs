export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    // Return-Home behavior: recenter the window on the haven tile
    A.G.centerI = A.G.havenI;
    A.G.centerJ = A.G.havenJ;
    A.G.gold = 500; // tryBuild needs gold to prove the full chain
    A.G.terrainDirty = true;
    await new Promise((r) => setTimeout(r, 400));
    const h = A.Anchors.get('haven-marker');
    const v = new h.position.constructor();
    h.getWorldPosition(v);
    return {
      visible: h.visible,
      local: [+h.position.x.toFixed(3), +h.position.y.toFixed(3), +h.position.z.toFixed(3)],
      world: [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)],
      houses: A.G.houses,
    };
  });
}
