export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const table = A.Anchors.get('table');
    return {
      mode: A.G.mode, phase: A.G.phase,
      rig: A.world.player.position.toArray().map((x) => +x.toFixed(2)),
      tablePos: table.position.toArray().map((x) => +x.toFixed(2)),
      ci: A.G.ci, cj: A.G.cj, center: [A.G.centerI, A.G.centerJ],
      walk: A.G.effort.walk,
      feed0: A.G.feed[0],
    };
  });
}
