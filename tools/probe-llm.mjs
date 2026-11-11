export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(() => {
        const raw = localStorage.getItem('atlas-llm-v1') || localStorage.getItem('atlas-byok-v1') || null;
        const keys = Object.keys(localStorage).filter((k) => /llm|byok|api|key/i.test(k));
        return { cfg: raw ? JSON.parse(raw) : null, keys };
      });
    }
  }
  return { error: 'no bridge' };
}
