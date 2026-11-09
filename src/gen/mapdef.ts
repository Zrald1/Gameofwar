/**
 * Authored-map pipeline. A map JSON in public/maps/ overlays an authored
 * region onto the infinite procedural world: inside the region the authored
 * biome wins; '.' cells and out-of-bounds tiles fall back to tileInfo().
 * Rapid deployment: drop a <name>.json into public/maps/, add <name> to
 * public/maps/index.json, and press "Next Expedition" in the HUD (or open
 * ?map=<name>).
 */
import { Biome, Biomes, hash2, TileInfo, tileInfo } from './prng.js';
import { brainBoot } from './brain.js';
import { DEFAULT_MAP_KEY, feed, G } from '../state.js';

export interface MapDef {
  name: string;
  story: string;
  w: number;
  h: number;
  /** world coords of authored cell (0,0) */
  ox: number;
  oz: number;
  /** biome key index per cell, -1 = procedural hole */
  tiles: Int8Array;
  /** road overlay cell set (lz*w+lx) */
  road: Set<number>;
  /** minecraft-style blocks per cell (lz*w+lx) -> stack string, bottom char first */
  vox: Map<number, string>;
  champion: [number, number];
  haven: [number, number];
  digs: [number, number][];
}

const KEYS = 'osdgfrn'; // ocean sand desert grass forest rock snow

/**
 * Minecraft-style piece table. c = color; sx/sy/sz = scale of the unit cube
 * (1 = full block). Panels (wall/door/pane) thin one axis; stair/roof are
 * half-slabs; fence is a thin post.
 */
export interface VoxDef {
  c: number;
  sx: number;
  sy: number;
  sz: number;
}
const C = (c: number): VoxDef => ({ c, sx: 1, sy: 1, sz: 1 });
export const VOX_DEFS: Record<string, VoxDef> = {
  d: C(0x7a5230), // dirt
  s: C(0x8a8a90), // stone
  w: C(0xa0763f), // wood planks
  b: C(0xa04a38), // brick
  g: C(0xaadfee), // glass
  o: C(0xe8c25a), // gold
  l: C(0x3e8a45), // leaf
  c: C(0xb9b9b4), // concrete
  m: C(0xf0ebe0), // marble
  i: C(0xc9ced6), // iron
  k: C(0x1c1626), // obsidian
  a: C(0x3f8fd8), // water
  v: C(0xe8642a), // lava
  t: C(0xffc45a), // torch/glow
  W: { c: 0x8a8a90, sx: 0.45, sy: 1, sz: 1 },    // wall panel
  D: { c: 0x7a4a28, sx: 0.3, sy: 1, sz: 1 },     // door
  S: { c: 0x8a8a90, sx: 1, sy: 0.5, sz: 1 },     // stair / half slab
  F: { c: 0xa0763f, sx: 0.3, sy: 0.85, sz: 0.3 },// fence post
  P: { c: 0xaadfee, sx: 0.15, sy: 1, sz: 1 },    // glass pane
  R: { c: 0xa04a38, sx: 1, sy: 0.4, sz: 1 },     // roof slab
};
export const VOX_MATS = Object.keys(VOX_DEFS).join('');
export const MAX_STACK = 8;
const KEY_BIOME: Biome[] = [
  Biomes.OCEAN, Biomes.SAND, Biomes.DESERT, Biomes.GRASS,
  Biomes.FOREST, Biomes.ROCK, Biomes.SNOW,
];

/** base elevation/moisture per authored biome — feeds height + hypso tint */
const AUTH: { e: number; m: number }[] = [
  { e: 0.22, m: 0.9 },  // ocean
  { e: 0.34, m: 0.5 },  // sand
  { e: 0.48, m: 0.2 },  // desert
  { e: 0.47, m: 0.55 }, // grass
  { e: 0.5, m: 0.8 },   // forest
  { e: 0.65, m: 0.3 },  // rock
  { e: 0.8, m: 0.6 },   // snow
];

/** atlas.map.v1 JSON -> MapDef (also used to sync maps over presence) */
export function decodeMap(raw: any): MapDef | null {
  if (!raw || raw.version !== 'atlas.map.v1' || !Array.isArray(raw.tiles)) return null;
  const w = raw.w | 0, h = raw.h | 0;
  if (w < 4 || h < 4 || raw.tiles.length !== h) return null;
  const tiles = new Int8Array(w * h).fill(-1);
  for (let z = 0; z < h; z++) {
    const row = String(raw.tiles[z]);
    for (let x = 0; x < w && x < row.length; x++) {
      const k = KEYS.indexOf(row[x]);
      if (k >= 0) tiles[z * w + x] = k;
    }
  }
  const road = new Set<number>();
  for (const p of raw.roads ?? []) {
    const x = p[0] | 0, z = p[1] | 0;
    if (x >= 0 && z >= 0 && x < w && z < h) road.add(z * w + x);
  }
  const clampPt = (p: any, fb: [number, number]): [number, number] =>
    Array.isArray(p) && p.length >= 2 ? [p[0] | 0, p[1] | 0] : fb;
  return {
    name: String(raw.name ?? 'Uncharted'),
    story: String(raw.story ?? ''),
    w, h,
    ox: (raw.origin?.[0] ?? -(w >> 1)) | 0,
    oz: (raw.origin?.[1] ?? -(h >> 1)) | 0,
    tiles, road,
    vox: decodeVox(raw.vox, w, h),
    champion: clampPt(raw.champion, [w >> 1, h >> 1]),
    haven: clampPt(raw.haven, [(w >> 1) + 2, (h >> 1) + 2]),
    digs: (raw.digs ?? []).map((d: any) => clampPt(d, [0, 0])),
  };
}

