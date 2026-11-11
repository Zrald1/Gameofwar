export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    localStorage.removeItem('atlas-tut-v1');
    const seen = [];
    const snap = () => { const l = A.G.feed.find((x) => x.includes('Wizard')); if (l && seen[seen.length - 1] !== l) seen.push(l.slice(0, 60)); };
    A.G.phase = 'playing';
    A.emit('runStarted');
    for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 900)); snap(); }
    A.emit('travel'); // should advance step 1 -> step 2 (wish)
    await new Promise((r) => setTimeout(r, 500)); snap();
    A.emit('wish'); // step 2 -> step 3 (patron)
    await new Promise((r) => setTimeout(r, 500)); snap();
    for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 1000)); snap(); }
    return { seen, tutFlag: localStorage.getItem('atlas-tut-v1') };
  });
}
