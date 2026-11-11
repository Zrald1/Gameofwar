export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(() => {
    const A = window.__atlas;
    const { Anchors, G } = A;
    const out = { mode: G.mode, npcs: {} };
    const V = A.world.scene.position.clone ? null : null;
    for (const key of ['patron', 'wizard', 'haven-marker', 'dig-x']) {
      const o = Anchors.get(key);
      if (!o) { out.npcs[key] = null; continue; }
      const p = new o.position.constructor();
      o.getWorldPosition(p);
      const s = new (o.scale.constructor)();
      o.getWorldScale(s);
      out.npcs[key] = { visible: o.visible, pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], wscale: +s.x.toFixed(1) };
    }
    const rig = A.world.player.position;
    out.rig = [+rig.x.toFixed(2), +rig.y.toFixed(2), +rig.z.toFixed(2)];
    return out;
  });
}
