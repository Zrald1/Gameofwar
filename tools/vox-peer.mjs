// Real-peer vox test: open tab2 (joins presence as a real client), post vox
// ops from it — identical path to the proven remote tile stamp.
export default async function run({ context }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const page2 = await context.newPage();
  await page2.goto('https://localhost:8081/', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(4000); // boot + presence join
  const sent = await page2.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      for (let i = 0; i < 6; i++)
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2, r: 0, op: 'add', mat: 'o' });
      for (const dz of [1, 2, 3])
        for (let i = 0; i < 2; i++)
          bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'b' });
      bc.close();
      return 12;
    },
    [wx, wz],
  );
  await page2.waitForTimeout(1500);
  return { sent };
}
