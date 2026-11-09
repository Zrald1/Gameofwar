// Build a mini house via peer vox ops: concrete foundation, walls, a door,
// fence posts, a torch — exercises the new shaped pieces end-to-end.
export default async function run({ context, page }, args = {}) {
  const wx = args.wx ?? -15, wz = args.wz ?? -1;
  const page2 = await context.newPage();
  await page2.goto('https://localhost:8081/', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(4000);
  const sent = await page2.evaluate(
    ([wx2, wz2]) => {
      const bc = new BroadcastChannel('atlas-room-default');
      const op = (x, z, mat) =>
        bc.postMessage({ t: 'vox', p: 'verifier', x, z, r: 0, op: 'add', mat });
      // clear the site first
      for (const dz of [0, 1, 2, 3]) for (const dx of [0, 1, 2]) op(wx2 + dx, wz2 + dz, '');
      bc.postMessage({ t: 'vox', p: 'verifier', x: wx2 + 1, z: wz2 + 1, r: 2, op: 'clear', mat: '' });
      // concrete foundation 3x3
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) op(wx2 + dx, wz2 + dz, 'c');
      // walls: perimeter row 2 (panels)
      for (const dx of [0, 1, 2]) op(wx2 + dx, wz2, 'W');
      for (const dz of [0, 1, 2]) op(wx2, wz2 + dz, 'W');
      for (const dz of [0, 1, 2]) op(wx2 + 2, wz2 + dz, 'W');
      // door on the front edge
      op(wx2 + 1, wz2 + 2, 'D');
      // roof slab on top of one wall corner
      op(wx2, wz2, 'R'); op(wx2, wz2, 'R');
      // fence + torch out front
      op(wx2 - 1, wz2 + 2, 'F');
      op(wx2 + 3, wz2 + 2, 't');
      bc.close();
      return 30;
    },
    [wx, wz],
  );
  await page2.waitForTimeout(1500);
  return { sent };
}
