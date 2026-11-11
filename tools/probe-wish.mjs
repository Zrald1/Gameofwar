export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    if (A.G.mode !== 'adv') A.emit('advEnter');
    const w = (A.Anchors ?? window.__Anchors)?.get?.('wish');
    const v = new A.world.camera.position.constructor();
    w?.getWorldPosition(v);
    return { pos: [A.G.ci, A.G.cj], wish: [A.G.wishI, A.G.wishJ], wpos: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)], vis: w?.visible };
  });
}
