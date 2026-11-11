/**
 * Central mutable game state - a plain module singleton shared by all
 * systems (kept out of ECS because it is singular, high-churn state).
 * Deterministic parts (terrain, quests) rebuild from `seed` + coords.
 */
import { mulberry32 } from './gen/prng.js';
import { Quest, rollLoot, powerRank } from './gen/quests.js';
import type { Weapon } from './gen/loot.js';
import type { MapDef } from './gen/mapdef.js';
import type { Object3D } from '@iwsdk/core';

/** runtime scene objects resolved at init: node-id -> Object3D */
export const Anchors = new Map<string, Object3D>();

export const RACES = ['Human', 'Dwarf', 'Elf', 'Naga', 'Demon'] as const;
export type Race = (typeof RACES)[number];

export const RACE_COLORS: Record<Race, number> = {
  Human: 0x4f8fd8,
  Dwarf: 0xd8a54f,
  Elf: 0x6fd88a,
  Naga: 0x4fd8c8,
  Demon: 0xd84f4f,
};

/** flavor bonus line shown on the race buttons */
export const RACE_PERKS: Record<Race, string> = {
  Human: '+15% quest rewards',
  Dwarf: '+gold on digs',
  Elf: '+power on surveys',
  Naga: '+luck on ocean digs',
  Demon: '+power everywhere',
};

export type Phase = 'race' | 'playing';

export interface GameState {
  phase: Phase;
  race: Race | null;
  seed: number;
  rng: () => number;
  gold: number;
  power: number;
  /** leveling: xp drives level; level adds a small luck edge */
  xp: number;
  level: number;
  /** weapon arsenal; equipped = index of the wielded one (-1 none) */
  inventory: Weapon[];
  equipped: number;
  /** the guildmaster offer currently on the table (null = none pending) */
  offer: import('./gen/npc.js').NpcOffer | null;
  /** champion logical tile */
  ci: number;
  cj: number;
  /** world tile at grid center */
  centerI: number;
  centerJ: number;
  /** tiles being rebuilt flag for systems */
  terrainDirty: boolean;
  quests: Map<number, Quest>;
  /** questIds whose cards were accepted (objective live) */
  activeQuests: Set<number>;
  /** card slot -> questId (-1 empty) */
  cardSlots: number[];
  nextQuestId: number;
  /** active dig sites: id -> tile */
  digs: { id: number; questId: number; i: number; j: number }[];
  nextDigId: number;
  /** dig entry the X marker currently tracks (nearest to champion) */
  activeDigId: number;
  /** free-treasure dig (the held scroll's X) */
  freeDig: { i: number; j: number } | null;
  houses: number;
  havenI: number;
  havenJ: number;
  relics: string[];
  incomeAcc: number;
  feed: string[];
  /** loaded authored map (null = pure procedural world) */
  map: MapDef | null;
  mapName: string;
  /** charted expedition names from public/maps/index.json */
  mapList: string[];
  /** cartographer mode: champion becomes the brush cursor */
  editing: boolean;
  /** active palette tool (biome key | road | dig | haven | champ | erase) */
  editTool: string;
  brushR: number;
  /** minecraft build mode: active block material (char from VOX_MATS) */
  buildMat: string;
  /** character creator: meeple tint + headgear */
  charColor: number;
  charHat: string;
  charBack: string;
  /** live peer count from presence */
  peers: number;
  /** cartographer admin unlocked (PIN claimed on this device) */
  admin: boolean;
  /** PIN pad input buffer while the login pad is open */
  pinBuf: string;
  /** set by systems when HUD text needs refresh */
  hudDirty: boolean;
  /** race-select panel showing - voice answers route to pickRace */
  raceOpen: boolean;
  listeners: Map<string, ((...a: any[]) => void)[]>;
}

export const SAVE_KEY = 'atlas-eternal-save-v1';
export const ADMIN_KEY = 'atlas-admin-v1';
export const DEFAULT_MAP_KEY = 'atlas-default-map-v1';

/** local admin claim: first PIN ever entered becomes the device key */
export function adminLogin(pin: string): 'claimed' | 'ok' | 'denied' {
  let stored: string | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(ADMIN_KEY) ?? 'null')?.pin ?? null;
  } catch { /* private mode */ }
  if (!stored) {
    if (pin.length < 4) return 'denied';
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ pin, authed: true }));
    } catch { /* private mode */ }
    G.admin = true;
    return 'claimed';
  }
  if (stored === pin) {
    G.admin = true;
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ pin: stored, authed: true }));
    } catch { /* private mode */ }
    return 'ok';
  }
  return 'denied';
}

/** boot: silently restore admin when this device is already authed */
export function adminRestore(): void {
  try {
    const d = JSON.parse(localStorage.getItem(ADMIN_KEY) ?? 'null');
    if (d?.authed) G.admin = true;
  } catch { /* private mode */ }
}

export function adminLogout(): void {
  G.admin = false;
  try {
    const d = JSON.parse(localStorage.getItem(ADMIN_KEY) ?? 'null');
    if (d) localStorage.setItem(ADMIN_KEY, JSON.stringify({ pin: d.pin, authed: false }));
  } catch { /* private mode */ }
}

/** forget the claimed key entirely (fresh claim next login) */
export function adminReset(): void {
  G.admin = false;
  try {
    localStorage.removeItem(ADMIN_KEY);
  } catch { /* private mode */ }
}

