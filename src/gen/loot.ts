/**
 * Weapon + gear loot ladder. Every loot roll lands on a rarity tier:
 * normal gear drops constantly (near 100% of rolls produce *something*),
 * while mythic weapons sit at a 0.1% floor - reachable at any level, as the
 * spec asks, with the odds pushed up by quest grade and lucky triggers.
 */
import type { Grade } from './quests.js';

export const RARITIES = ['Normal', 'Fine', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_COLORS = [
  '#9aa4b8', // Normal
  '#5fae6a', // Fine
  '#4f8fd8', // Rare
  '#9b6fe0', // Epic
  '#e07830', // Legendary
  '#ffe95e', // Mythic
];

/** base rarity weights - index 0..5; Mythic floor is 0.1% as specified */
const BASE_W = [62, 23, 9.4, 4, 1.5, 0.1];

const TIERS: Record<Rarity, { names: string[]; minP: number; maxP: number }> = {
  Normal: {
    names: ['Rusty Shortsword', 'Oak Cudgel', 'Squire\'s Dirk', 'Worn Hand-Axe',
      'Militia Spear', 'Tin Buckler', 'Pitchfork of Valor', 'Hunter\'s Bow'],
    minP: 2, maxP: 8,
  },
  Fine: {
    names: ['Iron Longsword', 'Ranger\'s Recurve', 'Ward of the Ford',
      'Silvered Dagger', 'Forester\'s Axe', 'Bronze Mace', 'Sailor\'s Cutlass'],
    minP: 9, maxP: 20,
  },
  Rare: {
    names: ['Knight\'s Oath', 'Stormforged Pike', 'Moonlit Edge', 'Emberbrand',
      'Shield of the Reach', 'Gravecaller Wand', 'Tidehunter\'s Trident'],
    minP: 21, maxP: 45,
  },
  Epic: {
    names: ['Dawnbreaker', 'Wyrmwood Bow', 'Aegis of the Deep', 'Runebrand',
      'Hammer of the First Forge', 'Shadowveil Blade', 'Sunspire Scepter'],
    minP: 46, maxP: 95,
  },
  Legendary: {
    names: ['Starfall Blade', 'The Cartographer\'s Compass', 'Demon King\'s Fang',
      'Heartstring Bow', 'Worldrender', 'Aegis Eternal', 'Voidtouched Scepter'],
    minP: 96, maxP: 220,
  },
  Mythic: {
    names: ['Atlas, the Living Edge', 'Pen of the First Cartographer',
      'The Map That Folds Worlds', 'Crown-of-All-Roads'],
    minP: 221, maxP: 500,
  },
};

export interface Weapon {
  name: string;
  rarity: Rarity;
  power: number;
  /** quest grade that produced it ('' for free digs) */
  origin: string;
}

/**
 * Roll a weapon. `gradeIdx` (-1 for free digs) shifts the rarity window up:
 * each grade above D moves ~40% of the lower tier's mass two tiers up, so an
 * SSSS quest rolls almost entirely Epic..Mythic while a D still floors at
 * 0.1% Mythic - a low-level lucky drop is possible on any roll.
 */
export function rollWeapon(rng: () => number, gradeIdx = -1, origin: Grade | '' = ''): Weapon {
  const w = BASE_W.slice();
  const boost = Math.max(0, gradeIdx);
  for (let i = 0; i < boost * 2 && i < w.length - 1; i++) {
    const moved = w[i] * 0.4;
    w[i] -= moved;
    w[Math.min(i + 2, w.length - 1)] += moved;
  }
  let total = 0;
  for (const x of w) total += x;
  let r = rng() * total;
  let tier = 0;
  for (; tier < w.length - 1; tier++) {
    r -= w[tier];
    if (r <= 0) break;
  }
  const rarity = RARITIES[tier];
  const t = TIERS[rarity];
  return {
    name: t.names[Math.floor(rng() * t.names.length)],
    rarity,
    power: t.minP + Math.floor(rng() * (t.maxP - t.minP + 1)),
    origin,
  };
}

/** probability (%) a weapon drops at all, by quest grade (-1 = free dig) */
export function weaponDropChance(gradeIdx: number): number {
  if (gradeIdx < 0) return 0.35; // free treasure dig
  return Math.min(0.25 + gradeIdx * 0.12, 0.95);
}
