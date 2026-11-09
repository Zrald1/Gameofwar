export default async function run({ page }) {
  const dumps = [];
  for (const f of page.frames()) {
    const d = await f
      .evaluate(() => {
        const A = window.__atlas;
        return A
          ? {
              has: true,
              phase: A.G?.phase,
              anchors: A.Anchors ? A.Anchors.size : 'no-anchors-export',
              keys: A.Anchors ? [...A.Anchors.keys()].slice(0, 20) : [],
            }
          : { has: false };
      })
      .catch((e) => ({ err: String(e).slice(0, 120) }));
    dumps.push({ url: f.url(), ...d });
  }
  let app = null;
  for (const f of page.frames()) {
    if (
      await f
        .evaluate(() => !!(window.__atlas && window.__atlas.Anchors && window.__atlas.Anchors.size))
        .catch(() => false)
    ) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no live app frame', dumps };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    if (!A) return { error: 'no __atlas' };
    const patron = A.Anchors ? A.Anchors.get('patron') : null;
    if (!patron) {
      const keys = A.Anchors ? [...A.Anchors.keys()] : [];
      return { error: 'no patron anchor', anchorKeys: keys };
    }
    const robeOf = () =>
      patron?.getObjectByName('patron-robe')?.material?.color?.getHex?.() ?? null;
    const before = { visible: patron?.visible, robe: robeOf(), phase: A.G.phase };
    A.emit('npcSummon');
    await new Promise((r) => setTimeout(r, 600));
    const o = A.G.offer;
    return {
      before,
      after: {
        visible: patron.visible,
        robe: robeOf(),
        offer: o ? { npc: o.npc.name, npcRobe: o.npc.robe, title: o.quest.title } : null,
        pos: [+patron.position.x.toFixed(3), +patron.position.y.toFixed(3), +patron.position.z.toFixed(3)],
      },
    };
  });
}
