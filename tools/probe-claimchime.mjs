export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  const count = () => app.evaluate(() => window.__atlas.world.entityManager.entityIndex);
  const c0 = await count();
  await app.evaluate(() => {
    const A = window.__atlas;
    A.emit('weaponClaim', 'Rare');
    A.emit('weaponClaim', 'Mythic');
  });
  await new Promise(res => setTimeout(res, 300));
  const c1 = await count();
  return { before: c0, after: c1, delta: c1 - c0 };
}
