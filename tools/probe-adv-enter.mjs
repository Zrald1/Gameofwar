export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    if (A.G.mode !== 'adv') A.emit('advEnter');
    return { mode: A.G.mode, phase: A.G.phase, ci: A.G.ci, cj: A.G.cj,
      patron: { i: A.G.patronI, j: A.G.patronJ }, wiz: { i: A.G.wizI, j: A.G.wizJ } };
  });
}
