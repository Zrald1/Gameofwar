export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const out = { drops: A.G.lootDrops.map((d) => ({ i: d.i, j: d.j, n: d.w.name })), ci: A.G.ci, cj: A.G.cj, groups: [] };
    A.world.scene.traverse((o) => {
      if (o.children.some((c) => c.type === 'Sprite' && c.position.y > 1.2 && c.position.y < 1.6) && o !== A.world.scene) {
        const p = new (o.position.constructor)();
        o.getWorldPosition(p);
        out.groups.push({ vis: o.visible, wp: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] });
      }
    });
    return out;
  });
}
