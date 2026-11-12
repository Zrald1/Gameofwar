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

    // 1. patron camp -> offer -> thumbs-up take
    A.emit('gesturePress', 'patron');
    await sleep(150);
    out.offer = !!G.offer;
    if (G.offer) { A.emit('npcReply', 'take'); await sleep(150); }
    out.questActive = G.activeQuests.size;

    // 2. walk to a dig -> strike -> loot
    const dig = G.digs[0];
    out.digSite = dig ? [dig.i, dig.j] : null;
    if (dig) {
      G.ci = dig.i; G.cj = dig.j;
      const gold0 = G.gold, drops0 = G.lootDrops.length;
      A.emit('gesturePress', 'dig-x');
      await sleep(150);
      out.digYield = { gold: G.gold - gold0, drops: G.lootDrops.length - drops0, newSite: G.digs.length };
    }

    // 3. claim a drop if one fell
    const drop = G.lootDrops[0];
    if (drop) {
      G.ci = drop.i; G.cj = drop.j;
      await sleep(150);
      out.claimed = !G.lootDrops.includes(drop);
    }

    // 4. haven gate -> build
    G.gold = Math.max(G.gold, 400);
    const houses0 = G.houses;
    G.ci = G.havenI; G.cj = G.havenJ;
    A.emit('gesturePress', 'haven');
    await sleep(150);
    out.built = G.houses - houses0;

    // 5. shrine -> wish -> offer
    G.ci = G.wishI; G.cj = G.wishJ;
    A.emit('gesturePress', 'wish');
    await sleep(150);
    out.wishOffer = !!G.offer || 'rail-full';
    out.wishEffort = G.effort.wish;

    // 6. exit to table
    A.emit('advExit');
    await sleep(150);
    out.modeAfter = G.mode;
    out.feedTop = G.feed.slice(0, 3);
    return out;
  });
}
