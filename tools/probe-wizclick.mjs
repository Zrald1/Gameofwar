export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const wiz = A.Anchors.get('wizard');
    if (!wiz) return { error: 'no wizard anchor' };
    const cam = A.world.camera;
    const canvas = document.querySelector('canvas');
    if (!cam || !canvas) return { error: 'no cam/canvas' };
    const p = wiz.getWorldPosition(new cam.position.constructor());
    p.y += 0.05; // center of the hit-proxy
    p.project(cam);
    const r = canvas.getBoundingClientRect();
    const x = r.left + ((p.x + 1) / 2) * r.width;
    const y = r.top + ((1 - p.y) / 2) * r.height;
    const out = { ndc: [+p.x.toFixed(2), +p.y.toFixed(2)], px: [x | 0, y | 0], inView: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
    const before = A.G.feed.slice();
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerType: 'mouse', isPrimary: true }));
      await new Promise((res) => setTimeout(res, 60));
    }
    await new Promise((res) => setTimeout(res, 400));
    out.tip = A.G.feed.find((l) => l.includes('Wizard') && !before.includes(l)) ?? 'NONE';
    out.proxy = !!wiz.getObjectByName('hit-proxy');
    return out;
  });
}
