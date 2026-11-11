export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    // wait out the 1.2s replay delay so step 0 can land
    await new Promise((r) => setTimeout(r, 1600));
    return {
      presses: window.__pressSpy ?? 'spy-missing',
      wizHead: A.G.feed.filter((x) => x.includes('Wizard')).slice(0, 3),
      gesture: A.gesture ?? null,
    };
  });
}
