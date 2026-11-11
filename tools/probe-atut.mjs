export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    localStorage.removeItem('atlas-advtut-v1');
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    if (A.G.mode !== 'adv') A.emit('advEnter');
    await sleep(4200); // entry line + 3.5s delay
    out.push({ step: 'enter', line: A.G.feed[0] });
    for (const ev of ['advStep', 'travel', 'campArrive', 'digDone']) {
      A.emit(ev, 'patron');
      await sleep(150);
      out.push({ step: ev, line: A.G.feed[0] });
    }
    out.push({ step: 'flag', line: localStorage.getItem('atlas-advtut-v1') });
    return out;
  });
}
