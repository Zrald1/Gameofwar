export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.G)).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no app frame' };
  await app.evaluate(() => {
    const A = window.__atlas;
    A.G.phase = 'race'; // summon the wizard for the shot
  });
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true };
}
