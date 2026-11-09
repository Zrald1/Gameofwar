// Control test: same channel/path as the vox sends, but a tile stamp.
// If snow appears at the champion tile, the presence path works and the bug
// is inside rebuildVox; if not, the single-page broadcast never arrives.
export default async function run({ page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const sent = await page.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      bc.postMessage({ t: 'tile', p: 'verifier', x: wx2, z: wz2, r: 1, tool: 'n' });
      bc.close();
      return 1;
    },
    [wx, wz],
  );
  await page.waitForTimeout(1200);
  return { sent };
}
