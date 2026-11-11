export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const wiz = A.Anchors.get('wizard');
    const star = wiz?.getObjectByName('wizard-star');
    if (!star) return { error: 'no star' };
    const scales = [];
    A.emit('wizardLine', 'The Wizard: test line');
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 90));
      scales.push(+star.scale.x.toFixed(2));
      if (star.scale.x <= 1 && scales.length > 4) break;
    }
    return { maxScale: Math.max(...scales), endedAt1: star.scale.x <= 1.01, samples: scales.length };
  });
}
