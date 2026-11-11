/**
 * VoiceSystem - talk to the Guildmaster. Hold the "Talk" chip (a user gesture,
 * which mic permission needs), speak, and the transcript routes two ways:
 *
 * - intent words ("take it", "harder", "bargain", "leave") resolve the live
 *   offer through the same npcReply path as the chips - works fully offline;
 * - anything else is free speech to the patron: it goes to the LLM when one is
 *   configured, else the patron answers in-character from local lines.
 *
 * The NPC speaks back with speechSynthesis whenever a line is produced.
 */
import { createSystem } from '@iwsdk/core';
import { emit, feed, G, on, RACES } from '../state.js';
import { llmChat } from '../gen/brain.js';
import { GRADES } from '../gen/quests.js';
import { wizTip } from '../gen/wizard.js';

type SRResult = { results: { [i: number]: { [i: number]: { transcript: string } } } };
type SR = {
  new (): {
    lang: string;
    interimResults: boolean;
    onresult: ((e: SRResult) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
    start(): void;
    stop(): void;
  };
};

const INTENT_WORDS: [RegExp, 'take' | 'bargain' | 'harder' | 'refuse'][] = [
  [/\b(take|accept|deal|ink|sign)\b/i, 'take'],
  [/\b(bargain|haggle|more gold|pay more)\b/i, 'bargain'],
  [/\b(harder|tougher|stronger|legendary|difficult)\b/i, 'harder'],
  [/\b(refuse|leave|away|no thanks|pass)\b/i, 'refuse'],
];

export class VoiceSystem extends createSystem({}) {
  private rec: InstanceType<SR> | null = null;
  private speaking = false;

  init(): void {
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      on('voiceToggle', () => feed('This browser has no speech recognizer - use the chips.'));
      on('npcLine', (l: string) => this.say(l));
      on('wizardLine', (l: string) => this.sayWiz(l));
      return;
    }
    this.rec = new (Ctor as SR)();
    this.rec.lang = 'en-US';
    this.rec.interimResults = false;
    this.rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript ?? '';
      if (text) void this.heard(text);
    };
    this.rec.onerror = (e) => {
      if (e?.error !== 'no-speech') feed(`Mic: ${e?.error ?? 'error'} - chips still work.`);
      this.speaking = false;
      G.hudDirty = true;
    };
    this.rec.onend = () => {
      this.speaking = false;
      G.hudDirty = true;
    };
    on('voiceToggle', () => this.toggle());
    // every line a patron produces gets voiced
    on('npcLine', (l: string) => this.say(l));
    // the Wizard speaks in a deeper, slower voice than the patrons
    on('wizardLine', (l: string) => this.sayWiz(l));
    on('npcOffer', (o: { npc?: { name?: string }; greeting?: string }) => {
      this.say(`${o?.npc?.name ?? 'A patron'} says: ${o?.greeting ?? 'work awaits'}`);
    });
  }

  private toggle(): void {
    if (!this.rec) return;
    if (this.speaking) {
      this.rec.stop();
      return;
    }
    try {
      this.rec.start();
      this.speaking = true;
      feed('Listening... speak to the patron.');
    } catch {
      /* already running */
    }
    G.hudDirty = true;
  }

  private async heard(text: string): Promise<void> {
    feed(`You: "${text}"`);
    // Morvane asked who you wish to be - a spoken race name answers him
    if (G.raceOpen) {
      const i = RACES.findIndex((r) => new RegExp(`\\b${r}\\b`, 'i').test(text));
      if (i >= 0) emit('pickRace', i);
      else emit('wizardLine', `Name a bloodline, wanderer - ${RACES.join(', ')}.`);
      return;
    }
    for (const [re, intent] of INTENT_WORDS) {
      if (re.test(text) && G.offer) {
        emit('npcReply', intent);
        return;
      }
    }
    // free speech - the patron answers a live offer; Morvane otherwise
    const o = G.offer;
    if (!o) {
      const out = await llmChat(
        [
          {
            role: 'system',
            content:
              'You are Morvane, Keeper of the Fold, an ancient wizard guiding a ' +
              'player through a tabletop fantasy map game. Answer in ONE short ' +
              'line (max 20 words) - warm, wise, a little theatrical. Teach them ' +
              'the world when you can.',
          },
          { role: 'user', content: text },
        ],
        80,
      );
      if (out) emit('wizardLine', `The Wizard: ${out}`);
      else wizTip();
      G.hudDirty = true;
      return;
    }
    const sys =
      `You are ${o.npc.name}, ${o.npc.title}, a quest patron offering a ` +
      `${GRADES[o.quest.gradeIdx]}-grade quest "${o.quest.title}" ` +
      `(+${o.quest.rewardGold}g +${o.quest.rewardPower}p). ` +
      `Answer the adventurer in ONE short in-character line (max 20 words). ` +
      `You may only discuss the contract; never break character.`;
    const out = await llmChat(
      [
        { role: 'system', content: sys },
        { role: 'user', content: text },
      ],
      80,
    );
    const line = out ?? `${o.npc.name}: Words are wind, wanderer - the chips decide contracts.`;
    o.line = out ? `${o.npc.name}: ${out}` : line;
    emit('npcLine', line.startsWith(o.npc.name) ? line : `${o.npc.name}: ${out ?? line}`);
    G.hudDirty = true;
  }

  private say(line: string): void {
    this.speak(line, 1.05, 0.9);
  }

  /** elder voice - deeper and slower than a patron's */
  private sayWiz(line: string): void {
    this.speak(line, 0.92, 0.6);
  }

  private speak(line: string, rate: number, pitch: number): void {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      // serialize game speech: a re-voice replaces the local line mid-word
      synth.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.rate = rate;
      u.pitch = pitch;
      synth.speak(u);
    } catch {
      /* no tts */
    }
  }
}
