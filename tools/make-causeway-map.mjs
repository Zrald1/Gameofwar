/**
 * Generates "The Shattered Causeway" — a twin-isle map where a sunken
 * sandbar road links spawn isle to a ruined keep (voxel blocks baked in).
 * Run: node tools/make-causeway-map.mjs
 * Map schema "atlas.map.v1" — see tools/make-starter-maps.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 64, H = 48;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maps');

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x, y, seed, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { v += amp * vnoise(x * f, y * f, seed + o * 101); amp *= 0.5; f *= 2; }
  return v / (1 - Math.pow(0.5, oct));
}
/** one island elevation field around (cx,cy) */
function isle(seed, cx, cy, falloff = 1.5) {
  const e = new Float64Array(W * H);
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x / W - cx) * 1.35, (z / H - cy)) * 2;
      e[z * W + x] = fbm(x * 0.09, z * 0.09, seed) - Math.pow(d, 2.4) * falloff + 0.1;
    }
  return e;
}
function classify(e, m) {
  if (e < 0.3) return 'o';
  if (e < 0.36) return 's';
  if (e < 0.56 && m < 0.38) return 'd';
  if (e < 0.56) return m > 0.6 ? 'f' : 'g';
  if (e < 0.72) return 'r';
  return 'n';
}
const landNear = (tile, x, z, r = 10, ok = 'gfd') => {
  for (let rr = 0; rr <= r; rr++)
    for (let dz = -rr; dz <= rr; dz++)
      for (let dx = -rr; dx <= rr; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < W && nz < H && ok.includes(tile[nz * W + nx])) return [nx, nz];
      }
  return null;
};

const SEED = 0xca5e;
const rng = mulberry32(SEED);
// two isles: west spawn isle, east ruin isle; composite elevation = max
const e1 = isle(SEED, 0.27, 0.52, 1.35);
const e2 = isle(SEED ^ 0x51ab, 0.76, 0.46, 1.25);
const moist = new Float64Array(W * H);
for (let i = 0; i < W * H; i++) moist[i] = fbm((i % W) * 0.11 + 40, Math.floor(i / W) * 0.11 + 9, SEED ^ 0x9e37, 3);
const tile = new Array(W * H);
for (let i = 0; i < W * H; i++) tile[i] = classify(Math.max(e1[i], e2[i]), moist[i]);

// --- the shattered causeway: a wavy sandbar between the isles with gaps ---
const cw = [];
{
  let x = 24, z = 25;
  // west anchor: east shore of spawn isle; east anchor: west shore of ruin isle
  const a = landNear(tile, 26, 25, 8, 'gsf');
  const b = landNear(tile, 40, 23, 8, 'gsf');
  if (a && b) {
    let px = a[0], pz = a[1];
    let i = 0;
    while (px !== b[0] || pz !== b[1]) {
      // stepping toward b with jitter — and every 4th cell is a gap (ocean)
      if (i % 4 !== 2) {
        tile[pz * W + px] = 's';
        cw.push([px, pz]);
      }
      if (px !== b[0]) px += Math.sign(b[0] - px);
      else if (pz !== b[1]) pz += Math.sign(b[1] - pz);
      if (rng() < 0.3) pz += rng() < 0.5 ? 1 : -1;
      pz = Math.max(0, Math.min(H - 1, pz));
      i++;
      if (i > 200) break;
    }
  }
}

