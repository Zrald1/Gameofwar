export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    if (A.G.mode !== 'adv') A.emit('advEnter');
    // drop a blade at the player's tile -> instant claim next frame
    A.G.lootDrops.push({ i: A.G.ci, j: A.G.cj, w: { name: 'Emberbrand', rarity: 'Rare', power: 33, origin: 'probe' } });
    await sleep(300);
    const line1 = A.G.feed[0];
    A.G.lootDrops.push({ i: A.G.ci, j: A.G.cj, w: { name: 'Worldrender', rarity: 'Legendary', power: 150, origin: 'probe' } });
    await sleep(300);
    return { afterRare: line1, afterLeg: A.G.feed[0], drops: A.G.lootDrops.length, held: A.G.inventory[A.G.equipped]?.name };
  });
}
