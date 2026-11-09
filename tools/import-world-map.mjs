// Open-data map importer: rasterizes a small countries GeoJSON (johan/
// world.geo.json, public-domain Natural Earth derivatives) into atlas.map.v1
// files. Latitude bands + climate-zone country sets drive biomes; a Silk
// Road polyline lays the road overlay. Output is a few KB - no runtime deps.
// Usage: node tools/import-world-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const W = 64, H = 36;
const geo = JSON.parse(readFileSync('tools/data-countries.geo.json', 'utf8'));

// --- geometry -------------------------------------------------------------
// per-ring bbox for cheap rejection
const rings = [];
for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const outer = poly[0], holes = poly.slice(1);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of outer) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    rings.push({ id: f.id, outer, holes, x0, x1, y0, y1 });
  }
}

const pip = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** returns country id of the land under (lon,lat), or null for ocean */
function countryAt(lon, lat) {
  if (lat < -63) return 'ATA'; // Antarctica wraps the pole - special-case
  for (const r of rings) {
    if (lon < r.x0 || lon > r.x1 || lat < r.y0 || lat > r.y1) continue;
    if (!pip(lon, lat, r.outer)) continue;
    if (r.holes.some((h) => pip(lon, lat, h))) return null;
    return r.id;
  }
  return null;
}

// --- climate model --------------------------------------------------------
const DESERT = new Set(['AUS','SAU','EGY','LBY','DZA','MLI','NER','TCD','SDN','MRT','SOM','NAM','BWA','YEM','OMN','ARE','IRN','AFG','PAK','TKM','UZB','KAZ','MNG','MAR','ESH','JOR','ISR','PER','CHL','ARG','MEX','USA']);
const FOREST = new Set(['BRA','COD','COG','GAB','GNQ','COL','VEN','GUY','SUR','IDN','MYS','PNG','MMR','THA','VNM','LAO','KHM','CRI','PAN','ECU','RUS','CAN','SWE','FIN','NOR','USA','CHN','JPN','KOR','PRK','DEU','POL','FRA','BLR','UKR','ROU','NGA','CMR','CAF','AGO','ZMB','TZA','MOZ','MDG','IND','BGD','NPL','BTN','PHL','NZL','CHL','GBR','IRL','BIH','SRB','HRV','MNE','ALB','BGR','GRC','EST','LVA','LTU','GEO','VCT','SLB','FJI','NCL','CUB','HTI','DOM','NIC','HND','GTM','BLZ','BOL','PRY','URY','MEX','ESP','PRT','ITA']);
const ROCK   = new Set(['NPL','BTN','CHE','AUT','BOL','PER','CHL','NOR','ISL','CAN','RUS','TJK','KGZ','MNG','LIE','AND','ITA','GRC','JPN','NZL','ARG','COL','ECU','IRN','TUR','YEM','ETH','LSO','AFG','PAK','IND','CHN','MEX','USA','GRL','MAR','DZA','ESP']);
const SNOWID = new Set(['ATA','GRL','ISL','RUS','CAN','SJM']);

const hash = (x, z) => {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** biome key char for a land cell */
function landKey(id, lat, gx, gz) {
  const a = Math.abs(lat);
  const r = hash(gx, gz);
  if (a > 66 || SNOWID.has(id) && a > 55) return r < 0.85 ? 'n' : 'r';
  if (DESERT.has(id) && a < 40 && !FOREST.has(id)) return r < 0.82 ? 'd' : 's';
  if (DESERT.has(id) && a < 40 && r < 0.45) return 'd'; // desert encroaches
  if (ROCK.has(id) && r < 0.45) return 'r';
  if (FOREST.has(id) || a < 18) return r < 0.72 ? 'f' : 'g';
  if (a > 50) return r < 0.6 ? 'f' : 'g';
  return r < 0.15 ? 'f' : 'g';
}

/** rasterize the world (optionally longitude-mirrored) */
function rasterize(mirror) {
  const grid = new Array(H).fill(null).map(() => new Array(W).fill('o'));
  for (let gz = 0; gz < H; gz++) {
    for (let gx = 0; gx < W; gx++) {
      const lon = ((gx + 0.5) / W) * 360 - 180;
      const lat = 90 - ((gz + 0.5) / H) * 180;
      const id = countryAt(mirror ? -lon : lon, lat);
      grid[gz][gx] = id ? landKey(id, lat, gx, gz) : 'o';
    }
  }
  // beach ring: land cells adjacent to ocean get a chance of sand
  for (let gz = 1; gz < H - 1; gz++) {
    for (let gx = 1; gx < W - 1; gx++) {
      if (grid[gz][gx] === 'o') continue;
      const nearSea = [grid[gz-1][gx], grid[gz+1][gx], grid[gz][gx-1], grid[gz][gx+1]].includes('o');
      if (nearSea && hash(gx * 7, gz * 3) < 0.4) grid[gz][gx] = 's';
    }
  }
  return grid;
}

// --- features -------------------------------------------------------------
const toXY = (lon, lat) => [Math.round(((lon + 180) / 360) * W - 0.5), Math.round(((90 - lat) / 180) * H - 0.5)];

/** nearest land cell to a lon/lat target (spiral out) */
function nearestLand(grid, lon, lat) {
  const [cx, cz] = toXY(lon, lat);
  for (let r = 0; r < W; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= W || z >= H) continue;
        const k = grid[z][x];
        if (k !== 'o' && k !== 's') return [x, z];
      }
    }
  }
  return [cx, cz];
}

/** lay a road along lon/lat waypoints (land cells only) */
function roadAlong(grid, pts) {
  const roads = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = toXY(pts[i][0], pts[i][1]);
    const [x1, z1] = toXY(pts[i + 1][0], pts[i + 1][1]);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 2 + 1;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n);
      const z = Math.round(z0 + ((z1 - z0) * s) / n);
      if (x < 0 || z < 0 || x >= W || z >= H) continue;
      if (grid[z][x] !== 'o' && grid[z][x] !== 's' && grid[z][x] !== 'n') {
        grid[z][x] = 'g';
        roads.push([x, z]);
      }
    }
  }
  return roads;
}

const SILK_ROAD = [
  [2, 48], [8, 50], [15, 52], [22, 52], [30, 50], [38, 47],
  [45, 42], [55, 40], [65, 40], [75, 42], [85, 42], [95, 40], [105, 38], [116, 40],
];

function build(name, story, mirror) {
  const grid = rasterize(mirror);
  const roads = roadAlong(grid, SILK_ROAD);
  const champion = nearestLand(grid, 12, 46);   // Europe-ish
  const haven = nearestLand(grid, 12, 44);
  const digs = [
    nearestLand(grid, -100, 40),  // North America
    nearestLand(grid, 25, 0),     // East Africa
    nearestLand(grid, 135, -25),  // Australia
  ];
  const m = {
    version: 'atlas.map.v1',
    name, story, w: W, h: H,
    origin: [-(W >> 1), -(H >> 1)],
    champion, haven, digs,
    tiles: grid.map((r) => r.join('')),
    roads,
    vox: [],
  };
  return m;
}

const earth = build(
  'old-earth',
  'The chart of the first world - silk roads still glow under the ink.',
  false,
);
const mirror = build(
  'terra-mirror',
  'A mirrored Earth - familiar shores folded into a stranger world.',
  true,
);

for (const m of [earth, mirror]) {
  writeFileSync(`public/maps/${m.name}.json`, JSON.stringify(m));
  console.log(`${m.name}: ${m.w}x${m.h}, ${m.roads.length} road cells, ${m.digs.length} digs`);
}
