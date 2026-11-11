/**
 * Effort-grown skills. The game watches what you actually DO in VR -
 * walk, dig, punch, quest, talk, wish - and each track ripens into a
 * named skill when its effort crosses a threshold. The roll of WHICH
 * talent wakes is seeded-random; the name is woven from your bloodline,
 * so two players who live differently grow different arts.
 */
import { emit, feed, G } from '../state.js';

export type SkillTrack = 'walk' | 'dig' | 'punch' | 'quest' | 'talk' | 'wish';

export interface Skill {
  id: string;
  track: SkillTrack;
  /** display name, e.g. "Sylph Stride" */
  name: string;
  /** count of skills held on this track AFTER this grant (1-based) */
  level: number;
}

/** effort needed to earn level N on a track: base * N^1.6 */
const REQ: Record<SkillTrack, number> = {
  walk: 30,
  dig: 2,
  punch: 6,
  quest: 1,
  talk: 2,
  wish: 1,
};

/** bloodline adjective woven into every name the race grows */
const RACE_ADJ: Record<string, string> = {
  Human: 'Guildforged',
  Dwarf: 'Deepforge',
  Elf: 'Sylph',
  Naga: 'Tidewoven',
  Demon: 'Ashen',
};

/** three talent nouns per track - the rng picks which one wakes */
const TRACK_NOUNS: Record<SkillTrack, string[]> = {
  walk: ['Stride', 'Trailcraft', 'Horizon-Sense'],
  dig: ['Delver-Hand', 'X-Sight', 'Loam-Luck'],
  punch: ['Knuckle-Oath', 'Impact Verse', 'Guard-Breaker'],
  quest: ['Contract Lore', 'Oathcraft', 'Seal-Sense'],
  talk: ['Silver Tongue', 'Bargain-Ear', 'Parley'],
  wish: ['Wishweaver', 'Star-Ear', 'Ink-Calling'],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function trackLevel(track: SkillTrack): number {
  return G.skills.filter((s) => s.track === track).length;
}

/** how strong a track's passive is right now (0 = unlearned) */
export function skillLevel(track: SkillTrack): number {
  return trackLevel(track);
}

/**
 * Called whenever an effort counter grows. Each time a track's effort
 * crosses the next threshold a new talent wakes - noun picked at random
 * from the unlearned pool, prefixed by the bloodline adjective.
 */
export function bumpEffort(track: SkillTrack, n = 1): void {
  G.effort[track] += n;
  for (;;) {
    const lv = trackLevel(track);
    if (G.effort[track] < Math.round(REQ[track] * Math.pow(lv + 1, 1.6))) break;
    const pool = TRACK_NOUNS[track].filter(
      (noun) => !G.skills.some((s) => s.track === track && s.name.endsWith(noun)),
    );
    const noun =
      pool.length > 0 ? pool[Math.floor(G.rng() * pool.length)] : `${ROMAN[lv] ?? lv + 1}-Fold Mastery`;
    const adj = RACE_ADJ[G.race ?? 'Human'] ?? 'Fated';
    const skill: Skill = {
      id: `${track}-${G.skills.length}-${Math.floor(G.rng() * 1e6)}`,
      track,
      name: `${adj} ${noun}`,
      level: lv + 1,
    };
    G.skills.push(skill);
    feed(`A talent wakes from your deeds - ${skill.name} (${track} Lv${skill.level})`);
    emit('skillUp', skill);
    G.hudDirty = true;
  }
}

// ---------- the passives these skills actually buy ----------

/** walk: the land teaches - xp when the fold recenters under you */
export function walkLoreXp(): number {
  return skillLevel('walk') * 4;
}

/** dig: +15% dig gold per level */
export function digGoldBonus(): number {
  return 1 + skillLevel('dig') * 0.15;
}

/** punch: chance a thrown fist rings power out of the world */
export function punchPowerChance(): number {
  return skillLevel('punch') * 0.08;
}

/** quest: +10% contract gold per level */
export function questGoldBonus(): number {
  return 1 + skillLevel('quest') * 0.1;
}

/** talk: chance the patron opens one grade kinder */
export function talkGradeChance(): number {
  return skillLevel('talk') * 0.15;
}

/** wish: each level deepens the wish's reach (deal boost) */
export function wishBoost(): number {
  return skillLevel('wish');
}