// --- the ruined keep on the east isle: voxel stacks baked into the map ---
const kc = landNear(tile, 50, 20, 10, 'g') ?? [50, 20];
const [kx, kz] = kc;
const vox = [];
const put = (x, z, stack) => vox.push([x, z, stack]);
// keep footprint 7x5: crumbled walls (W), a door, roof stubs, twin spires
for (let dx = -3; dx <= 3; dx++) {
  for (let dz = -2; dz <= 2; dz++) {
    const edge = Math.abs(dx) === 3 || Math.abs(dz) === 2;
    if (!edge) continue;
    if (dx === 0 && dz === 2) { put(kx + dx, kz + dz, 'D'); continue; } // door, south face
    if (rng() < 0.28) { put(kx + dx, kz + dz, 'S'); continue; }         // collapsed = stair rubble
    put(kx + dx, kz + dz, rng() < 0.2 ? 'WW' : 'W');
  }
}
// twin watch spires (stone + gold caps) at the two back corners
put(kx - 3, kz - 2, 'sso');
put(kx + 3, kz - 2, 'sso');
// roof stubs on the two front corners
put(kx - 3, kz + 2, 'WR');
put(kx + 3, kz + 2, 'WR');
// torch pair flanking the door + scattered rubble
put(kx - 1, kz + 3, 't');
put(kx + 1, kz + 3, 't');
for (let t = 0; t < 8; t++) {
  const dx = Math.floor(rng() * 11) - 5, dz = Math.floor(rng() * 9) - 4;
  if (Math.abs(dx) <= 3 && Math.abs(dz) <= 2) continue;
  put(kx + dx, kz + dz, rng() < 0.5 ? 'F' : 'S');
}
// force the keep's ground to grass so walls sit on green, not water
for (let dx = -4; dx <= 4; dx++)
  for (let dz = -3; dz <= 3; dz++) {
    const nx = kx + dx, nz = kz + dz;
    if (nx >= 0 && nz >= 0 && nx < W && nz < H && tile[nz * W + nx] === 'o') tile[nz * W + nx] = 's';
  }

const [cx, cz] = landNear(tile, 14, 26, 12) ?? [14, 26];
const [hx, hz] = landNear(tile, kx, kz + 4, 8) ?? [kx, kz + 4];
// roads: spawn -> west shore anchor, east shore -> keep/haven
const roads = new Set(cw.map(([x, z]) => z * W + x));
{
  // simple L-shaped dirt road spawn->causeway, causeway->keep
  let px = cx, pz = cz;
  const a = cw[0] ?? [30, 25];
  while (px !== a[0] || pz !== a[1]) {
    roads.add(pz * W + px);
    if (px !== a[0]) px += Math.sign(a[0] - px); else pz += Math.sign(a[1] - pz);
  }
  const e2 = cw[cw.length - 1] ?? [44, 23];
  px = e2[0]; pz = e2[1];
  while (px !== hx || pz !== hz) {
    roads.add(pz * W + px);
    if (pz !== hz) pz += Math.sign(hz - pz); else px += Math.sign(hx - px);
  }
}
const digs = [];
for (let t = 0; t < 300 && digs.length < 4; t++) {
  const x = Math.floor(rng() * W), z = Math.floor(rng() * H);
  if (tile[z * W + x] === 'o' || tile[z * W + x] === 's') continue;
  if (Math.hypot(x - cx, z - cz) < 8) continue;
  if (digs.every((d) => Math.hypot(d[0] - x, d[1] - z) > 8)) digs.push([x, z]);
}
digs.push([kx - 1, kz]); // one dig inside the ruined keep — the vault

const rows = [];
for (let z = 0; z < H; z++) rows.push(tile.slice(z * W, z * W + W).join(''));
const roadPts = [...new Set(roads)].map((k) => [k % W, Math.floor(k / W)]);
const map = {
  version: 'atlas.map.v1',
  name: 'shattered-causeway',
  story:
    'Two isles, one broken road. The sea took the middle of the causeway an age ago — ' +
    'what stands on the far shore still pays its debts in gold.',
  w: W, h: H,
  origin: [-Math.floor(W / 2), -Math.floor(H / 2)],
  tiles: rows,
  roads: roadPts,
  champion: [cx, cz],
  haven: [hx, hz],
  digs,
  vox,
};
writeFileSync(join(out, 'shattered-causeway.json'), JSON.stringify(map));
// register in the library index
const idx = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'));
if (!idx.maps.includes('shattered-causeway')) {
  idx.maps.push('shattered-causeway');
  writeFileSync(join(out, 'index.json'), JSON.stringify(idx, null, 2) + '\n');
}
console.log('shattered-causeway.json written:', vox.length, 'vox stacks,', roadPts.length, 'road cells,', digs.length, 'digs');
