export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!window.__atlas).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no __atlas' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    A.G.admin = true;
    A.emit('editMode', true);
    const key = A.G.cj * 1e5 + A.G.ci; // not exact — read stack via map.vox instead
    const before = A.G.map?.vox?.size ?? -1;
    const stackAt = () => {
      const lx = A.G.ci - A.G.map.ox, lz = A.G.cj - A.G.map.oz;
      return A.G.map.vox.get(lz * A.G.map.w + lx) ?? '';
    };
    A.emit('gesturePress', 'vox-add');
    A.emit('gesturePress', 'vox-add');
    await new Promise((r) => setTimeout(r, 300));
    const mid = stackAt();
    A.emit('gesturePress', 'vox-break');
    await new Promise((r) => setTimeout(r, 300));
    const after = stackAt();
    A.emit('editMode', false);
    return { before, stackAfter2Punches: mid, stackAfterSwipe: after, mat: A.G.buildMat };
  });
}
