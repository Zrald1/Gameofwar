/**
 * The Guildmaster — the NPC quest-giver. Each offer comes from a named
 * patron whose temperament picks the difficulty (the "AI assigns the grade").
 * The player replies through chips: take it, bargain, ask for harder, or
 * send them away. Replies mutate the offer before it hits the rail.
 *
 * Dialogue is generated locally (seeded templates = the game brain); when an
 * LLM endpoint is configured the same intents ask it for the line instead,
 * falling back to local text on any failure.
 */
import { genQuest, GRADES, Quest } from './quests.js';
import { mapTileInfo } from './mapdef.js';
import { llmChat } from './brain.js';
import { G } from '../state.js';

export interface NpcPersona {
  id: string;
  name: string;
  title: string;
  /** boost passed to the quest grade roll — the NPC's difficulty appetite */
  boost: number;
  goldMul: number;
  greet: string[];
  bargainOk: string[];
  bargainNo: string[];
  harderOk: string[];
  refuse: string[];
}

export const PERSONAS: NpcPersona[] = [
  {
    id: 'fenwick',
    name: 'Old Fenwick',
    title: 'Keeper of Safe Ledgers',
    boost: 0,
    goldMul: 1.0,
    greet: [
      'Careful work, wanderer. Nothing here will get you killed… probably.',
      'I deal in honest errands. Modest pay, modest peril.',
    ],
    bargainOk: ['A fair ask. Coin is coin — fine, a little extra.'],
    bargainNo: ['The ledger says no. Take it or leave it.'],
    harderOk: ['Hungrier than I thought. Very well — something bolder, then.'],
    refuse: ['Suit yourself. The rail will not stay empty long.'],
  },
  {
    id: 'mira',
    name: 'Mira the Bold',
    title: 'Patron of Deep Expeditions',
    boost: 1,
    goldMul: 1.25,
    greet: [
      'You look like someone who digs where the map goes quiet.',
      'My contracts pay better because they cost more. Interested?',
    ],
    bargainOk: ['Ha! Nerve. I like it. You have your extra coin.'],
    bargainNo: ['My price is my price. The risk is the reward.'],
    harderOk: ['Now you are talking. I keep a drawer for people like you.'],
    refuse: ['Soft hands. Come back when they harden.'],
  },
  {
    id: 'vex',
    name: 'Vex of the Ninth Seal',
    title: 'Dealer in Impossible Deeds',
    boost: 2,
    goldMul: 1.6,
    greet: [
      'I offer what others hide — S-grades, relic hunts, legend work.',
      'The rail below holds errands. Mine hold destinies.',
    ],
    bargainOk: ['You bargain with the Ninth Seal and LIVE? Entertaining. Done.'],
    bargainNo: ['I do not haggle. I choose.'],
    harderOk: ['Careful what you ask for. I was hoping you would say that.'],
    refuse: ['The Seal forgets you already.'],
  },
];

export interface NpcOffer {
  npc: NpcPersona;
  quest: Quest;
  greeting: string;
  /** card slot this offer feeds when accepted (-1 = none yet) */
  slot: number;
  /** the last thing the patron said (greeting, then replies) */
  line: string;
  /** chips state */
  bargained: boolean;
  hardened: boolean;
}

let offerSeq = 0;

/** the guild sends a patron with a quest — difficulty chosen by the NPC */
export function makeOffer(ci: number, cj: number): NpcOffer {
  const npc = PERSONAS[Math.floor(G.rng() * PERSONAS.length)];
  const q = genQuest(G.rng, G.seed, G.nextQuestId++, ci, cj, npc.boost, mapTileInfo);
  q.rewardGold = Math.round(q.rewardGold * npc.goldMul);
  const greeting = npc.greet[offerSeq++ % npc.greet.length];
  return { npc, quest: q, greeting, slot: -1, line: greeting, bargained: false, hardened: false };
}

export type ReplyIntent = 'take' | 'bargain' | 'harder' | 'refuse';

export interface ReplyResult {
  /** what the player chose, resolved */
  intent: ReplyIntent;
  line: string;
  /** 'take' -> quest accepted; 'refuse'/'withdrawn' -> offer gone; else pending */
  outcome: 'accept' | 'pending' | 'withdrawn';
}

/**
 * Resolve a player reply. Local rules are authoritative — the LLM (when
 * configured) only voices the same outcome, so cheating it is impossible.
 */
export async function reply(o: NpcOffer, intent: ReplyIntent): Promise<ReplyResult> {
  const { npc, quest } = o;
  let outcome: ReplyResult['outcome'] = 'pending';
  let line: string;
  if (intent === 'take') {
    outcome = 'accept';
    line = `${npc.name}: Good. The map has your scent now — go.`;
  } else if (intent === 'refuse') {
    outcome = 'withdrawn';
    line = `${npc.name}: ${npc.refuse[Math.floor(G.rng() * npc.refuse.length)]}`;
  } else if (intent === 'bargain') {
    if (o.bargained) {
      line = `${npc.name}: We already settled. Do not push it.`;
    } else {
      o.bargained = true;
      if (G.rng() < 0.75) {
        const bonus = Math.round(quest.rewardGold * 0.25);
        quest.rewardGold += bonus;
        line = `${npc.name}: ${npc.bargainOk[0]} (+${bonus}g)`;
      } else {
        line = `${npc.name}: ${npc.bargainNo[0]}`;
      }
    }
  } else {
    // 'harder' — re-grade the same quest upward once; better loot odds
    if (o.hardened) {
      line = `${npc.name}: It is already as sharp as it gets. Take it or leave it.`;
    } else {
      o.hardened = true;
      if (quest.gradeIdx < GRADES.length - 1) {
        quest.gradeIdx += 1;
        const scale = Math.pow(quest.gradeIdx + 1, 1.6);
        quest.rewardGold = Math.round((18 * scale + 10) * npc.goldMul);
        quest.rewardPower = Math.round(4 * scale);
        quest.legendary = quest.gradeIdx >= 6 || quest.legendary;
        line = `${npc.name}: ${npc.harderOk[0]} [${GRADES[quest.gradeIdx]}]`;
      } else {
        line = `${npc.name}: There is nothing harder. SSSS is the ceiling of the world.`;
      }
    }
  }
  // LLM voice override — same resolved outcome, richer line. Local stays fallback.
  const llmLine = await llmChat([
    {
      role: 'system',
      content:
        `You are ${npc.name}, ${npc.title}, a quest-giving patron in a tabletop ` +
        `fantasy game. The player just chose "${intent}" on an offer for a ` +
        `${GRADES[quest.gradeIdx]}-grade quest "${quest.title}". Outcome: ${outcome}. ` +
        `Reply with ONE short in-character line (max 20 words), second person.`,
    },
    { role: 'user', content: `intent=${intent}` },
  ]);
  if (llmLine) line = `${npc.name}: ${llmLine}`;
  return { intent, line, outcome };
}
