export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(() => ({
        gesture: window.__atlas.gesture || null,
        feed: window.__atlas.G.feed.slice(-6),
      }));
    }
  }
  return { error: 'no bridge' };
}
