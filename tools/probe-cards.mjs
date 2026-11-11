export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    const cards = [];
    A.world.scene.traverse((o) => {
      if (o.name && o.name.startsWith('Quest Card')) cards.push({ n: o.name, v: o.visible, p: o.parent && o.parent.name });
    });
    return { mode: A.G.mode, cards };
  });
}
