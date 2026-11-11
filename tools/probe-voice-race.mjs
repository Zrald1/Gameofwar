// Voice-answer-to-Morvane loop check: raceOpen + pickRace event -> startRun.
export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        A.G.raceOpen = true;
        A.emit('pickRace', 2); // what heard("an elf") emits
        await new Promise((r) => setTimeout(r, 300));
        return {
          race: A.G.race,
          raceOpen: A.G.raceOpen,
          feed: A.G.feed.slice(0, 3),
        };
      });
    }
  }
  return { error: 'no bridge' };
}
