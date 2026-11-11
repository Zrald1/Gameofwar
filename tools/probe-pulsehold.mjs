export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate((mode) => {
    const A = window.__atlas;
    if (mode === 'start') {
      A.emit('wizardLine', 'The Wizard: the Fold listens, traveler.');
      window.__wizTimer = setInterval(() => A.emit('wizardLine', 'The Wizard: the Fold listens, traveler.'), 700);
      return { armed: true };
    }
    clearInterval(window.__wizTimer);
    window.__wizTimer = null;
    return { disarmed: true };
  }, process.env.MODE ?? 'start');
}
