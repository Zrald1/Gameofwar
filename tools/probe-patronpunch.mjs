export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(() => {
    const A = window.__atlas;
    A.G.phase = 'playing';
    const pos = (k) => { const o = A.Anchors.get(k); if (!o) return null; const v = o.position.clone().set(0, 0, 0); o.getWorldPosition(v); return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3), visible: !!o.visible }; };
    const p = pos('patron'), x = pos('dig-x'), w = pos('wizard');
    const d = (a, b) => a && b ? +Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z).toFixed(3) : null;
    return { patron: p, digx: x, wizard: w, patronToDigx: d(p, x), activeDig: A.G.activeDigId };
  });
}
