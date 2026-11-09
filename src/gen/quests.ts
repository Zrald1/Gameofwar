/**
 * Quest + loot generation. Quests are procedurally generated ("the world AI
 * authors them") — grades D..SSSS by complexity, matching the user's spec:
 * rarer grade = harder objective = better reward, up to legendary relics.
 */
import { Biome, Biomes, TileInfo, tileInfo } from './prng.js';

type InfoFn = (wx: number, wz: number) => TileInfo;

export const GRADES = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSSS'] as const;
export type Grade = (typeof GRADES)[number];

/** base roll weights; wish pedestal shifts the window up by +2 */
export const GRADE_WEIGHTS = [30, 25, 18, 12, 8, 4, 2.2, 0.8];

export const GRADE_COLORS = [
  '#8a8f98', // D
  '#5fae6a', // C
  '#4f8fd8', // B
  '#9b6fe0', // A
  '#e0b13f', // S
  '#e07830', // SS
  '#e04848', // SSS
  '#ffe95e', // SSSS legendary
];

export const QuestKinds = { EXCAVATE: 'excavate', SURVEY: 'survey', RELIC: 'relic' } as const;
export type QuestKind = (typeof QuestKinds)[keyof typeof QuestKinds];

const EXCAVATE_TITLES = [
  'Buried Cache', 'Sunken Vault', 'Forgotten Hoard', 'Sealed Barrow',
  'Smuggler\'s Drop', 'War-Chest of the Fallen', 'The Drowned Tithe',
  'Ember-Sealed Coffer', 'King\'s Ransom', 'Vault of the First Dawn',
];
const SURVEY_TITLES = [
  'Chart the Wilds', 'Scout the Frontier', 'Map the Unmapped',
  'Survey the Reach', 'Walk the Leylines', 'Claim the Vista',
];
const RELIC_TITLES = [
  'Shards of the Ancients', 'The Broken Crown', 'Twin Seals of Ruin',
  'Relics of the Demon War', 'The Eldest Keystone',
];
const BIOME_WORDS: Record<Biome, string> = {
  ocean: 'of the Azure Deep',
  sand: 'of the Glass Shore',
  desert: 'of the Burning Sea',
  grass: 'of the Green March',
  forest: 'of the Whispering Wood',
  rock: 'of the Gray Teeth',
  snow: 'of the Silent Crown',
};

export interface Quest {
  id: number;
  gradeIdx: number;
  kind: QuestKind;
  title: string;
  /** world-tile targets: primary, and second dig for relic quests */
  ti: number;
  tj: number;
  ti2: number;
  tj2: number;
  biomeTarget: Biome;
  rewardGold: number;
  rewardPower: number;
  legendary: boolean;
  done: boolean;
}

export function rollGrade(rng: () => number, boost = 0): number {
  const w = GRADE_WEIGHTS.slice();
  // wish boost: shift mass toward high grades
  for (let i = 0; i < boost && i < w.length - 1; i++) {
    const moved = w[i] * 0.6;
    w[i] -= moved;
    w[Math.min(i + 2, w.length - 1)] += moved;
  }
  let total = 0;
  for (const x of w) total += x;
  let r = rng() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return w.length - 1;
}

/** pick a land tile at ring distance [minD..maxD] from (ci,cj); retries to satisfy constraint */
function pickTile(
  rng: () => number,
  seed: number,
  ci: number,
  cj: number,
  minD: number,
  maxD: number,
  want: Biome | undefined,
  infoFn: InfoFn,
): [number, number] {
  for (let t = 0; t < 60; t++) {
    const ang = rng() * Math.PI * 2;
    const d = minD + rng() * (maxD - minD);
    const ti = Math.round(ci + Math.cos(ang) * d);
    const tj = Math.round(cj + Math.sin(ang) * d);
    const info = infoFn(ti, tj);
    if (want) {
      if (info.biome === want) return [ti, tj];
    } else if (info.biome !== Biomes.OCEAN) {
      return [ti, tj];
    }
  }
  return [ci + Math.round(minD), cj];
}

