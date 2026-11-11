export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    // drive the real feed -> uikitml path with each suspect glyph
    A.G.feed.unshift('g arrow → dot ● dash — mid · end');
    A.G.hudDirty = true;
    await new Promise((r) => setTimeout(r, 800));
    // also set the pin-display element directly if reachable
    const panel = A.world.getSceneObject?.('hud') ?? A.hudPanel ?? null;
    let pinSet = false;
    if (panel?.getElementById) {
      const el = panel.getElementById('pin-display');
      if (el) { el.setProperties({ text: '[ ●●●● ]' }); pinSet = true; }
    }
    await new Promise((r) => setTimeout(r, 800));
    return { fed: A.G.feed[0], pinSet };
  });
}
