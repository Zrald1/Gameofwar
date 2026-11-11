export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    A.G.feed.unshift('The Guild engineer unrolls a blank survey...');
    A.G.feed.unshift('Listening... speak to the patron.');
    A.G.feed.unshift('Careful work, wanderer. Nothing here will get you killed... probably.');
    A.G.hudDirty = true;
    await new Promise((r) => setTimeout(r, 900));
    return { head: A.G.feed.slice(0, 3) };
  });
}
