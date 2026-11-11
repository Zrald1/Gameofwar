export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const v = new window.__atlas.world.camera.position.constructor();
    const out = {};
    for (const k of ['haven','dig-x','patron','wizard']) {
      const a = (window.__Anchors ?? A.Anchors)?.get?.(k);
      if (!a) { out[k] = null; continue; }
      a.getWorldPosition(v);
      out[k] = { p: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)], vis: a.visible };
    }
    return { anchors: out, pos: [A.G.ci, A.G.cj], haven: [A.G.havenI, A.G.havenJ] };
  });
}
