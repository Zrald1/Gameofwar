export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!(window.__atlas && window.__atlas.world)).catch(() => false)) { app = f; break; }
  }
  if (!app) return { error: 'no app frame' };
  return await app.evaluate(() => {
    document.querySelectorAll('vite-error-overlay, #vite-error-overlay, [id*="overlay"]').forEach((e) => e.remove());
    return { removed: true };
  });
}
