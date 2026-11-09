// Commission the guild end-to-end: engineer plans, laborer builds, map loads.
export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(async () => {
    const A = window.__atlas;
    if (!A) return { error: 'no bridge' };
    const before = A.G.mapName;
    await A.commissionTheGuild('a frozen reach with deep forest');
    await new Promise((r) => setTimeout(r, 400));
    const m = A.G.map;
    return {
      before,
      after: A.G.mapName,
      dims: m ? `${m.w}x${m.h}` : null,
      digs: A.G.digs.length,
      ci: A.G.ci, cj: A.G.cj,
      haven: [A.G.havenI, A.G.havenJ],
      feed0: A.G.feed[0],
      feed1: A.G.feed[1],
      feed2: A.G.feed[2],
    };
  });
}
