export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    A.G.phase = 'playing';
    A.G.race = A.G.race || 'Elf';
    A.G.terrainDirty = true;
    await new Promise((r) => setTimeout(r, 300));
    if (A.G.mode !== 'adv') A.emit('advToggle');
    await new Promise((r) => setTimeout(r, 500));
    return { mode: A.G.mode, rig: A.world.player.position.toArray(), ci: A.G.ci, cj: A.G.cj };
  });
}
