export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    A.G.phase = 'playing';
    A.G.editing = false;
    localStorage.setItem('atlas-tut-v1', '1');
    // arm a spy so we can see the exact press key that fires during the punch
    const presses = [];
    const origEmit = A.emit;
    A.emit = (ev, d) => { if (ev === 'gesturePress') presses.push(d); return origEmit(ev, d); };
    window.__pressSpy = presses;
    return { phase: A.G.phase, wizardVisible: !!A.Anchors.get('wizard')?.visible };
  });
}
