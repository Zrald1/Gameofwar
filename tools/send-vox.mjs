// Send vox ops without reloading (map already loaded).
export default async function run({ page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const sent = await page.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      for (const mat of ['s', 'b', 'o', 'o'])
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2, r: 0, op: 'add', mat });
      for (const dz of [1, 2, 3])
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'd' });
      bc.close();
      return 7;
    },
    [wx, wz],
  );
  await page.waitForTimeout(1200);
  return { sent };
}
