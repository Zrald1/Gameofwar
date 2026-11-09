// Tall gold tower at the champion tile + dirt wall; no reload needed.
export default async function run({ page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const sent = await page.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      let n = 0;
      for (let i = 0; i < 8; i++) {
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2, r: 0, op: 'add', mat: 'o' });
        n++;
      }
      for (const dz of [1, 2, 3, 4]) {
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'd' });
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'd' });
        n += 2;
      }
      bc.close();
      return n;
    },
    [wx, wz],
  );
  await page.waitForTimeout(1200);
  return { sent };
}