export const G: GameState = {
  phase: 'race',
  race: null,
  seed: 1337,
  rng: mulberry32(1337),
  gold: 0,
  power: 0,
  xp: 0,
  level: 1,
  inventory: [],
  equipped: -1,
  offer: null,
  ci: 0,
  cj: 0,
  centerI: 0,
  centerJ: 0,
  terrainDirty: true,
  quests: new Map(),
  activeQuests: new Set(),
  cardSlots: [-1, -1, -1, -1],
  nextQuestId: 1,
  digs: [],
  nextDigId: 1,
  activeDigId: -1,
  freeDig: null,
  houses: 0,
  havenI: 4,
  havenJ: 3,
  relics: [],
  incomeAcc: 0,
  feed: [],
  map: null,
  mapName: '',
  mapList: [],
  editing: false,
  editTool: 'g',
  brushR: 0,
  buildMat: 's',
  charColor: 0,
  charHat: 'none',
  charBack: 'none',
  peers: 0,
  admin: false,
  pinBuf: '',
  hudDirty: true,
  raceOpen: false,
  listeners: new Map(),
};

export function on(event: string, fn: (...a: any[]) => void): void {
  let l = G.listeners.get(event);
  if (!l) G.listeners.set(event, (l = []));
  l.push(fn);
}
export function emit(event: string, ...a: any[]): void {
  const l = G.listeners.get(event);
  if (l) for (const fn of l) fn(...a);
}

export function feed(msg: string): void {
  G.feed.unshift(msg);
  if (G.feed.length > 4) G.feed.pop();
  G.hudDirty = true;
}

export function addGold(n: number): void {
  G.gold = Math.max(0, G.gold + n);
  G.hudDirty = true;
  save();
}
export function addPower(n: number): void {
  const before = powerRank(G.power);
  G.power += n;
  const after = powerRank(G.power);
  if (after !== before) feed(`Rank up! You are now rank ${after}`);
  G.hudDirty = true;
  save();
}

/** xp thresholds - level N needs 60*N^1.5 cumulative-ish xp */
const XP_STEP = (lv: number) => Math.round(60 * Math.pow(lv, 1.5));
export function addXp(n: number): void {
  G.xp += n;
  while (G.xp >= XP_STEP(G.level)) {
    G.xp -= XP_STEP(G.level);
    G.level++;
    feed(`Level up! You are now Lv ${G.level} - the map respects you more.`);
  }
  G.hudDirty = true;
}

/** power bonus from the equipped weapon (added into dig loot) */
export function weaponPower(): number {
  const w = G.equipped >= 0 ? G.inventory[G.equipped] : null;
  return w ? w.power : 0;
}

/** stow a weapon; auto-equip if it's the strongest thing you own */
export function addWeapon(w: Weapon): void {
  G.inventory.push(w);
  if (G.equipped < 0 || w.power > weaponPower()) {
    G.equipped = G.inventory.length - 1;
  }
  G.hudDirty = true;
  save();
}

/** level luck edge: +0.5% per level, capped at +5% */
export function levelLuck(): number {
  return Math.min(0.05, (G.level - 1) * 0.005);
}

export function raceGoldMul(): number {
  return G.race === 'Human' ? 1.15 : 1;
}
export function digGoldMul(): number {
  return G.race === 'Dwarf' ? 1.4 : 1;
}
export function powerMul(kind: string): number {
  if (G.race === 'Demon') return 1.3;
  if (G.race === 'Elf' && kind === 'survey') return 1.4;
  return 1;
}
export function luckBonus(oceanDig: boolean): number {
  return G.race === 'Naga' && oceanDig ? 0.02 : 0;
}

export function save(): void {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        race: G.race,
        seed: G.seed,
        gold: G.gold,
        power: G.power,
        xp: G.xp,
        level: G.level,
        inventory: G.inventory,
        equipped: G.equipped,
        ci: G.ci,
        cj: G.cj,
        houses: G.houses,
        relics: G.relics,
        map: G.mapName,
        charColor: G.charColor,
        charHat: G.charHat,
        charBack: G.charBack,
      }),
    );
  } catch {
    /* private mode etc. */
  }
}

export function load(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.race) return false;
    G.race = d.race;
    G.seed = d.seed ?? 1337;
    G.rng = mulberry32(G.seed + 77);
    G.gold = d.gold ?? 0;
    G.power = d.power ?? 0;
    G.xp = d.xp ?? 0;
    G.level = d.level ?? 1;
    G.inventory = Array.isArray(d.inventory) ? d.inventory : [];
    G.equipped = typeof d.equipped === 'number' ? d.equipped : -1;
    G.ci = d.ci ?? 0;
    G.cj = d.cj ?? 0;
    G.centerI = G.ci;
    G.centerJ = G.cj;
    G.houses = d.houses ?? 0;
    G.relics = d.relics ?? [];
    G.charColor = d.charColor ?? 0;
    G.charHat = d.charHat ?? 'none';
    G.charBack = d.charBack ?? 'none';
    G.phase = 'playing';
    G.terrainDirty = true;
    feed(`Welcome back, ${G.race} wanderer.`);
    return true;
  } catch {
    return false;
  }
}

export function startRun(race: Race): void {
  G.race = race;
  G.seed = (Date.now() % 100000) | 0;
  G.rng = mulberry32(G.seed + 77);
  G.phase = 'playing';
  G.ci = 0;
  G.cj = 0;
  G.centerI = 0;
  G.centerJ = 0;
  G.havenI = 4;
  G.havenJ = 3;
  G.terrainDirty = true;
  feed(`${race} soul bound. The map awakens...`);
  save();
}
