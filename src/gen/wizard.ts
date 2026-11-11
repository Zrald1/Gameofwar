/**
 * The Wizard - the game's guide figure. He greets the player at the intro,
 * asks who they wish to be at race select, and quips on the choice.
 * Local seeded lines are authoritative; when an LLM endpoint is configured
 * the same intent asks it for a fresh line in the background (BYOK - the
 * game never hard-depends on a key).
 */
import { llmChat } from './brain.js';
import { emit, G, on } from '../state.js';

const GREETS = [
  'Ah - a new soul at the table. I am Morvane, Keeper of the Fold.',
  'Welcome, traveler. I keep this little world. It has been waiting for you.',
  'The map woke when you arrived. So did I. Morvane, at your service.',
];

const ASKS = [
  'Now - who do you wish to be?',
  'Tell me, wanderer: whose feet will carry you?',
  'Five souls wait on the parchment. Choose the one that is yours.',
];

const QUIPS: Record<string, string[]> = {
  Human: [
    'A human! Stubborn, quick, gold-hungry. The map likes your kind.',
    'Human again - the fold knows your people well. Wander far, return richer.',
    'Ah, a human heart. They burn short and bright - spend yours on the deep dig sites.',
  ],
  Dwarf: [
    'A dwarf! Good. The deep places owe you a debt already.',
    'Dwarf - the stone will tell you its secrets before it tells anyone.',
    'Under that beard beats a delver\'s heart. The X marks will not hide from you.',
  ],
  Elf: [
    'An elf - the forests will whisper your name before you earn it.',
    'Elf. The fold grows quieter when you walk it - listen to what it says.',
    'An elven step leaves no mark, yet the map remembers every one.',
  ],
  Naga: [
    'A naga! The rivers remember you, even if the maps do not.',
    'Naga - the water roads are yours. Even the ocean tiles will part for you.',
    'A river-soul. The fold twists like a current - you already know how to ride it.',
  ],
  Demon: [
    'A demon. Bold choice. Even the X marks tread carefully now.',
    'Demon - the fold\'s old wards twitch at your passing. Let them.',
    'Fire in the blood, wanderer. The patrons will pay to see what you do with it.',
  ],
};

let seq = 0;

/** rotating pick - same sequencer as voice(), so repeated pokes rephrase */
function pick(lines: string[]): string {
  return lines[(seq++) % lines.length];
}

function voice(lines: string[], prompt: string): void {
  emit('wizardLine', `The Wizard: ${lines[(seq++) % lines.length]}`);
  // LLM re-voice in the background - local line already landed
  void llmChat([
    {
      role: 'system',
      content:
        'You are Morvane, an ancient but kindly wizard guiding a player through ' +
        'a tabletop fantasy map game. Reply with ONE short in-character line ' +
        '(max 16 words), second person, no stage directions.',
    },
    { role: 'user', content: prompt },
  ]).then((l) => {
    if (l) emit('wizardLine', `The Wizard: ${l}`);
  });
}

/** intro shown - the wizard introduces himself */
export function wizGreet(): void {
  void G;
  voice(GREETS, 'greet the player arriving at your map table for the first time');
}

/** race select shown - the wizard asks who they want to be */
export function wizAsk(): void {
  voice(ASKS, 'ask the player which soul they wish to be - five races await');
}

/** a race was chosen - the wizard reacts */
export function wizQuip(race: string): void {
  voice(QUIPS[race] ?? QUIPS.Human, `the player chose to be a ${race} - react warmly`);
}

/**
 * The explainer verb - poke the wizard any time. He reads the table and
 * tells you the one thing that matters right now.
 */
