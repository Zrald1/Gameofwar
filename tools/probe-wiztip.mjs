export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        A.emit('gesturePress', 'wizard');
        await new Promise((r) => setTimeout(r, 400));
        return { top: A.G.feed.slice(0, 3) };
      });
    }
  }
  return { error: 'no bridge' };
}
