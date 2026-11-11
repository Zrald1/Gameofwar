export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    return { feed: A.G.feed.slice(0, 4), quests: A.G.quests?.length ?? -1, wishEffort: A.G.effort?.wish };
  });
}