export function wizTip(): void {
  let tip: string;
  let aim = ''; // anchor id the Wizard turns toward while he speaks
  if (G.editing) {
    tip = pick([
      'The land obeys your stamps. Fist-punch to raise a block; open palm to knock it down. Export when the world pleases you.',
      'Cartographer\'s hands - a fist lays stone, an open palm unmakes it. The map is clay.',
    ]);
  } else if (G.offer) {
    aim = 'patron';
    tip = pick([
      `The patron waits on your answer - thumbs-up to take the contract, open palm to send them away, or tap a reply on the panel.`,
      'The hooded one holds a contract open. Thumb up to ink it, palm out to refuse - or speak your answer.',
    ]);
  } else if (G.activeDigId >= 0) {
    aim = 'dig-x';
    tip = pick([
      'The X burns on a marked tile. Carry your champion beside it, then punch the X - treasure lies under it.',
      'See the X smolder? Stand your champion beside it and strike the mark - the fold will open.',
    ]);
  } else if (G.houses <= 0) {
    aim = 'haven';
    tip = pick([
      'You have no haven yet. Walk the road to the golden ring and press it - a home earns while you wander.',
      'A wanderer without a haven earns nothing between adventures. The golden ring waits.',
    ]);
  } else {
    const open = [...G.quests.values()].filter((q) => !q.done).length;
    aim = open > 0 ? 'beacon' : 'wish';
    tip = open > 0
      ? pick([
          `${open} contract${open > 1 ? 's' : ''} ride the rail. The glowing beacon marks the nearest task - or ask the patron for another.`,
          `${open} unfinished contract${open > 1 ? 's' : ''} wait on the rail. Follow the beacon's light.`,
        ])
      : pick([
          'The rail is empty. Press the wish crystal, or beckon the patron - the guild always finds work for idle hands.',
          'Quiet rails. The wish crystal deals quests - or summon a patron and choose your difficulty.',
        ]);
  }
  emit('wizardAim', aim);
  emit('wizardLine', `The Wizard: ${tip}`);
  void llmChat([
    {
      role: 'system',
      content:
        'You are Morvane, an ancient but kindly wizard guiding a player through ' +
        'a tabletop fantasy map game. Reply with ONE short in-character tip ' +
        '(max 18 words), second person, no stage directions.',
    },
    {
      role: 'user',
      content:
        `the player poked you for advice. Situation: editing=${G.editing}, ` +
        `offerLive=${!!G.offer}, digActive=${G.activeDigId >= 0}, ` +
        `havenLevel=${G.houses}, openQuests=${[...G.quests.values()].filter((q) => !q.done).length}. ` +
        `Local tip was: "${tip}". Re-voice it better.`,
    },
  ]).then((l) => {
    if (l) emit('wizardLine', `The Wizard: ${l}`);
  });
}

/* ---------- first-run tutorial ----------
 * On the very first runStarted the Wizard walks the player through the
 * core loop in four steps. Each step aims him at the thing it teaches and
 * advances early when the player does it (travel / wish) - a hold timer
 * moves on regardless so the lesson never stalls. Lines are deterministic
 * on purpose: a tutorial should read the same for every new player. */
const TUT_KEY = 'atlas-tut-v1';
const TUT_STEPS: { aim: string; line: string; advance?: string; hold: number }[] = [
  { aim: '', line: 'A first crossing? Keep an ear on the rim - I will walk you through it.', hold: 4.5 },
  { aim: 'champion', line: 'Pinch your blue meeple and carry him past the map edge - the world scrolls under his feet.', advance: 'travel', hold: 16 },
  { aim: 'wish', line: 'The crystal on the far rim deals quests. Press it, then press a dealt card to take the work.', advance: 'wish', hold: 14 },
  { aim: 'patron', line: 'And that hooded one is a guild patron. Point at him - thumbs-up takes a contract, open palm refuses.', hold: 10 },
  { aim: '', line: 'That is the whole art, wanderer. Poke me whenever you are lost.', hold: 0 },
];
let tutIdx = -1;
let tutTimer: ReturnType<typeof setTimeout> | null = null;

const tutDone = (): boolean => {
  try {
    return localStorage.getItem(TUT_KEY) === '1';
  } catch {
    return true; // private mode - do not nag
  }
};
const tutMark = (): void => {
  try {
    localStorage.setItem(TUT_KEY, '1');
  } catch {
    /* private mode */
  }
};

function tutSpeak(i: number): void {
  const s = TUT_STEPS[i];
  if (!s) {
    tutIdx = -1;
    tutMark();
    return;
  }
  tutIdx = i;
  emit('wizardAim', s.aim);
  emit('wizardLine', `The Wizard: ${s.line}`);
  if (tutTimer) clearTimeout(tutTimer);
  if (i + 1 < TUT_STEPS.length) {
    tutTimer = setTimeout(() => tutSpeak(i + 1), s.hold * 1000);
  } else {
    tutTimer = null;
    tutMark();
  }
}

function tutAdvance(ev: string): void {
  const s = TUT_STEPS[tutIdx];
  if (s?.advance === ev) tutSpeak(tutIdx + 1);
}

/** replay the lesson on demand - fist-bump the wizard or press T */
export function replayTutorial(): void {
  if (tutTimer) clearTimeout(tutTimer);
  tutTimer = setTimeout(() => tutSpeak(0), 1200);
}

