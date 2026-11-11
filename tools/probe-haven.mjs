export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    if (A.G.mode !== 'adv') A.emit('advEnter');
    A.G.houses = 3;
    A.G.relics = ['Starfall Relic'];
    A.G.havenI = A.G.ci + 4;
    A.G.havenJ = A.G.cj;
    A.G.terrainDirty = true;
    return { pos: [A.G.ci, A.G.cj], haven: [A.G.havenI, A.G.havenJ], houses: A.G.houses };
  });
}
