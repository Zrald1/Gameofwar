export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const d = (i,j) => Math.max(Math.abs(A.G.ci-i), Math.abs(A.G.cj-j));
    const o = { ci: A.G.ci, cj: A.G.cj, patron: {i:A.G.patronI,j:A.G.patronJ,d:d(A.G.patronI,A.G.patronJ)}, wiz: {i:A.G.wizI,j:A.G.wizJ,d:d(A.G.wizI,A.G.wizJ)} };
    o.patronVisible = A.Anchors.get('patron')?.visible;
    o.wizVisible = A.Anchors.get('wizard')?.visible;
    o.labels = A.world.scene.children.filter((c) => c.isSprite).map((s) => s.visible);
    return o;
  });
}
