export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const w = (A.Anchors ?? window.__Anchors)?.get?.('wish');
    const pat = (A.Anchors ?? window.__Anchors)?.get?.('patron');
    const v = new A.world.camera.position.constructor();
    pat?.getWorldPosition(v);
    return { mode: A.G.mode, phase: A.G.phase, wishVis: w?.visible,
      wishPos: w ? [+w.position.x.toFixed(2), +w.position.y.toFixed(2), +w.position.z.toFixed(2)] : null,
      patPos: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] };
  });
}
