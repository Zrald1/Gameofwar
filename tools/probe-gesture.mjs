export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (!A) return { error: 'no bridge' };
    const digx = [...A.G?._anchors || []];
    return { gesture: A.gesture || null, feed: A.G.feed.slice(-8) };
  });
}
