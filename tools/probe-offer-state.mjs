export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(() => {
    const A = window.__atlas;
    return { offerCleared: !A.G.offer, rail: A.G.cardSlots.slice(), feed: A.G.feed.slice(-4) };
  });
}
