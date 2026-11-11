/** probe-advrig: does the locomotion capsule ride the scaled terrain? */
export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    A.G.phase = 'playing';
    A.G.terrainDirty = true;
    await sleep(300);
    const out = { rigBefore: A.world.player.position.toArray().map((x) => +x.toFixed(3)) };
    A.emit('advToggle');
    await sleep(600);
    out.rigAfterEnter = A.world.player.position.toArray().map((x) => +x.toFixed(3));
    // expected terrain top under the rig: table pos + 20 * tile-top local
    const table = A.Anchors.get('table');
    const lx = (A.world.player.position.x - table.position.x) / 20;
    const lz = (A.world.player.position.z - table.position.z) / 20;
    out.slotLocal = [+lx.toFixed(3), +lz.toFixed(3)];
    out.tileUnder = { ci: A.G.ci, cj: A.G.cj };
    A.emit('advToggle');
    await sleep(300);
    out.rigAfterExit = A.world.player.position.toArray().map((x) => +x.toFixed(3));
    return out;
  });
}
