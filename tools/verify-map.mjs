// Loads ?map=<name> directly — proves the URL-param deployment path.
export default async function run({ page }, args = {}) {
  const name = args.map ?? 'verdant-reach';
  await page.goto(`https://localhost:8081/?map=${name}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  if (args.shot) await page.screenshot({ path: args.shot });
  return { url: page.url() };
}
