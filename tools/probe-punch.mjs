export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    return {
      feedHead: A.G.feed.slice(0, 6),
      wizardPos: (() => { const w = A.Anchors.get('wizard'); if (!w) return null; const v = w.position.clone().set(0, 0, 0); w.getWorldPosition(v); return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) }; })(),
      activeDig: A.G.activeDigId,
      editing: A.G.editing,
    };
  });
}
