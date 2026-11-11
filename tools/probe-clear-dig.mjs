export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(() => {
    const A = window.__atlas;
    A.G.activeDigId = -1;
    const x = A.Anchors.get('dig-x');
    if (x) x.visible = false;
    return { activeDig: A.G.activeDigId, digxVisible: !!x?.visible };
  });
}