async function fetchMap(name: string): Promise<MapDef | null> {
  try {
    const res = await fetch(`maps/${encodeURIComponent(name)}.json`);
    if (!res.ok) return null;
    return decodeMap(await res.json());
  } catch {
    return null;
  }
}

const VOX_BAD = new RegExp(`[^${VOX_MATS}]`, 'g');

function decodeVox(raw: any, w: number, h: number): Map<number, string> {
  const vox = new Map<number, string>();
  if (!Array.isArray(raw)) return vox;
  for (const e of raw) {
    const x = e?.[0] | 0, z = e?.[1] | 0;
    const s = String(e?.[2] ?? '').replace(VOX_BAD, '').slice(0, MAX_STACK);
    if (x >= 0 && z >= 0 && x < w && z < h && s) vox.set(z * w + x, s);
  }
  return vox;
}

/** MapDef -> atlas.map.v1 JSON (export + presence sync) */
export function serializeMap(m: MapDef): string {
  const rows: string[] = [];
  for (let z = 0; z < m.h; z++) {
    let row = '';
    for (let x = 0; x < m.w; x++) {
      const k = m.tiles[z * m.w + x];
      row += k < 0 ? '.' : KEYS[k];
    }
    rows.push(row);
  }
  return JSON.stringify({
    version: 'atlas.map.v1', name: m.name, story: m.story,
    w: m.w, h: m.h, origin: [m.ox, m.oz],
    champion: m.champion, haven: m.haven, tiles: rows,
    roads: [...m.road].map((k) => [k % m.w, Math.floor(k / m.w)]),
    vox: [...m.vox.entries()].map(([k, s]) => [k % m.w, Math.floor(k / m.w), s]),
    digs: m.digs.map(([x, z]) => [x - m.ox, z - m.oz]),
  });
}

/** place the world on a loaded map: spawn, haven, authored digs, story */
export function applyMap(def: MapDef): void {
  G.map = def;
  G.mapName = def.name;
  const [ci, cj] = def.champion;
  G.ci = def.ox + ci;
  G.cj = def.oz + cj;
  G.centerI = G.ci;
  G.centerJ = G.cj;
  G.havenI = def.ox + def.haven[0];
  G.havenJ = def.oz + def.haven[1];
  G.digs = def.digs.map(([x, z]) => ({ id: G.nextDigId++, questId: -1, i: def.ox + x, j: def.oz + z }));
  G.freeDig = G.digs.length > 0 ? { i: G.digs[0].i, j: G.digs[0].j } : null;
  G.terrainDirty = true;
  G.hudDirty = true;
  feed(`You chart ${def.name}. ${def.story}`);
}

/**
 * The admin's own world, persisted locally. "Set as Home Map" writes the
 * serialized MapDef here; it outranks every shipped map at boot.
 */
export function saveDefaultMap(m: MapDef): boolean {
  try {
    localStorage.setItem(DEFAULT_MAP_KEY, serializeMap(m));
    return true;
  } catch {
    return false;
  }
}

