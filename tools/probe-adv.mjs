/**
 * probe-adv: adventure-mode foundation end-to-end.
 * enter -> world scales x20, NPCs sit on tiles, walking updates ci/cj,
 * edge -> recenter, exit -> everything restored.
 */
export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    // playing state
    A.G.phase = 'playing';
    A.G.race = A.G.race || 'Elf';
    A.G.terrainDirty = true;
    await sleep(400);
    const table = A.Anchors.get('table');
    out.before = { mode: A.G.mode, scale: table.scale.x, pos: table.position.toArray().map((v) => +v.toFixed(3)) };

    // ---- ENTER ----
    A.emit('advToggle');
    await sleep(500);
    out.enter = {
      mode: A.G.mode,
      scale: +table.scale.x.toFixed(1),
      pos: table.position.toArray().map((v) => +v.toFixed(2)),
      groundScale: +A.world.requireSceneObject('game-floor').scale.x.toFixed(1),
      champHidden: !A.Anchors.get('champion').visible,
      patronPos: A.Anchors.get('patron').position.toArray().map((v) => +v.toFixed(3)),
      wizPos: A.Anchors.get('wizard').position.toArray().map((v) => +v.toFixed(3)),
      feed: A.G.feed[0],
    };

    // ---- WALK: move the camera node, tile should track ----
    const before = { ci: A.G.ci, cj: A.G.cj };
    A.world.camera.position.x += 1.2; // ~1.2m east
    await sleep(300);
    out.walk = { was: before, now: { ci: A.G.ci, cj: A.G.cj }, effort: A.G.effort.walk };

    // ---- WALK TO EDGE: far east should recenter ----
    const c0 = { i: A.G.centerI, j: A.G.centerJ };
    A.world.camera.position.x += 12;
    await sleep(400);
    out.edge = { centerWas: c0, centerNow: { i: A.G.centerI, j: A.G.centerJ }, feed: A.G.feed[0] };

    // ---- EXIT ----
    A.emit('advToggle');
    await sleep(400);
    out.exit = {
      mode: A.G.mode,
      scale: +table.scale.x.toFixed(1),
      pos: table.position.toArray().map((v) => +v.toFixed(3)),
      groundScale: +A.world.requireSceneObject('game-floor').scale.x.toFixed(1),
      feed: A.G.feed[0],
    };
    out.wizardLines = A.G.feed.filter((x) => x.includes('Wizard')).slice(0, 4);
    return out;
  });
}
