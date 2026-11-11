export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const em = window.__atlas.world.entityManager;
    const info = {};
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(em)).concat(Object.keys(em))) {
      try { const v = em[k]; info[k] = v instanceof Map ? `Map(${v.size})` : v instanceof Set ? `Set(${v.size})` : Array.isArray(v) ? `Array(${v.length})` : typeof v; } catch (e) { info[k] = 'err'; }
    }
    return info;
  });
}
