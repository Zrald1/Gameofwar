export default async function run({ page }) {
  // reload the frame that owns __atlas (the actual app, not the wrapper)
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!window.__atlas).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no __atlas frame' };
  await app.goto(app.url(), { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4500));
  return { url: app.url() };
}
