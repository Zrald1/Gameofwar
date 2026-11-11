export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(() => {
    const A = window.__atlas;
    const h = A.Anchors.get('haven-marker');
    const w = h?.getWorldPosition ? (() => { const v = new h.position.constructor(); h.getWorldPosition(v); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; })() : null;
    return {
      phase: A.G.phase,
      havenVisible: h?.visible,
      havenPos: h ? [+h.position.x.toFixed(3), +h.position.y.toFixed(3), +h.position.z.toFixed(3)] : null,
      worldPos: w,
      gold: A.G.gold,
      houses: A.G.houses,
    };
  });
}
