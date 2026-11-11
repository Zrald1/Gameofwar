export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    A.emit('pickRace', 2); // Elf
    const w = A.G.equipped >= 0 ? A.G.inventory[A.G.equipped] : null;
    return { race: A.G.race, equipped: w, inv: A.G.inventory.map((x) => x.name), feed: A.G.feed.slice(0, 3) };
  });
}
