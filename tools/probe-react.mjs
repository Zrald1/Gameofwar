// wizard-reaction regression: fire each event, assert a wizard line appears
export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  return await app.evaluate(async () => {
    const A = window.__atlas;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (A.G.phase !== 'playing') A.applyCharacter('elf');
    const args = {
      advEntered: [], advExited: [], travel: [A.G.ci, A.G.cj], travelAdv: [A.G.ci, A.G.cj],
      skillUp: [{ name: 'Test Talent', id: 'probe' }],
      digDone: [{ id: -1, i: A.G.ci, j: A.G.cj }],
      questDone: [{ id: -1, title: 'Probe Quest' }],
      npcOffer: [{ npc: 'patron', quest: { title: 'Probe', gradeIdx: 0 }, line: 'probe' }],
      mapChanged: [],
    };
    const out = [];
    for (const [ev, a] of Object.entries(args)) {
      try {
        A.emit(ev, ...a);
        await sleep(60);
        const line = A.G.feed[0] || '';
        out.push({ ev, hit: /Wizard|Morvane|fold|wanderer|talent|deed/i.test(line), line: line.slice(0, 64) });
      } catch (e) { out.push({ ev, hit: false, line: 'THREW: ' + String(e).slice(0, 50) }); }
    }
    return out;
  });
}
