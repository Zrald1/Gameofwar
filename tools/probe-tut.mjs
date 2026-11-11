export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        const seen = [];
        const snap = () => { const t = A.G.feed[0]; if (t && t.startsWith('The Wizard') && seen[seen.length-1] !== t) seen.push(t); };
        A.emit('gesturePress', 'wizard-bump');
        await new Promise((r) => setTimeout(r, 2200)); snap();
        await new Promise((r) => setTimeout(r, 4800)); snap();
        A.emit('travel', 0, 0); await new Promise((r) => setTimeout(r, 300)); snap();
        A.emit('wish'); await new Promise((r) => setTimeout(r, 300)); snap();
        await new Promise((r) => setTimeout(r, 10500)); snap();
        return { steps: seen };
      });
    }
  }
  return { error: 'no bridge' };
}
