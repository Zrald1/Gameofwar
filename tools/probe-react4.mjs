export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        A.emit('editMode', false); // exit - must NOT mark the event
        A.emit('editMode', true);  // enter - should speak
        A.emit('travel', 0, 0);
        await new Promise((r) => setTimeout(r, 200));
        return { feed: A.G.feed.slice(0, 3) };
      });
    }
  }
  return { error: 'no bridge' };
}
