/**
 * Generates the shipped starter maps in public/maps/.
 * Run: node tools/make-starter-maps.mjs
 * Map schema "atlas.map.v1": tiles rows use the keys o,s,d,g,f,r,n
 * (ocean/sand/desert/grass/forest/rock/snow), '.' = procedural fallback.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
/** island elevation: fbm hills minus radial sea falloff */
function island(seed, cx = 0.5, cy = 0.5, falloff = 1.15) {
  const e = new Float64Array(W * H);
  const m = new Float64Array(W * H);
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W - cx, nz = z / H - cy;
      const d = Math.hypot(nx * 1.3, nz) * 2; // squash horizontally
      e[z * W + x] = fbm(x * 0.08, z * 0.08, seed) - Math.pow(d, 2.5) * falloff + 0.08;
      m[z * W + x] = fbm(x * 0.11 + 40, z * 0.11 + 9, seed ^ 0x9e3779b9, 3);
    }
  }
  return { e, m };
}
function classify(e, m) {
  if (e < 0.3) return 'o';
  if (e < 0.36) return 's';
  if (e < 0.56 && m < 0.38) return 'd';
  if (e < 0.56) return m > 0.6 ? 'f' : 'g';
  if (e < 0.72) return 'r';
  return 'n';
}
/** A* over land (ocean cells heavy cost) — draws a believable road */
function roadPath(tile, a, b) {
  const key = (x, z) => z * W + x;
  const open = [[0, a[0], a[1]]];
  const came = new Map(), gs = new Map([[key(a[0], a[1]), 0]]);
  const h = (x, z) => Math.hypot(x - b[0], z - b[1]);
  const done = new Set();
  while (open.length) {
    open.sort((p, q) => (p[0] + h(p[1], p[2])) - (q[0] + h(q[1], q[2])));
    const [g, x, z] = open.shift();
    if (x === b[0] && z === b[1]) {
      const pts = [];
      let k = key(x, z);
      while (k !== undefined) { pts.push([k % W, Math.floor(k / W)]); k = came.get(k); }
      return pts;
    }
    const k0 = key(x, z);
    if (done.has(k0)) continue;
    done.add(k0);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx2 = x + dx, nz2 = z + dz;
      if (nx2 < 0 || nz2 < 0 || nx2 >= W || nz2 >= H) continue;
      const cost = tile[key(nx2, nz2)] === 'o' ? 8 : tile[key(nx2, nz2)] === 'r' ? 2.5 : 1;
      const ng = g + cost;
      const k1 = key(nx2, nz2);
      if (ng < (gs.get(k1) ?? Infinity)) {
        gs.set(k1, ng);
        came.set(k1, k0);
        open.push([ng, nx2, nz2]);
      }
    }
  }
  return [];
}
const landNear = (tile, x, z, r = 10, ok = 'gfd') => {
  for (let rr = 0; rr <= r; rr++) {
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx >= 0 && nz >= 0 && nx < W && nz < H && ok.includes(tile[nz * W + nx])) return [nx, nz];
    }
  }
  // any land as fallback
  for (let rr = 0; rr <= r + 8; rr++) {
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx >= 0 && nz >= 0 && nx < W && nz < H && tile[nz * W + nx] !== 'o' && tile[nz * W + nx] !== 's') return [nx, nz];
    }
  }
  return null;
};

function build(name, story, seed, opts) {
  const rng = mulberry32(seed);
  const { e, m } = island(seed, opts.cx ?? 0.5, opts.cy ?? 0.5, opts.falloff ?? 1.35);
  const tile = new Array(W * H);
  for (let i = 0; i < W * H; i++) tile[i] = classify(e[i], m[i]);
  const [cx, cz] = landNear(tile, opts.champ[0], opts.champ[1]);
  const [hx, hz] = landNear(tile, opts.haven[0], opts.haven[1]);
  // roads: champ -> haven, haven -> a random far shore point
  const roads = new Set();
  for (const p of roadPath(tile, [cx, cz], [hx, hz])) roads.add(p[1] * W + p[0]);
  if (opts.roadTo) {
    const t2 = landNear(tile, opts.roadTo[0], opts.roadTo[1]);
    if (t2) for (const p of roadPath(tile, [hx, hz], t2)) roads.add(p[1] * W + p[0]);
  }
  // dig sites: scattered land points away from spawn
  const digs = [];
  for (let t = 0; t < 200 && digs.length < (opts.digs ?? 3); t++) {
    const x = Math.floor(rng() * W), z = Math.floor(rng() * H);
    if (tile[z * W + x] === 'o' || tile[z * W + x] === 's') continue;
    if (Math.hypot(x - cx, z - cz) < 8) continue;
    if (digs.every((d) => Math.hypot(d[0] - x, d[1] - z) > 8)) digs.push([x, z]);
  }
  const rows = [];
  for (let z = 0; z < H; z++) rows.push(tile.slice(z * W, z * W + W).join(''));
  const roadPts = [...roads].map((k) => [k % W, Math.floor(k / W)]);
  return {
    version: 'atlas.map.v1', name, story, w: W, h: H,
    origin: [-Math.floor(W / 2), -Math.floor(H / 2)],
    champion: [cx, cz], haven: [hx, hz], tiles: rows, roads: roadPts, digs,
  };
}

mkdirSync(out, { recursive: true });
const maps = [
  build('atlas-home',
    'Your cradle among the folds - a gentle sea, green heartlands, and roads that remember the way to secrets.',
    20250, { champ: [12, 28], haven: [20, 24], roadTo: [44, 18], digs: 3 }),
  build('verdant-reach',
    'Deep forests hide the old shrines. The X burns under canopies no traveler has named.',
    77701, { champ: [30, 36], haven: [26, 30], roadTo: [40, 14], digs: 4, falloff: 1.2 }),
];
writeFileSync(join(out, 'index.json'), JSON.stringify({ maps: maps.map((m2) => m2.name) }, null, 2) + '\n');
for (const def of maps) {
  writeFileSync(join(out, `${def.name}.json`), JSON.stringify(def) + '\n');
  console.log(`${def.name}: champ(${def.champion}) haven(${def.haven}) roads=${def.roads.length} digs=${def.digs.length}`);
}
console.log('wrote', join(out, 'index.json'));
