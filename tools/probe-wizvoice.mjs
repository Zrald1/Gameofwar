export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const calls = [];
    const synth = window.speechSynthesis;
    if (synth) {
      const orig = synth.speak.bind(synth);
      synth.speak = (u) => { calls.push({ t: u.text.slice(0, 40), r: u.rate, p: u.pitch }); try { orig(u); } catch {} };
    }
    const out = { synthExists: !!synth, greetFed: A.G.feed.some((l) => l.includes('Wizard')) };
    A.emit('gesturePress', 'wizard');
    await new Promise((r) => setTimeout(r, 300));
    out.calls = calls;
    out.tipFed = A.G.feed.find((l) => l.includes('Wizard'));
    return out;
  });
}
