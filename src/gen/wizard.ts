/**
 * The Wizard - the game's guide figure. He greets the player at the intro,
 * asks who they wish to be at race select, and quips on the choice.
 * Local seeded lines are authoritative; when an LLM endpoint is configured
 * the same intent asks it for a fresh line in the background (BYOK - the
 * game never hard-depends on a key).
 */
import { llmChat } from './brain.js';
import { emit, G } from '../state.js';

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
  Human: ['A human! Stubborn, quick, gold-hungry. The map likes your kind.'],
  Dwarf: ['A dwarf! Good. The deep places owe you a debt already.'],
  Elf: ['An elf - the forests will whisper your name before you earn it.'],
  Naga: ['A naga! The rivers remember you, even if the maps do not.'],
  Demon: ['A demon. Bold choice. Even the X marks tread carefully now.'],
};

let seq = 0;

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
  if (G.editing) {
    tip = 'The land obeys your stamps. Fist-punch to raise a block; open palm to knock it down. Export when the world pleases you.';
  } else if (G.offer) {
    tip = `The patron waits on your answer - thumbs-up to take the contract, open palm to send them away, or tap a reply on the panel.`;
  } else if (G.activeDigId >= 0) {
    tip = 'The X burns on a marked tile. Carry your champion beside it, then punch the X - treasure lies under it.';
  } else if (G.houses <= 0) {
    tip = 'You have no haven yet. Walk the road to the golden ring and press it - a home earns while you wander.';
  } else {
    const open = [...G.quests.values()].filter((q) => !q.done).length;
    tip = open > 0
      ? `${open} contract${open > 1 ? 's' : ''} ride the rail. The glowing beacon marks the nearest task - or ask the patron for another.`
      : 'The rail is empty. Press the wish crystal, or beckon the patron - the guild always finds work for idle hands.';
  }
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
