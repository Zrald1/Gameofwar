/**
 * HudSystem — the UIKitML panel: race select, champion stats, quest rail
 * status, event feed, Return Home / New Expedition buttons, and the
 * XR enter/exit buttons (scaffold pattern).
 */
import { createSystem, MeshStandardMaterial, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import { GRADES, powerRank, QuestKinds } from '../gen/quests.js';
import {
  Anchors,
  emit,
  feed,
  G,
  load,
  RACE_COLORS,
  RACES,
  RACE_PERKS,
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
    // race select
    RACES.forEach((race, i) => {
      const btn = p.getElementById(`btn-race-${i}`);
      const handler = () => this.pickRace(i);
      btn?.addEventListener('click', handler);
      this.cleanupFuncs.push(() => btn?.removeEventListener('click', handler));
      btn?.setProperties({ text: `${race} — ${RACE_PERKS[race]}` });
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
      if (G.freeDig) return feed('The X already calls — dig it first');
      emit('freeDigSpent');
      feed('The map re-inks a fresh X');
    };
    map?.addEventListener('click', onMap);
    this.cleanupFuncs.push(() => map?.removeEventListener('click', onMap));
    // returning champion?
    if (load()) {
      this.enterPlaying();
    } else {
      this.refresh();
    }
  }

  private pickRace(i: number): void {
    startRun(RACES[i]);
    // tint the meeple
    const body = Anchors.get('champion')?.getObjectByName('meeple-body') as any;
    if (body) body.material = new MeshStandardMaterial({ color: RACE_COLORS[RACES[i]] });
    this.enterPlaying();
  }

  private enterPlaying(): void {
    this.set('race-wrap', { display: 'none' });
    this.set('game-wrap', { display: 'flex' });
    emit('runStarted');
    G.terrainDirty = true;
    this.refresh();
  }

  private set(id: string, props: Record<string, unknown>): void {
    this.panel?.getElementById(id)?.setProperties(props as any);
  }

  private refresh(): void {
    if (!this.panel) return;
    this.set('stat-race', { text: `${G.race ?? '—'} · Lv ${1 + Math.floor(G.power / 25)}` });
    this.set('stat-power', { text: `Power ${G.power} · Rank ${powerRank(G.power)}` });
    this.set('stat-gold', { text: `${G.gold} gold` });
    this.set(
      'stat-haven',
      { text: G.houses > 0 ? `Haven: ${G.houses} house${G.houses > 1 ? 's' : ''} (+${G.houses * 2}g/10s)` : 'Haven: unbuilt — press the golden ring' },
    );
    // quest rail status
    for (let s = 0; s < 4; s++) {
      const qid = G.cardSlots[s];
      const q = qid >= 0 ? G.quests.get(qid) : undefined;
      if (q) {
        const live = G.activeQuests.has(q.id);
        this.set(`quest-${s}`, {
          text: `${GRADES[q.gradeIdx]} · ${q.title.length > 24 ? q.title.slice(0, 23) + '…' : q.title}${live ? '  ▸ACTIVE' : ''}`,
        });
      } else {
        this.set(`quest-${s}`, { text: '' });
      }
    }
    for (let f = 0; f < 3; f++) {
      this.set(`feed-${f}`, { text: G.feed[f] ?? '' });
    }
  }

  update(): void {
    if (G.hudDirty) {
      G.hudDirty = false;
      this.refresh();
    }
  }
}