let tutArmed = false;
/** subscribe the tutorial to the game bus - called once on app boot */
export function armTutorial(): void {
  if (tutArmed) return;
  tutArmed = true;
  on('runStarted', () => {
    if (tutDone()) return;
    if (tutTimer) clearTimeout(tutTimer);
    // let the race quip land before the lesson starts
    tutTimer = setTimeout(() => tutSpeak(0), 4000);
  });
  on('travel', () => tutAdvance('travel'));
  on('wish', () => tutAdvance('wish'));
  armReactions();
}

/* ---------- milestone reactions ----------
 * A great guide notices your deeds - one commemorative line per milestone,
 * once per session, so he stays a presence instead of a parrot. */
const REACTS: [string, string, (a?: unknown) => string, ((a?: unknown) => boolean)?][] = [
  ['questAccept', 'beacon', () => pick(['The contract is inked. The beacon marks your task - the guild watches how you keep your word.', 'Signed in guild ink. The beacon lights the way - do not keep them waiting.'])],
  ['havenBuilt', 'haven', () => pick(['A haven rises on the fold. Walls remember their builders, wanderer.', 'A haven! Even wandering souls need a door that is theirs.'])],
  ['npcOffer', 'patron', () => pick(['A patron approaches. Weigh the reward against the risk before you answer.', 'Hooded and waiting. Read the grade before your thumb decides.'])],
  ['freeDigSpent', 'dig-x', () => pick(['The earth gives up its secret. Spend the spoils well - the fold provides.', 'What the fold buried, the fold gives back. Spend it boldly.'])],
  ['levelUp', '', (lv) => pick([`Level ${lv} - the fold acknowledges your growth. Even the stones bow a little.`, `Level ${lv}. The map tilts toward you now - feel it?`])],
  ['questDone', 'beacon', (g) =>
    pick([`Contract fulfilled at ${g}-grade. Word of you travels the fold now - the guild will offer harder work.`, `${g}-grade, done and dusted. The guild has noticed - harder contracts will follow.`])],
  ['weaponDrop', 'champion', (r) =>
    r === 'Mythic' || r === 'Legendary'
      ? `A ${r} relic! The fold hides such things for the worthy - wield it and be remembered.`
      : 'Steel answers the fold\'s call. Wield it well, wanderer.'],
  ['relicFound', 'champion', (item) => `${item}! A relic of the old world - few hands have ever held one. Guard it well.`],
  ['pinOk', '', () => pick(['The seal opens - you carry the Cartographer\'s eye now. Shape the world gently, or boldly.', 'Admin rights, wanderer. The land now answers to your hand.'])],
  ['travel', 'champion', () => pick(['The world folds beneath your feet - the map is endless, wanderer.', 'The rim folds and the world walks with you. There is no edge, only more map.']), () => tutIdx < 0],
  ['editMode', '', () => pick(['The cartographer\'s eye opens. Stamp the land as you will - fist raises, palm fells.', 'The world becomes clay. Fist to raise it, palm to take it back.']), (a) => !!a],
];

let reactArmed = false;
function armReactions(): void {
  if (reactArmed) return;
  reactArmed = true;
  const seen = new Set<string>();
  for (const [ev, aim, line, guard] of REACTS) {
    on(ev, (a?: unknown) => {
      if (seen.has(ev) || (guard && !guard(a))) return;
      seen.add(ev);
      if (aim) emit('wizardAim', aim);
      emit('wizardLine', `The Wizard: ${line(a)}`);
    });
  }

  // ambient presence - after a long silence he mutters a world-observation,
  // a few times a session at most, and never over his own voice
  const IDLE_LINES = [
    'The map breathes, wanderer - even idle, the fold shifts under you.',
    'Somewhere past the rim, an X waits unmarked. The world is larger than the table.',
    'Your haven earns while you rest. Idle hands still gather.',
    'The patrons gossip about you. Good things, mostly.',
    'I once folded a kingdom into a matchbox. This map is a gentler magic.',
  ];
  let lastLine = Date.now();
  let idleCount = 0;
  on('wizardLine', () => {
    lastLine = Date.now();
  });
  setInterval(() => {
    if (G.phase !== 'playing' || G.editing) return;
    if (Date.now() - lastLine < 140_000 || idleCount >= IDLE_LINES.length) return;
    emit('wizardLine', `The Wizard: ${IDLE_LINES[idleCount++]}`);
  }, 30_000);
}
