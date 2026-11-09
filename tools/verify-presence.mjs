// Two-client presence test: opens a second app page in the same context.
// BroadcastChannel('atlas-room-default') is shared -> both NetAvatarSystems
// see each other. Then tab2 broadcasts a remote forest stamp at the champion
// tile so tab1 repaints. args: {wx, wz, tool, r}
export default async function run({ context, page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const tool = args.tool ?? 'f', r = args.r ?? 2;
  const page2 = await context.newPage();
  await page2.goto('https://localhost:8081/', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(4000); // app boot + presence join
  const stamped = await page2.evaluate(
    ([wx2, wz2, tool2, r2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      bc.postMessage({ t: 'tile', p: 'verifier', x: wx2, z: wz2, r: r2, tool: tool2 });
      bc.close();
      return true;
    },
    [wx, wz, tool, r],
  );
  await page.waitForTimeout(1500); // rebuild ticks on tab1
  return { stamped, page2: page2.url() };
}
