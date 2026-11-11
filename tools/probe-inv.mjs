export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    return { inv: A.G.inventory.map((w) => `${w.name} +${w.power}p`), equipped: A.G.equipped, held: A.G.inventory[A.G.equipped]?.name };
  });
}
