// Clears the atlas save + reloads (run via `iwsdk browser run`)
export default async function run({ page }) {
  await page.evaluate(() => {
    try { localStorage.removeItem('atlas-eternal-save-v1'); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return { cleared: true };
}
