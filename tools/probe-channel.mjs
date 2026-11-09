// Diagnose: listen for 'pose' heartbeats on the presence channel in EACH frame
// to find the live app instance, then fire vox ops there.
export default async function run({ page }) {
  const report = [];
  for (const f of page.frames()) {
    const r = await f.evaluate(async () => {
      const got = [];
      const bc = new BroadcastChannel('atlas-room-default');
      bc.onmessage = (ev) => got.push(ev.data?.t);
      await new Promise((res) => setTimeout(res, 2200));
      bc.close();
      return { url: location.href, seen: got.slice(0, 12) };
    });
    report.push(r);
  }
  return report;
}
