export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        const before = A.G.feed.length;
        A.emit('wizardLine', 'The Wizard: direct emit test');
        await new Promise((r) => setTimeout(r, 300));
        return { lines: A.G.feed.slice(before) };
      });
    }
  }
  return { error: 'no bridge' };
}