const SURVEY_BIOMES: Biome[] = [Biomes.DESERT, Biomes.FOREST, Biomes.SNOW, Biomes.SAND, Biomes.ROCK];

export function genQuest(
  rng: () => number,
  seed: number,
  id: number,
  ci: number,
  cj: number,
  boost = 0,
  infoFn: InfoFn = (wx, wz) => tileInfo(wx, wz, seed),
): Quest {
  const gradeIdx = rollGrade(rng, boost);
  const dist = 5 + gradeIdx * 3 + rng() * 6;
  const roll = rng();
  let kind: QuestKind;
  if (gradeIdx >= 4 && roll < 0.35) kind = QuestKinds.RELIC;
  else if (roll < 0.62) kind = QuestKinds.EXCAVATE;
  else kind = QuestKinds.SURVEY;

  const biomeTarget = SURVEY_BIOMES[Math.floor(rng() * SURVEY_BIOMES.length)];
  let ti = 0;
  let tj = 0;
  let ti2 = 0;
  let tj2 = 0;
  if (kind === QuestKinds.SURVEY) {
    [ti, tj] = pickTile(rng, seed, ci, cj, dist, dist + 14, biomeTarget, infoFn);
  } else {
    [ti, tj] = pickTile(rng, seed, ci, cj, dist, dist + 10, undefined, infoFn);
    if (kind === QuestKinds.RELIC) {
      [ti2, tj2] = pickTile(rng, seed, ti, tj, 4, 9, undefined, infoFn);
    }
  }
  const titles =
    kind === QuestKinds.EXCAVATE ? EXCAVATE_TITLES :
    kind === QuestKinds.SURVEY ? SURVEY_TITLES : RELIC_TITLES;
  const base = titles[Math.floor(rng() * titles.length)];
  const suffixBiome = infoFn(ti, tj).biome;
  const title = `${base} ${BIOME_WORDS[kind === QuestKinds.SURVEY ? biomeTarget : suffixBiome]}`;
  const scale = Math.pow(gradeIdx + 1, 1.6);
  return {
    id,
    gradeIdx,
    kind,
    title,
    ti, tj, ti2, tj2,
    biomeTarget,
    rewardGold: Math.round(18 * scale + rng() * 20),
    rewardPower: Math.round(4 * scale),
    legendary: gradeIdx >= 6 || (gradeIdx >= 4 && rng() < 0.15),
    done: false,
  };
}

export interface Loot {
  gold: number;
  power: number;
  item: string;
  legendary: boolean;
}

const ITEM_NAMES = [
  'Copper Ring', 'Scout\'s Dagger', 'Oak Charm', 'Iron Sigil',
  'Ranger\'s Bow', 'Knight\'s Oath', 'Moonlit Pendant', 'Storm Axe',
];
const RELIC_NAMES = [
  'Heart of the Mountain', 'Crown of Tides', 'Demon King\'s Fang',
  'Seed of the World-Tree', 'The Cartographer\'s Eye', 'Starfall Blade',
];

/** free treasure dig (not quest-tied) */
export function rollLoot(rng: () => number, luckBonus = 0): Loot {
  const r = rng() + luckBonus;
  if (r > 0.985) {
    return {
      gold: 250 + Math.round(rng() * 250),
      power: 60,
      item: RELIC_NAMES[Math.floor(rng() * RELIC_NAMES.length)],
      legendary: true,
    };
  }
  if (r > 0.7) {
    return {
      gold: 40 + Math.round(rng() * 60),
      power: 6 + Math.floor(rng() * 10),
      item: ITEM_NAMES[Math.floor(rng() * ITEM_NAMES.length)],
      legendary: false,
    };
  }
  return {
    gold: 10 + Math.round(rng() * 40),
    power: 1 + Math.floor(rng() * 4),
    item: '',
    legendary: false,
  };
}

/** power -> ladder rank (the "become strongest" meter) */
export function powerRank(power: number): string {
  const bands = [10, 30, 80, 160, 320, 700, 1500, 3200];
  const names = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSSS'];
  for (let i = 0; i < bands.length; i++) if (power < bands[i]) return names[i];
  return names[names.length - 1];
}
