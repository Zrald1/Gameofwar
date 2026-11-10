export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!window.__atlas).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no __atlas' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const before = A.G.map?.name;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    await new Promise((r) => setTimeout(r, 1500));
    const after = A.G.map?.name;
    return { before, after, feed: A.G.feed.slice(-3) };
  });
}
