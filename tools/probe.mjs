export default async function run({ page }) {
  const keys = await page.evaluate(() => {
    const out = { iwsdk: [], worldLike: [] };
    for (const k of Object.getOwnPropertyNames(window)) {
      if (/iwsdk|world|elics|xr/i.test(k)) out.iwsdk.push(k);
    }
    return out;
  });
  return keys;
}
