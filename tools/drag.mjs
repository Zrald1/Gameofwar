// Orbit-drag the canvas, then click a point. args: {from:[x,y], to:[x,y], click:[x,y], shot}
export default async function run({ page }, args = {}) {
  const [fx, fy] = args.from ?? [450, 500];
  const [tx, ty] = args.to ?? [150, 500];
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  if (args.click) {
    await page.mouse.click(args.click[0], args.click[1]);
    await page.waitForTimeout(1200);
  }
  if (args.shot) await page.screenshot({ path: args.shot });
  return { dragged: [fx, fy, tx, ty], clicked: args.click ?? null };
}
