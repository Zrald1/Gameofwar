export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(() => {
    const A = window.__atlas;
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    if (A.G.mode !== 'adv') A.emit('advEnter');
    // stand next to the shrine
    A.G.ci = A.G.wishI; A.G.cj = A.G.wishJ;
    return { pos: [A.G.ci, A.G.cj], wish: [A.G.wishI, A.G.wishJ] };
  });
}
