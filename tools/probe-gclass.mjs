export default async function run({ page }) {
  for (const f of page.frames()) {
    const has = await f.evaluate(() => typeof window.__atlas).catch(() => 'x');
    if (has === 'object') {
      return await f.evaluate(() => window.__atlas.gesture ?? { err: 'no gesture state' });
    }
  }
  return { error: 'no bridge' };
}
