export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const wizLines = (n = 4) => A.G.feed.filter((x) => x.includes('Wizard')).slice(0, n);

    // 1) fresh boot state: intro phase, wizard greeted
    const boot = { phase: A.G.phase, greeted: wizLines().length > 0 };

    // 2) simulate race pick -> playing
    A.G.phase = 'playing';
    A.emit('runStarted');

    // 3) wizard contextual tip still fires
    A.emit('gesturePress', 'wizard');
    await new Promise((r) => setTimeout(r, 300));
    const tipFired = wizLines().length > boot.greeted ? wizLines()[0] : null;

    // 4) T-key replay path still fires after gesture edits
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    await new Promise((r) => setTimeout(r, 1600));
    const after = wizLines();
    const tReplayed = after.some((l) => l.includes('crossing') || l.includes('wanderer'));

    return { boot, tipFired, tReplayed, after, tutFlag: localStorage.getItem('atlas-tut-v1') };
  });
}
