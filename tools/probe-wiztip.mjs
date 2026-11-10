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
    const out = { visDuringPlay: wiz?.visible ?? null, tips: [] };
    A.emit('gesturePress', 'wizard');
    await new Promise((r) => setTimeout(r, 300));
    out.tips.push(A.G.feed.find((l) => l.includes('Wizard')) ?? 'NONE');
    A.emit('npcSummon');
    await new Promise((r) => setTimeout(r, 200));
    A.emit('gesturePress', 'wizard');
    await new Promise((r) => setTimeout(r, 300));
    out.tips.push(A.G.feed.find((l) => l.includes('Wizard')) ?? 'NONE');
    return out;
  });
}
