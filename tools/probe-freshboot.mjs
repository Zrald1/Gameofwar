export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!window.__atlas).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  await app.evaluate(() => {
    localStorage.removeItem('atlas-eternal-save-v1');
    location.reload();
  });
  return { reloading: true };
}
