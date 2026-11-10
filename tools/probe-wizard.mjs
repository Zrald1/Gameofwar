export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.Anchors)).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const wiz = A.Anchors.get('wizard');
    if (!wiz) return { error: 'no wizard anchor', keys: [...A.Anchors.keys()] };
    const playingVis = wiz.visible; // game is 'playing' -> should be false
    A.G.phase = 'race';
    await new Promise((r) => setTimeout(r, 400));
    const raceVis = wiz.visible; // -> should be true
    A.G.phase = 'playing';
    await new Promise((r) => setTimeout(r, 400));
    return {
      playingVis, raceVis,
      restoredVis: wiz.visible,
      parts: (() => { let n = 0; wiz.traverse((o) => { if (o.isMesh) n++; }); return n; })(),
      wizardLines: A.G.feed.filter((l) => l.includes('Wizard')).slice(-3),
    };
  });
}
