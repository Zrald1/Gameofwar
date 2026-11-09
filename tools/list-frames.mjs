export default async function run({ page }) {
  return { frames: page.frames().map((f) => f.url()) };
}