export function loadDefaultMap(): MapDef | null {
  try {
    return decodeMap(JSON.parse(localStorage.getItem(DEFAULT_MAP_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function clearDefaultMap(): void {
  try {
    localStorage.removeItem(DEFAULT_MAP_KEY);
  } catch { /* private mode */ }
}

/** boot: ?map=<name> > my default map > saved map > index.json[0] > 'atlas-home' > procedural */
export async function initMapLibrary(): Promise<void> {
  brainBoot();
  try {
    const res = await fetch('maps/index.json');
    if (res.ok) {
      const idx = await res.json();
      if (Array.isArray(idx?.maps)) G.mapList = idx.maps.map(String);
    }
  } catch { /* no index - procedural only */ }
  const param = new URLSearchParams(location.search).get('map');
  if (param) {
    const def = await fetchMap(param);
    if (def) applyMap(def);
    return;
  }
  const mine = loadDefaultMap();
  if (mine) {
    applyMap(mine);
    return;
  }
  const def = await fetchMap(savedMapName() ?? G.mapList[0] ?? 'atlas-home');
  if (def) applyMap(def);
}

function savedMapName(): string | null {
  try {
    const d = JSON.parse(localStorage.getItem('atlas-eternal-save-v1') ?? 'null');
    return d?.map ?? null;
  } catch {
    return null;
  }
}

/** HUD "Next Expedition" - cycle to the next map in index.json */
export async function nextMap(): Promise<void> {
  if (G.mapList.length === 0) {
    feed('No charted expeditions - add maps to public/maps/index.json');
    return;
  }
  const cur = G.mapList.indexOf(G.mapName);
  const next = G.mapList[(cur + 1 + G.mapList.length) % G.mapList.length];
  const def = await fetchMap(next);
  if (!def) {
    feed(`Chart '${next}' is missing its file in public/maps/`);
    return;
  }
  applyMap(def);
  feed('The ink folds - a new land rises from the map.');
}

/**
 * Write one tool stamp into a MapDef at world tile (wx,wz) with radius r.
 * tool: biome key 'osdgfrn' | 'road' | 'dig' | 'haven' | 'champ' | 'erase'.
 * Shared by the editor (local) and presence (remote stamps).
 */
export function stampTile(m: MapDef, wx: number, wz: number, r: number, tool: string): void {
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const lx = wx + dx - m.ox, lz = wz + dz - m.oz;
      if (lx < 0 || lz < 0 || lx >= m.w || lz >= m.h) continue;
      const k = lz * m.w + lx;
      const keyIdx = KEYS.indexOf(tool);
      if (keyIdx >= 0) {
        m.tiles[k] = keyIdx;
        m.road.delete(k);
      } else if (tool === 'road') {
        m.road.add(k);
      } else if (tool === 'erase') {
        m.tiles[k] = -1;
        m.road.delete(k);
        m.vox.delete(k);
      } else if (dx === 0 && dz === 0) {
        if (tool === 'dig') m.digs.push([wx, wz]);
        else if (tool === 'haven') {
          m.haven = [lx, lz];
          G.havenI = wx; G.havenJ = wz;
        } else if (tool === 'champ') m.champion = [lx, lz];
      }
    }
  }
}

/**
 * Minecraft-style build stamp. op 'add' pushes mat onto each stack in the
 * brush; 'del' pops the top block; 'clear' empties. Stacks cap at MAX_STACK.
 */
export function stampVox(m: MapDef, wx: number, wz: number, r: number, op: string, mat: string): void {
  const ch = mat[0];
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const lx = wx + dx - m.ox, lz = wz + dz - m.oz;
      if (lx < 0 || lz < 0 || lx >= m.w || lz >= m.h) continue;
      const k = lz * m.w + lx;
      const s = m.vox.get(k) ?? '';
      if (op === 'add' && VOX_DEFS[ch] && s.length < MAX_STACK) {
        m.vox.set(k, s + ch);
      } else if (op === 'del' && s) {
        s.length > 1 ? m.vox.set(k, s.slice(0, -1)) : m.vox.delete(k);
      } else if (op === 'clear') {
        m.vox.delete(k);
      }
    }
  }
}

/** block stack at a world tile ('' when unbuilt / unmapped) */
export function voxStack(m: MapDef | null, wx: number, wz: number): string {
  if (!m) return '';
  const lx = wx - m.ox, lz = wz - m.oz;
  if (lx < 0 || lz < 0 || lx >= m.w || lz >= m.h) return '';
  return m.vox.get(lz * m.w + lx) ?? '';
}

/** tileInfo that honors the authored region when a map is loaded */
export function mapTileInfo(wx: number, wz: number): TileInfo {
  const m = G.map;
  if (!m) return tileInfo(wx, wz, G.seed);
  const lx = wx - m.ox, lz = wz - m.oz;
  if (lx < 0 || lz < 0 || lx >= m.w || lz >= m.h) return tileInfo(wx, wz, G.seed);
  const k = m.tiles[lz * m.w + lx];
  if (k < 0) return tileInfo(wx, wz, G.seed);
  const base = AUTH[k];
  const ej = (hash2(wx, wz, G.seed ^ 0x5151) - 0.5) * 0.03;
  const mj = (hash2(wx, wz, G.seed ^ 0x2627) - 0.5) * 0.2;
  const e = Math.min(0.99, Math.max(0.01, base.e + ej));
  const moist = Math.min(1, Math.max(0, base.m + mj));
  const road = m.road.has(lz * m.w + lx);
  const r = hash2(wx, wz, G.seed ^ 0x51ab3);
  let prop = 0;
  if (!road) {
    const b = KEY_BIOME[k];
    if (b === Biomes.DESERT && r < 0.06) prop = 2;
    else if ((b === Biomes.GRASS && r < 0.05) || (b === Biomes.FOREST && r < 0.45)) prop = 1;
    else if (b === Biomes.ROCK && r < 0.15) prop = 3;
    else if (b === Biomes.SNOW && r < 0.2) prop = 4;
  }
  return { biome: KEY_BIOME[k], e, m: moist, prop, road };
}
