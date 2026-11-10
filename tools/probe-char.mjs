export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.applyCharacter)).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const champ = A.Anchors.get('champion');
    const count = (name) => {
      let n = 0;
      champ?.traverse((o) => { if (o.name === name || o.parent?.name === name) n++; });
      return n;
    };
    const out = {};
    for (const back of ['none', 'cape', 'banner', 'wings']) {
      A.G.charBack = back;
      A.applyCharacter();
      out[back] = { backParts: count('char-back'), hatParts: count('char-hat') };
      await new Promise((r) => setTimeout(r, 60));
    }
    A.G.charHat = 'crown';
    A.applyCharacter();
    out.withCrown = count('char-hat');
    A.G.charBack = 'none'; A.G.charHat = 'none';
    A.applyCharacter();
    return out;
  });
}
