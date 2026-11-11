export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(() => ({
        feed: window.__atlas.G.feed.slice(-10),
        phase: window.__atlas.G.phase,
        race: window.__atlas.G.race,
      }));
    }
  }
  return { error: 'no bridge' };
}
