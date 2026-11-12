export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(async () => {
    const A = window.__atlas, G = A.G, out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (G.phase !== 'playing') A.applyCharacter('elf');
    if (G.mode !== 'adv') A.emit('advEnter');
    out.mode = G.mode;

    // 1. patron -> offer -> take (reply path is async, give it room)
    A.emit('gesturePress', 'patron');
    await sleep(300);
    out.offer = !!G.offer;
    if (G.offer) { A.emit('npcReply', 'take'); await sleep(1200); }
    out.questActive = G.activeQuests.size;

    // 2. stand on a dig tile, let activeDig refresh, then strike
    const dig = G.digs[0];
    out.digSite = dig ? [dig.i, dig.j, dig.questId] : null;
    if (dig) {
      G.ci = dig.i; G.cj = dig.j;
      await sleep(400); // a frame must re-pick nearest -> activeDigId
      const gold0 = G.gold, drops0 = G.lootDrops.length, xp0 = G.xp;
      A.emit('gesturePress', 'dig-x');
      await sleep(300);
      out.digYield = { gold: G.gold - gold0, drops: G.lootDrops.length - drops0, xp: G.xp - xp0, feed0: G.feed[0] };
    }

    // 3. haven gate punch -> build (houses may be maxed from earlier probes)
    G.gold = Math.max(G.gold, 400);
    const houses0 = G.houses;
    G.ci = G.havenI; G.cj = G.havenJ;
    await sleep(200);
    A.emit('gesturePress', 'haven');
    await sleep(200);
    out.built = G.houses - houses0;
    out.housesCap = G.houses;

    // 4. exit
    A.emit('advExit');
    await sleep(150);
    out.modeAfter = G.mode;
    return out;
  });
}
