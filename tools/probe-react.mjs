export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        A.emit('questAccept');
        A.emit('questAccept'); // twice - should only speak once
        A.emit('havenBuilt');
        await new Promise((r) => setTimeout(r, 200));
        return { feed: A.G.feed.slice(0, 4), aim: A.G.wizardAim ?? null };
      });
    }
  }
  return { error: 'no bridge' };
}
