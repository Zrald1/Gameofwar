export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (A.G.mode !== 'adv') A.emit('advEnter');
    // spill a test blade 3 tiles east of the player
    A.G.lootDrops.push({ i: A.G.ci + 3, j: A.G.cj, w: { name: 'Starfall Blade', rarity: 'Legendary', power: 120, origin: 'probe' } });
    return { pos: [A.G.ci, A.G.cj], drops: A.G.lootDrops.length, inv: A.G.inventory.length };
  });
}
