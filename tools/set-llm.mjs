// Inject a BYOK LLM config into the app's localStorage, then reload.
// Usage: ATLAS_LLM_KEY=... npx @iwsdk/cli browser run tools/set-llm.mjs
// The key arrives via env var — never committed to the repo.
export default async function run({ page }) {
  const cfg = {
    endpoint: process.env.ATLAS_LLM_ENDPOINT ?? 'https://api.liquid.ai/openai/v1/chat/completions',
    key: process.env.ATLAS_LLM_KEY ?? '',
    model: process.env.ATLAS_LLM_MODEL ?? 'lfm3-1.7b',
  };
  if (!cfg.key) return { error: 'ATLAS_LLM_KEY not set' };
  await page.evaluate((c) => {
    localStorage.setItem('atlas-llm-v1', JSON.stringify(c));
  }, cfg);
  const stored = await page.evaluate(() => !!localStorage.getItem('atlas-llm-v1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  return { stored, endpoint: cfg.endpoint, model: cfg.model };
}
