export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    // wrap every skillUp listener to capture the arg shape + stack
    const l = A.G.listeners.get('skillUp') || [];
    const snaps = [];
    for (let i = 0; i < l.length; i++) {
      const orig = l[i];
      l[i] = (...a) => {
        snaps.push({ arg: a.map((x) => (x && typeof x === 'object' ? Object.keys(x) : x)), stack: new Error().stack.split('\n').slice(1, 4).join(' | ') });
        return orig(...a);
      };
    }
    window.__snoop = snaps;
    // also reproduce: bare emit renders undefined?
    A.emit('skillUp');
    const line = A.G.feed[0];
    return { feedTop: line, snoopInstalled: l.length };
  });
}
