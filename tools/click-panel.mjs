// Clicks a point on the WebGL canvas (UIKitML panels are 3D; clicks raycast).
// Usage: iwsdk browser run tools/click-panel.mjs --input-json '{"x":87,"y":456,"shot":"C:/Temp/out.png"}'
export default async function run({ page }, args = {}) {
  const x = args.x ?? 87, y = args.y ?? 456;
  await page.mouse.click(x, y);
  await page.waitForTimeout(args.wait ?? 1200);
  if (args.shot) await page.screenshot({ path: args.shot });
  return { clicked: [x, y] };
}
