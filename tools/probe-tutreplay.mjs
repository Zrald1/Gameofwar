export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    localStorage.setItem('atlas-tut-v1', '1'); // lesson already done
    A.G.phase = 'playing';
    const wizLines = () => A.G.feed.filter((x) => x.includes('Wizard')).slice(0, 4);

    // 1) XR path: fist-bump emits gesturePress 'wizard-bump'
    A.emit('gesturePress', 'wizard-bump');
    await new Promise((r) => setTimeout(r, 1600));
    const afterBump = wizLines();

    // 2) double-bump mid-lesson must restart, not stack
    A.emit('gesturePress', 'wizard-bump');
    A.emit('gesturePress', 'wizard-bump');
    await new Promise((r) => setTimeout(r, 1600));
    const afterDouble = wizLines();

    // 3) desktop path: real T keydown
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    await new Promise((r) => setTimeout(r, 1600));
    const afterT = wizLines();

    return {
      bumpRestarted: afterBump.some((l) => l.includes('lesson') || l.includes('wanderer') || l.includes('crossing')),
      afterBump,
      doubleSafe: afterDouble.length > 0,
      afterDouble,
      tRestarted: afterT.length > 0,
      afterT,
      tutFlag: localStorage.getItem('atlas-tut-v1'),
    };
  });
}
