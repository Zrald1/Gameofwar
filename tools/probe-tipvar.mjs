export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        const lines = [];
        for (let i = 0; i < 3; i++) {
          A.emit('gesturePress', 'wizard');
          await new Promise((r) => setTimeout(r, 120));
          lines.push(A.G.feed[0]);
        }
        return { lines };
      });
    }
  }
  return { error: 'no bridge' };
}
