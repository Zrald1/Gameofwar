export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(async () => {
    const A = window.__atlas;
    A.emit('npcSummon');
    await new Promise((r) => setTimeout(r, 300));
    return { offer: A.G.offer ? { npc: A.G.offer.npc.name, title: A.G.offer.quest.title } : null, rail: A.G.cardSlots.slice() };
  });
}
