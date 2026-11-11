export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const wiz = A.Anchors.get('wizard');
    const out = { havenAlias: A.Anchors.get('haven') === A.Anchors.get('haven-marker') };
    // patron only shows in 'playing' - force the phase for this check
    A.G.phase = 'playing';
    await new Promise((r) => setTimeout(r, 200));
    // summon an offer so the tip aims at the patron
    A.emit('npcSummon');
    await new Promise((r) => setTimeout(r, 150));
    const before = wiz.rotation.y;
    A.emit('gesturePress', 'wizard');
    await new Promise((r) => setTimeout(r, 600)); // ease toward target
    const patron = A.Anchors.get('patron');
    const expected = Math.atan2(patron.position.x - wiz.position.x, patron.position.z - wiz.position.z);
    out.before = +before.toFixed(3);
    out.after = +wiz.rotation.y.toFixed(3);
    out.expected = +expected.toFixed(3);
    out.turnedToward = Math.abs(wiz.rotation.y - expected) < 0.25;
    out.tip = A.G.feed[0];
    return out;
  });
}
