/**
 * HudSystem - the UIKitML panel: race select, champion stats, quest rail
 * status, event feed, Return Home / New Expedition buttons, and the
 * XR enter/exit buttons (scaffold pattern).
 */
import { createSystem, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import { GRADES, powerRank, QuestKinds } from '../gen/quests.js';
import { clearDefaultMap, nextMap, saveDefaultMap, VOX_DEFS } from '../gen/mapdef.js';
import { commissionTheGuild } from '../gen/architect.js';
import { armTutorial, replayTutorial, wizAsk, wizGreet, wizQuip } from '../gen/wizard.js';
import { applyCharacter, BACKS, charName, CHAR_COLORS, HATS, RACE_HATS } from '../character.js';
import {
  adminLogin,
  adminLogout,
  adminRestore,
  emit,
  on,
  feed,
  G,
  load,
  RACE_COLORS,
  RACES,
  RACE_PERKS,
  save,
  SAVE_KEY,
  startRun,
} from '../state.js';

export class HudSystem extends createSystem({}) {
  private panel?: UIKitMLAsset;

  init(): void {
    this.panel = this.world.getSceneObject<UIKitMLAsset>('hud-panel');
    const p = this.panel;
    if (!p) return;
    const xrButton = p.getElementById('xr-button');
    const exitButton = p.getElementById('exit-button');
    if (xrButton && exitButton) {
      if (!this.world.xrEnabled) {
        xrButton.setProperties({ display: 'none' });
        exitButton.setProperties({ display: 'none' });
      } else {
        const launchXR = () => this.world.launchXR();
        const exitXR = () => this.world.exitXR();
        xrButton.addEventListener('click', launchXR);
        exitButton.addEventListener('click', exitXR);
        this.cleanupFuncs.push(
          () => xrButton.removeEventListener('click', launchXR),
          () => exitButton.removeEventListener('click', exitXR),
          this.world.visibilityState.subscribe((s) => {
            const is2D = s === VisibilityState.NonImmersive;
            xrButton.setProperties({ display: is2D ? 'flex' : 'none' });
            exitButton.setProperties({ display: is2D ? 'none' : 'flex' });
          }),
        );
      }
    }
    // authored map: its name + story join the intro
    if (G.map) {
      this.set('intro-map-story', { text: `You chart ${G.map.name} - ${G.map.story}` });
    }
    // the Wizard speaks - greeting at boot, questions as you choose.
    // subscribe BEFORE wizGreet: his lines route through wizardLine
    on('wizardLine', (line: string) => feed(line));
    wizGreet();
    armTutorial(); // first-run guided lesson listens for runStarted
    // intro -> race select
    const begin = p.getElementById('btn-begin');
    const onBegin = () => {
      this.set('intro-wrap', { display: 'none' });
      this.set('race-wrap', { display: 'flex' });
      wizAsk();
    };
    begin?.addEventListener('click', onBegin);
    this.cleanupFuncs.push(() => begin?.removeEventListener('click', onBegin));
    // race select
    RACES.forEach((race, i) => {
      const btn = p.getElementById(`btn-race-${i}`);
      const handler = () => this.pickRace(i);
      btn?.addEventListener('click', handler);
      this.cleanupFuncs.push(() => btn?.removeEventListener('click', handler));
      btn?.setProperties({ text: `${race} - ${RACE_PERKS[race]}` });
    });
    const home = p.getElementById('btn-home');
    const onHome = () => {
      G.centerI = G.havenI;
      G.centerJ = G.havenJ;
      G.terrainDirty = true;
      feed('The map folds back to your Haven');
    };
    home?.addEventListener('click', onHome);
    this.cleanupFuncs.push(() => home?.removeEventListener('click', onHome));
    const map = p.getElementById('btn-map');
    const onMap = () => {
      void nextMap();
    };
    map?.addEventListener('click', onMap);
    this.cleanupFuncs.push(() => map?.removeEventListener('click', onMap));
    const arch = p.getElementById('btn-architect');
    const onArch = () => {
      void commissionTheGuild();
    };
    arch?.addEventListener('click', onArch);
    this.cleanupFuncs.push(() => arch?.removeEventListener('click', onArch));
    const nw = p.getElementById('btn-new');
    const onNew = () => {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch { /* private mode */ }
      location.reload();
    };
    nw?.addEventListener('click', onNew);
    this.cleanupFuncs.push(() => nw?.removeEventListener('click', onNew));
    // cartographer mode - gated behind the admin PIN login
    adminRestore();
    const editBtn = p.getElementById('btn-edit');
    const onEdit = () => {
      if (!G.admin) {
        G.pinBuf = '';
        this.set('pin-display', { text: '[    ]' });
        this.set('login-status', {
          text: 'First login claims a new key (4+ digits).',
        });
        this.set('login-wrap', { display: 'flex' });
        this.set('edit-wrap', { display: 'none' });
        feed('The Cartographer\'s seal asks for your key.');
        return;
      }
      emit('editMode', !G.editing);
      this.set('login-wrap', { display: 'none' });
      this.set('edit-wrap', { display: G.editing ? 'flex' : 'none' });
    };
    editBtn?.addEventListener('click', onEdit);
    this.cleanupFuncs.push(() => editBtn?.removeEventListener('click', onEdit));
    // PIN pad
    const showPin = () => {
      this.set('pin-display', {
        text: `[ ${'●'.repeat(G.pinBuf.length).padEnd(4, ' ')}]`,
      });
    };
    for (let d = 0; d <= 9; d++) {
      const b = p.getElementById(`pin-${d}`);
      const fn = () => {
        if (G.pinBuf.length < 8) {
          G.pinBuf += String(d);
          showPin();
        }
      };
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    }
    const pinBack = p.getElementById('pin-back');
    const onBack = () => {
      G.pinBuf = G.pinBuf.slice(0, -1);
      showPin();
    };
    pinBack?.addEventListener('click', onBack);
    this.cleanupFuncs.push(() => pinBack?.removeEventListener('click', onBack));
    const pinClear = p.getElementById('pin-clear');
    const onClear = () => {
      G.pinBuf = '';
      showPin();
    };
    pinClear?.addEventListener('click', onClear);
    this.cleanupFuncs.push(() => pinClear?.removeEventListener('click', onClear));
    const pinEnter = p.getElementById('pin-enter');
    const onEnter = () => {
      const res = adminLogin(G.pinBuf);
      G.pinBuf = '';
      showPin();
      if (res === 'claimed') {
        feed('Key claimed - the Cartographer\'s seal is yours.');
        this.set('login-status', { text: 'Key claimed. You are the Cartographer now.' });
      } else if (res === 'ok') {
        feed('Welcome back, Cartographer.');
        this.set('login-status', { text: 'Seal recognized - welcome back.' });
      } else {
        feed('The seal rejects that key.');
        this.set('login-status', { text: 'Wrong key - try again.' });
        return;
      }
      emit('pinOk');
      emit('editMode', true);
      this.set('login-wrap', { display: 'none' });
      this.set('edit-wrap', { display: 'flex' });
    };
    pinEnter?.addEventListener('click', onEnter);
    this.cleanupFuncs.push(() => pinEnter?.removeEventListener('click', onEnter));
    // make my authored world the default map
    const setHome = p.getElementById('btn-set-home');
    const onSetHome = () => {
      if (!G.map) {
        feed('Nothing drawn yet - stamp the world first.');
        return;
      }
      if (saveDefaultMap(G.map)) {
        this.set('home-status', {
          text: `Saved - '${G.map.name}' is now the default world.`,
        });
        feed(`'${G.map.name}' is now the home map.`);
      } else {
        this.set('home-status', { text: 'Save failed - storage is blocked.' });
      }
    };
    setHome?.addEventListener('click', onSetHome);
    this.cleanupFuncs.push(() => setHome?.removeEventListener('click', onSetHome));
    const clearHome = p.getElementById('btn-clear-home');
    const onClearHome = () => {
      clearDefaultMap();
      this.set('home-status', { text: 'Default cleared - back to the charted lands.' });
      feed('Your default map was released to the Wild Ink.');
    };
    clearHome?.addEventListener('click', onClearHome);
    this.cleanupFuncs.push(() => clearHome?.removeEventListener('click', onClearHome));
    const signOut = p.getElementById('btn-signout');
    const onSignOut = () => {
      adminLogout();
      emit('editMode', false);
      this.set('edit-wrap', { display: 'none' });
      this.set('login-wrap', { display: 'none' });
      feed('Cartographer signed out - the seal sleeps.');
    };
    signOut?.addEventListener('click', onSignOut);
    this.cleanupFuncs.push(() => signOut?.removeEventListener('click', onSignOut));
    for (const t of ['o', 's', 'd', 'g', 'f', 'r', 'n', 'road', 'dig', 'haven', 'champ', 'erase']) {
      const b = p.getElementById(`tool-${t}`);
      const fn = () => emit('editPaint', t);
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    }
    const setBrush = (r: number) => {
      G.brushR = Math.max(0, Math.min(3, r));
      this.set('brush-label', { text: `Brush ${G.brushR + 1}` });
    };
    for (const [id, d] of [['btn-brush-minus', -1], ['btn-brush-plus', 1]] as const) {
      const b = p.getElementById(id);
      const fn = () => setBrush(G.brushR + d);
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    }
    // minecraft block tools - material picker + place/break at the cursor
    const MAT_NAMES: Record<string, string> = {
      d: 'Dirt', s: 'Stone', w: 'Wood', b: 'Brick', g: 'Glass', o: 'Gold', l: 'Leaf',
      c: 'Concrete', m: 'Marble', i: 'Iron', k: 'Obsidian', a: 'Water', v: 'Lava',
      t: 'Torch', W: 'Wall', D: 'Door', S: 'Stair', F: 'Fence', P: 'Pane', R: 'Roof',
    };
    for (const t of Object.keys(MAT_NAMES)) {
      const b = p.getElementById(`mat-${t}`);
      const fn = () => {
        G.buildMat = t;
        this.set('mat-label', { text: MAT_NAMES[t] });
      };
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    }
    for (const [id, op] of [['btn-vox-add', 'add'], ['btn-vox-del', 'del'], ['btn-vox-clear', 'clear']] as const) {
      const b = p.getElementById(id);
      const fn = () => emit('voxOp', op);
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    }
    const ex = p.getElementById('btn-export');
    const onEx = () => emit('editExport');
    ex?.addEventListener('click', onEx);
    this.cleanupFuncs.push(() => ex?.removeEventListener('click', onEx));
    // character creator - tint + headgear on the champion meeple
    CHAR_COLORS.forEach((c, i) => {
      const b = p.getElementById(`char-c-${i}`);
      const fn = () => {
        G.charColor = c.hex;
        applyCharacter();
        save();
        feed(`Champion wears ${c.name}`);
      };
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    });
    HATS.forEach((h, i) => {
      const b = p.getElementById(`hat-${i}`);
      const fn = () => {
        G.charHat = h;
        applyCharacter();
        save();
      };
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    });
    BACKS.forEach((bk, i) => {
      const b = p.getElementById(`back-${i}`);
      const fn = () => {
        G.charBack = bk;
        applyCharacter();
        save();
      };
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    });
    // guildmaster reply chips - hands-first conversation with the quest NPC
    for (const [id, intent] of [
      ['npc-take', 'take'],
      ['npc-bargain', 'bargain'],
      ['npc-harder', 'harder'],
      ['npc-refuse', 'refuse'],
    ] as const) {
      const b = p.getElementById(id);
      const fn = () => emit('npcReply', intent);
      b?.addEventListener('click', fn);
      this.cleanupFuncs.push(() => b?.removeEventListener('click', fn));
    }
    const talk = p.getElementById('npc-talk');
    const onTalk = () => emit('voiceToggle');
    talk?.addEventListener('click', onTalk);
    this.cleanupFuncs.push(() => talk?.removeEventListener('click', onTalk));
    // desktop keys: E cartographer, M next expedition, B cycle block mat
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (ev.repeat || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
      const k = ev.key.toLowerCase();
      if (k === 'e') {
        if (!G.admin) { feed('The Cartographer\'s seal asks for your key.'); return; }
        emit('editMode', !G.editing);
        this.set('edit-wrap', { display: G.editing ? 'flex' : 'none' });
      } else if (k === 'm') {
        void nextMap();
      } else if (k === 'b' && G.editing) {
        const mats = Object.keys(VOX_DEFS);
        G.buildMat = mats[(mats.indexOf(G.buildMat) + 1) % mats.length];
        feed(`Block material: ${G.buildMat}`);
        G.hudDirty = true;
      } else if (k === 't') {
        feed('The Wizard clears his throat - again, from the top.');
        replayTutorial();
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    if (load()) {
      this.enterPlaying();
    } else {
      this.refresh();
    }
  }

  private pickRace(i: number): void {
    startRun(RACES[i]);
    wizQuip(RACES[i]);
    G.charColor = G.charColor || RACE_COLORS[RACES[i]];
    if (G.charHat === 'none') G.charHat = RACE_HATS[RACES[i]] ?? 'none';
    applyCharacter();
    this.enterPlaying();
  }

  private enterPlaying(): void {
    this.set('intro-wrap', { display: 'none' });
    this.set('race-wrap', { display: 'none' });
    this.set('game-wrap', { display: 'flex' });
    applyCharacter();
    emit('runStarted');
    G.terrainDirty = true;
    this.refresh();
  }

  private set(id: string, props: Record<string, unknown>): void {
    this.panel?.getElementById(id)?.setProperties(props as any);
  }

  private refresh(): void {
    if (!this.panel) return;
    this.set('stat-race', { text: `${charName(G.seed, G.race)} (${G.race ?? '-'}) | Lv ${G.level} (${G.xp}xp)` });
    this.set('stat-power', { text: `Power ${G.power} | Rank ${powerRank(G.power)}` });
    this.set('stat-gold', { text: `${G.gold} gold` });
    const w = G.equipped >= 0 ? G.inventory[G.equipped] : null;
    this.set('stat-gear', {
      text: w ? `${w.rarity} ${w.name} +${w.power}p` : 'No weapon wielded',
    });
    this.set(
      'stat-haven',
      { text: G.houses > 0 ? `Haven: ${G.houses} house${G.houses > 1 ? 's' : ''} (+${G.houses * 2}g/10s)` : 'Haven: unbuilt - press the golden ring' },
    );
    this.set('stat-map', { text: `Map: ${G.mapName || 'the Wild Ink'}` });
    this.set('stat-peers', { text: G.peers > 0 ? `Table: ${G.peers} wanderer${G.peers > 1 ? 's' : ''}` : 'Table: solo' });
    // quest rail status
    for (let s = 0; s < 4; s++) {
      const qid = G.cardSlots[s];
      const q = qid >= 0 ? G.quests.get(qid) : undefined;
      if (q) {
        const live = G.activeQuests.has(q.id);
        this.set(`quest-${s}`, {
          text: `${GRADES[q.gradeIdx]} | ${q.title.length > 24 ? q.title.slice(0, 23) + '...' : q.title}${live ? '  >ACTIVE' : ''}`,
        });
      } else {
        this.set(`quest-${s}`, { text: '' });
      }
    }
    for (let f = 0; f < 3; f++) {
      this.set(`feed-${f}`, { text: G.feed[f] ?? '' });
    }
    // guildmaster offer panel
    const o = G.offer;
    this.set('npc-wrap', { display: o ? 'flex' : 'none' });
    if (o) {
      this.set('npc-name', { text: `${o.npc.name} - ${o.npc.title}` });
      this.set('npc-offer', {
        text: `[${GRADES[o.quest.gradeIdx]}] ${o.quest.title} - +${o.quest.rewardGold}g +${o.quest.rewardPower}p`,
      });
      this.set('npc-line', { text: o.line });
    }
  }

  update(): void {
    if (G.hudDirty) {
      G.hudDirty = false;
      this.refresh();
    }
  }
}
