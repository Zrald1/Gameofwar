export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (!A) return { error: 'no bridge' };
    return { feed: A.G.feed.slice(-8), digs: A.G.digs.length, activeDig: A.G.activeDigId };
  });
}
