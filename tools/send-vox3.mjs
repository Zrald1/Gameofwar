// Send vox + tile ops evaluated inside the APP FRAME (not the wrapper).
export default async function run({ page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const app = page.frames().find((f) => /localhost:8081\//.test(f.url()) && !/devtools|wrapper/.test(f.url()))
    ?? page.mainFrame();
  const res = await app.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      // gold tower on the champion tile
      for (let i = 0; i < 6; i++)
        bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2, r: 0, op: 'add', mat: 'o' });
      // brick wall next to it
      for (const dz of [1, 2, 3])
        for (let i = 0; i < 2; i++)
          bc.postMessage({ t: 'vox', p: 'verifier', x: wx2, z: wz2 + dz, r: 0, op: 'add', mat: 'b' });
      bc.close();
      return { url: location.href, n: 12 };
    },
    [wx, wz],
  );
  await page.waitForTimeout(1400);
  return res;
}
