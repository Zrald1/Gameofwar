export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const panel = A.world.getSceneObject('hud-panel');
    const el = panel?.getElementById('stat-skills');
    return { text: el?.props?.text ?? el?.text ?? '(unreadable)' };
  });
}
