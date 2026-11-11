export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  const b64 = await app.evaluate(async () => {
    const A = window.__atlas;
    A.emit('wizardLine', 'The Wizard: the Fold listens, traveler.');
    await new Promise((r) => setTimeout(r, 420)); // mid-flare
    const c = document.querySelector('canvas');
    return c.toDataURL('image/png');
  });
  return { b64: b64.slice(0, 64), len: b64.length, png: b64 };
}
