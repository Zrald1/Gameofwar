export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        document.getElementById('btn-begin')?.click();
        await new Promise((r) => setTimeout(r, 300));
        const wrap = document.getElementById('race-wrap');
        return { raceWrapShown: wrap ? getComputedStyle(wrap).display : 'missing', top: window.__atlas.G.feed.slice(0, 3) };
      });
    }
  }
  return { error: 'no bridge' };
}
