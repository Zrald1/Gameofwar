export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        A.emit('mapChange', 'verdant-reach');
        await new Promise((r) => setTimeout(r, 200));
        return { phase: A.G.phase, feed: A.G.feed.slice(0, 2) };
      });
    }
  }
  return { error: 'no bridge' };
}
