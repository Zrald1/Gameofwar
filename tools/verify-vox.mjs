// Broadcast vox ops through the presence channel (same path a remote peer's
// ops take): stack a gold/brick/stone pillar + a small wall at the champion
// tile, then wait for the terrain rebuild.
export default async function run({ page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const sent = await page.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      // a 3-high pillar on the champion tile
      for (const mat of ['s', 'b', 'o']) {
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2, r: 0, op: 'add', mat });
      }
      // a short dirt wall beside it
      for (const dz of [1, 2]) {
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'd' });
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'w' });
      }
      bc.close();
      return 7;
    },
    [wx, wz],
  );
  await page.waitForTimeout(1500);
  return { sent };
}
