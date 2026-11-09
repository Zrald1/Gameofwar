// Clears the atlas save + reloads (run via `iwsdk browser run`)
export default async function run({ page }) {
  await page.evaluate(() => {
    for (const k of ['atlas-eternal-save-v1', 'atlas-admin-v1', 'atlas-default-map-v1']) {
      try { localStorage.removeItem(k); } catch {}
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return { cleared: true };
}
