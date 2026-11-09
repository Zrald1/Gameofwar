export default async function run({ page }) {
  let app = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!window.__atlas).catch(() => false)) {
      app = f;
      break;
    }
  }
  if (!app) return { error: 'no __atlas frame' };
  const url = new URL(app.url());
  url.searchParams.set('map', process.env.MAP || 'shattered-causeway');
  await app.goto(url.href, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 5000));
  return await app.evaluate(() => {
    const A = window.__atlas;
    return {
      map: A.G.map?.name ?? null,
      voxStacks: A.G.map ? A.G.map.vox.size : 0,
      digs: A.G.map?.digs?.length ?? 0,
      roads: A.G.map?.roads?.size ?? 0,
      phase: A.G.phase,
      champ: [A.G.ci, A.G.cj],
    };
  });
}
