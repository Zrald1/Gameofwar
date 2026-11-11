export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const dist = (a,b,c,d) => Math.max(Math.abs(a-c), Math.abs(b-d));
    return {
      ci: A.G.ci, cj: A.G.cj,
      digs: A.G.digs.map((d) => ({ i: d.i, j: d.j, dist: dist(A.G.ci, A.G.cj, d.i, d.j), questId: d.questId })),
      feed: A.G.feed.slice(0, 8),
    };
  });
}
