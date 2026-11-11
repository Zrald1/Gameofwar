export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(() => ({
        race: window.__atlas.G.race,
        raceOpen: window.__atlas.G.raceOpen,
        feed: window.__atlas.G.feed.slice(0, 3),
      }));
    }
  }
  return { error: 'no bridge' };
}
