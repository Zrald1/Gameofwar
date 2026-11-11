// full-session adventure smoke: state, weapon, labels, camps, minimap
export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const t = A.Anchors.get('table');
    const patron = A.Anchors.get('patron'), wiz = A.Anchors.get('wizard');
    const campOf = (o) => { const c = o && o.getObjectByName('camp'); return c ? c.visible : null; };
    const rig = A.world.player.position;
    let minimap = false;
    A.world.camera.traverse((o) => { if (o.geometry && o.geometry.type === 'PlaneGeometry' && o.visible) minimap = true; });
    return {
      mode: A.G.mode, phase: A.G.phase, race: A.G.race,
      pos: [A.G.ci, A.G.cj], scale: +t.scale.x.toFixed(1),
      rigY: +rig.y.toFixed(2),
      weapon: A.G.equipped >= 0 ? A.G.inventory[A.G.equipped]?.name : null,
      patron: { d: Math.max(Math.abs(A.G.ci - A.G.patronI), Math.abs(A.G.cj - A.G.patronJ)), vis: patron?.visible, camp: campOf(patron) },
      wiz: { d: Math.max(Math.abs(A.G.ci - A.G.wizI), Math.abs(A.G.cj - A.G.wizJ)), vis: wiz?.visible, camp: campOf(wiz) },
      minimap, skills: A.G.skills.map((s) => s.name), feed: A.G.feed.slice(0, 2),
    };
  });
}
