/**
 * Deterministic seeded world generation. Same (seed, wx, wz) always yields
 * the same tile — the world is infinite and never stored.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** deterministic hash of integer coords -> [0,1) */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** value noise sampled at float coords */
export function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    v += amp * vnoise(x * freq, y * freq, seed + o * 101);
    amp *= 0.5;
    freq *= 2;
  }
  return v / (1 - Math.pow(0.5, octaves)) * 0.5;
}

export const Biomes = {
  OCEAN: 'ocean',
  SAND: 'sand',
  DESERT: 'desert',
  GRASS: 'grass',
  FOREST: 'forest',
  ROCK: 'rock',
  SNOW: 'snow',
} as const;
export type Biome = (typeof Biomes)[keyof typeof Biomes];

export interface TileInfo {
  biome: Biome;
  /** 0..1 elevation, drives tile height */
  e: number;
  /** 0..1 moisture */
  m: number;
  /** decor kind: 0 none, 1 tree, 2 cactus, 3 rock, 4 snowtree */
  prop: number;
  /** authored road overlay (map maps only) */
  road?: boolean;
}

const SCALE = 0.09;

export function tileInfo(wx: number, wz: number, seed: number): TileInfo {
  const e = fbm(wx * SCALE, wz * SCALE, seed, 3);
  const m = fbm(wx * SCALE + 51.7, wz * SCALE + 13.1, seed ^ 0x9e3779b9, 2);
  const r = hash2(wx, wz, seed ^ 0x51ab3);
  let biome: Biome;
  let prop = 0;
  if (e < 0.3) {
    biome = Biomes.OCEAN;
  } else if (e < 0.37) {
    biome = Biomes.SAND;
  } else if (e < 0.56 && m < 0.4) {
    biome = Biomes.DESERT;
    if (r < 0.06) prop = 2;
  } else if (e < 0.56) {
    biome = m > 0.62 ? Biomes.FOREST : Biomes.GRASS;
    if (biome === Biomes.FOREST && r < 0.45) prop = 1;
    else if (r < 0.05) prop = 1;
  } else if (e < 0.74) {
    biome = Biomes.ROCK;
    if (r < 0.15) prop = 3;
  } else {
    biome = Biomes.SNOW;
    if (r < 0.2) prop = 4;
  }
  return { biome, e, m, prop };
}

export const BIOME_COLORS: Record<Biome, number> = {
  ocean: 0x1550a0,
  sand: 0xd8c58a,
  desert: 0xd9a750,
  grass: 0x4f9e4a,
  forest: 0x2e6e34,
  rock: 0x7d7d84,
  snow: 0xeef3f8,
};
