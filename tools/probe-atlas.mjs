export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas, w = A.world;
    const keys = Object.keys(w).filter(k => /entit|ecs|query|audio|scene/i.test(k));
    const ecsLike = {};
    for (const k of keys) { try { ecsLike[k] = typeof w[k]; } catch {} }
    return { akeys: Object.keys(A), keys, ecsLike,
      entSize: w.entities?.size, sceneChildren: w.scene?.children?.length };
  });
}
