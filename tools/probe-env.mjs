export default async function run({ page }) {
  const out = [];
  for (const f of page.frames()) {
    try {
      out.push(
        await f.evaluate(() => ({
          url: location.href,
          hasAtlas: typeof window.__atlas,
          canvases: document.querySelectorAll('canvas').length,
        })),
      );
    } catch (e) {
      out.push({ error: String(e).slice(0, 120) });
    }
  }
  return out;
}
