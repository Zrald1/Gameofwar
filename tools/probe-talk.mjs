export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    return { offer: A.G.offer ? { text: (A.G.offer.text||'').slice(0,60), grade: A.G.offer.grade } : null,
             gesture: A.gesture || null,
             feed: A.G.feed.slice(0, 4) };
  });
}
