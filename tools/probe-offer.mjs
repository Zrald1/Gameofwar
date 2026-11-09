// Drive a guildmaster offer + replies through the real event bus (app iframe).
export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(async () => {
    const A = window.__atlas;
    if (!A) return { error: 'no bridge' };
    const out = { phase: A.G.phase };
    A.emit('npcSummon');
    await new Promise((r) => setTimeout(r, 300));
    out.offer = A.G.offer
      ? {
          npc: A.G.offer.npc.name,
          title2: A.G.offer.npc.title,
          grade: A.G.offer.quest.gradeIdx,
          title: A.G.offer.quest.title,
          gold: A.G.offer.quest.rewardGold,
          line: A.G.offer.line,
        }
      : null;
    if (!out.offer) return out;
    A.emit('npcReply', 'bargain');
    await new Promise((r) => setTimeout(r, 4000));
    out.afterBargain = A.G.offer
      ? { line: A.G.offer.line, gold: A.G.offer.quest.rewardGold }
      : { withdrawn: true };
    if (A.G.offer) {
      A.emit('npcReply', 'take');
      await new Promise((r) => setTimeout(r, 4000));
    }
    out.finalOffer = A.G.offer ? 'still pending' : 'cleared';
    out.rail = A.G.cardSlots.slice();
    return out;
  });
}
