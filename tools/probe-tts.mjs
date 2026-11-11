export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(async () => {
        const A = window.__atlas;
        A.emit('wizardLine', 'The Wizard: voice check');
        await new Promise((r) => setTimeout(r, 500));
        return {
          hasSynth: typeof speechSynthesis !== 'undefined',
          speaking: typeof speechSynthesis !== 'undefined' ? speechSynthesis.speaking || speechSynthesis.pending : null,
          voices: typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices().length : 0,
        };
      });
    }
  }
  return { error: 'no bridge' };
}
