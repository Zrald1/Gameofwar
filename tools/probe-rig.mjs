export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const w = A.world;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const camW = () => {
      const v = new w.camera.position.constructor();
      w.camera.getWorldPosition(v);
      return v.toArray().map((x) => +x.toFixed(2));
    };
    out.playerKeys = Object.keys(w.player).filter((k) => /pos|loco|rig|transform/i.test(k));
    out.before = { playerPos: w.player.position.toArray().map((x) => +x.toFixed(2)), camW: camW() };
    w.player.position.set(2, 0, 0);
    await sleep(150);
    out.afterSet = { playerPos: w.player.position.toArray().map((x) => +x.toFixed(2)), camW: camW() };
    // try moving the camera node directly
    w.camera.position.x += 3;
    await sleep(150);
    out.afterCam = { camLocal: w.camera.position.toArray().map((x) => +x.toFixed(2)), camW: camW() };
    return out;
  });
}
