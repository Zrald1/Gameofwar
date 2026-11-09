// Navigates the app iframe itself (the top page is a workspace wrapper that
// strips ?map=). Then screenshots.
export default async function run({ page, frame }, args = {}) {
  const name = args.map ?? 'verdant-reach';
  const frames = page.frames().map((f) => f.url());
  const target = frame ?? page.frames().find((f) => f !== page.mainFrame());
  if (!target) return { frames, error: 'no app frame' };
  const base = target.url().split('?')[0];
  await target.goto(`${base}?map=${name}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  if (args.shot) await page.screenshot({ path: args.shot });
  return { frames, navigated: target.url() };
}
