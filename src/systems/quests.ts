/**
 * QuestSystem - the card rail. Deals generated quests onto pooled cards,
 * draws each card's face on its own CanvasTexture, accepts a quest when its
 * card is grabbed+released, registers objective sites in G.digs / beacon
 * targets, and pays rewards on completion.
 */
import {
  CanvasTexture,
  createSystem,
  Entity,
  Grabbed,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';
import { genQuest, GRADES, GRADE_COLORS, Quest, QuestKinds } from '../gen/quests.js';
import { rollWeapon, weaponDropChance } from '../gen/loot.js';
import { makeOffer, reply, ReplyIntent } from '../gen/npc.js';
import { Biomes } from '../gen/prng.js';
import { mapTileInfo } from '../gen/mapdef.js';
import {
  addGold,
  addPower,
  addWeapon,
  addXp,
  Anchors,
  emit,
  feed,
  G,
  on,
  powerMul,
  raceGoldMul,
  save,
} from '../state.js';
import { tileDist } from '../layout.js';
import { QuestCard } from '../components.js';
import { TILE_TOP } from '../scene-assets/game.scene-asset.js';

const CARD_X = -0.7;
const CARD_Z0 = -0.28;
const CARD_DZ = 0.17;
const DOCK_X = 0.7;

export class QuestSystem extends createSystem({
  cards: { required: [QuestCard] },
  cardHeld: { required: [QuestCard, Grabbed] },
}) {
  private cardEnts: Entity[] = [];

  init(): void {
    for (let i = 0; i < 4; i++) {
      this.cardEnts.push(this.world.requireSceneEntity(`card-${i}`));
    }
    this.cleanupFuncs.push(
      this.queries.cardHeld.subscribe('disqualify', (e) => this.onCardReleased(e)),
    );
    on('digDone', (questId: number, i: number, j: number) => this.onDigDone(questId, i, j));
    on('travel', (ci: number, cj: number) => this.onTravel(ci, cj));
    on('freeDigSpent', () => this.placeFreeDig());
    on('wish', () => this.onWish());
    on('runStarted', () => this.dealInitial());
    on('npcReply', (intent: ReplyIntent) => this.respondTo(intent));
    on('npcSummon', () => {
      if (!G.offer) this.requestOffer(this.freeSlot());
    });
  }

  // ---------- dealing ----------

  dealInitial(): void {
    const scroll = Anchors.get('scroll-map')!;
    scroll.visible = true;
    scroll.position.set(0.1, TILE_TOP + 0.02, 0.36);
    scroll.rotation.set(0, 0.4, 0);
    this.placeFreeDig();
    for (let s = 0; s < 3; s++) this.dealToSlot(s);
    feed('Three quests drift onto the rail. The X calls.');
  }

  private freeSlot(): number {
    return G.cardSlots.indexOf(-1);
  }

  dealToSlot(slot: number, boost = 0): void {
    if (slot < 0) return;
    const q = genQuest(G.rng, G.seed, G.nextQuestId++, G.ci, G.cj, boost, mapTileInfo);
    this.placeCard(slot, q);
  }

  /** put a quest physically on a rail slot */
  private placeCard(slot: number, q: Quest): void {
    G.quests.set(q.id, q);
    G.cardSlots[slot] = q.id;
    const e = this.cardEnts[slot];
    e.setValue(QuestCard, 'questId', q.id);
    e.setValue(QuestCard, 'cardState', 'idle');
    const obj = e.object3D as any;
    obj.visible = true;
    obj.position.set(CARD_X, 0.1, CARD_Z0 + slot * CARD_DZ);
    obj.rotation.set(-0.3, 0.25, 0);
    this.drawCard(e, q);
    G.hudDirty = true;
  }

  // ---------- guildmaster offers (the NPC is the quest source) ----------

  /** a patron walks up with a contract destined for `slot` */
  requestOffer(slot: number): void {
    if (slot < 0) return;
    const o = makeOffer(G.ci, G.cj);
    o.slot = slot;
    G.offer = o;
    emit('npcOffer', o);
    G.hudDirty = true;
  }

  /** the player's chip reply to the current offer */
  private async respondTo(intent: ReplyIntent): Promise<void> {
    const o = G.offer;
    if (!o || G.phase !== 'playing') return;
    const res = await reply(o, intent);
    o.line = res.line;
    feed(res.line);
    if (res.outcome === 'accept') {
      this.placeCard(o.slot, o.quest);
      feed(`Contract inked [${GRADES[o.quest.gradeIdx]}] ${o.quest.title}`);
      G.offer = null;
    } else if (res.outcome === 'withdrawn') {
      const slot = o.slot;
      G.offer = null;
      setTimeout(() => this.requestOffer(slot), 1400);
    }
    emit('npcLine', res.line);
    G.hudDirty = true;
  }

  private drawCard(e: Entity, q: Quest): void {
    const face = (e.object3D as any)?.getObjectByName('card-face') as Mesh | undefined;
    if (!face) return;
    let tex = (face.material as MeshBasicMaterial).map as CanvasTexture | null;
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 156;
      cv.height = 224;
      tex = new CanvasTexture(cv);
      face.material = new MeshBasicMaterial({ map: tex });
    }
    const cv = tex.image as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const grade = GRADES[q.gradeIdx];
    const gcol = GRADE_COLORS[q.gradeIdx];
    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = gcol;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, cv.width - 6, cv.height - 6);
    ctx.fillStyle = gcol;
    ctx.beginPath();
    ctx.arc(cv.width / 2, 52, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14181f';
    ctx.font = 'bold 40px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(grade, cv.width / 2, 66);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '600 19px system-ui';
    const words = q.title.split(' ');
    let line = '';
    let y = 116;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 14) {
        ctx.fillText(line.trim(), cv.width / 2, y);
        y += 22;
        line = w;
      } else line += ' ' + w;
    }
    ctx.fillText(line.trim(), cv.width / 2, y);
    ctx.fillStyle = '#9aa4b8';
    ctx.font = '16px system-ui';
    const kind = q.kind === QuestKinds.EXCAVATE ? 'DIG' : q.kind === QuestKinds.SURVEY ? 'SCOUT' : 'RELIC';
    ctx.fillText(kind, cv.width / 2, 178);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(`+${q.rewardGold}g  +${q.rewardPower}p`, cv.width / 2, 202);
    tex.needsUpdate = true;
  }

  // ---------- accept on release ----------

  private onCardReleased(e: Entity): void {
    const state = e.getValue(QuestCard, 'cardState') as string;
    const qid = e.getValue(QuestCard, 'questId') as number;
    const q = G.quests.get(qid);
    const slot = e.getValue(QuestCard, 'slot') as number;
    const obj = e.object3D as any;
    if (state === 'idle' && q) {
      e.setValue(QuestCard, 'cardState', 'active');
      G.activeQuests.add(q.id);
      obj.position.set(DOCK_X, 0.1, CARD_Z0 + slot * CARD_DZ);
      obj.rotation.set(-0.3, -0.25, 0);
      this.spawnObjective(q);
      feed(`Quest accepted [${GRADES[q.gradeIdx]}] ${q.title}`);
      emit('questAccept');
      G.hudDirty = true;
    } else {
      obj.position.set(state === 'idle' ? CARD_X : DOCK_X, 0.1, CARD_Z0 + slot * CARD_DZ);
      obj.rotation.set(-0.3, state === 'idle' ? 0.25 : -0.25, 0);
    }
  }

  private spawnObjective(q: Quest): void {
    if (q.kind === QuestKinds.SURVEY) {
      G.terrainDirty = true; // beacon reanchors on rebuild
      feed(`Beacon lit in the ${q.biomeTarget} - scout it`);
    } else {
      G.digs.push({ id: G.nextDigId++, questId: q.id, i: q.ti, j: q.tj });
      feed('A red X burns on the map');
    }
  }

  /** the held scroll's own treasure */
  placeFreeDig(): void {
    const ang = G.rng() * Math.PI * 2;
    const d = 5 + G.rng() * 7;
    let ti = Math.round(G.ci + Math.cos(ang) * d);
    let tj = Math.round(G.cj + Math.sin(ang) * d);
    for (let t = 0; t < 40 && mapTileInfo(ti, tj).biome === Biomes.OCEAN; t++) {
      const a2 = G.rng() * Math.PI * 2;
      ti = Math.round(G.ci + Math.cos(a2) * d);
      tj = Math.round(G.cj + Math.sin(a2) * d);
    }
    G.freeDig = { i: ti, j: tj };
    G.digs.push({ id: G.nextDigId++, questId: -1, i: ti, j: tj });
    G.terrainDirty = true;
  }

  // ---------- completion ----------

  private onDigDone(questId: number, i: number, j: number): void {
    if (questId < 0) return;
    const q = G.quests.get(questId);
    if (!q || q.done) return;
    if (q.kind === QuestKinds.RELIC && tileDist(i, j, q.ti, q.tj) <= 2) {
      // first seal broken -> reveal the second X
      G.digs.push({ id: G.nextDigId++, questId: q.id, i: q.ti2, j: q.tj2 });
      feed('The second seal glows on the map');
      return;
    }
    this.completeQuest(q);
  }

  private onTravel(ci: number, cj: number): void {
    for (const q of G.quests.values()) {
      if (q.done || q.kind !== QuestKinds.SURVEY || !G.activeQuests.has(q.id)) continue;
      if (tileDist(ci, cj, q.ti, q.tj) <= 3) {
        this.completeQuest(q);
      }
    }
  }

  private completeQuest(q: Quest): void {
    q.done = true;
    G.activeQuests.delete(q.id);
    const gold = Math.round(q.rewardGold * raceGoldMul());
    const power = Math.round(q.rewardPower * powerMul(q.kind));
    addGold(gold);
    addPower(power);
    addXp(Math.round((q.gradeIdx + 1) * 25 + gold * 0.1));
    if (q.legendary) {
      const relic = `Relic of ${q.title.split(' ').slice(-2).join(' ')}`;
      G.relics.push(relic);
      feed(`LEGENDARY RELIC earned - ${relic}!`);
    }
    // weapon drop - rarity window scales with the quest's grade
    if (G.rng() < weaponDropChance(q.gradeIdx)) {
      const w = rollWeapon(G.rng, q.gradeIdx, GRADES[q.gradeIdx]);
      addWeapon(w);
      feed(`${w.rarity.toUpperCase()} DROP - ${w.name} (+${w.power}p)`);
      emit('weaponDrop', w.rarity);
    }
    feed(`Quest complete [${GRADES[q.gradeIdx]}]: +${gold}g +${power}p`);
    const idx = G.cardSlots.indexOf(q.id);
    if (idx >= 0) {
      G.cardSlots[idx] = -1;
      const e = this.cardEnts[idx];
      e.setValue(QuestCard, 'cardState', 'done');
      e.setValue(QuestCard, 'questId', -1);
      (e.object3D as any).visible = false;
    }
    G.quests.delete(q.id);
    G.terrainDirty = true;
    G.hudDirty = true;
    save();
    // the guild sends a new patron - the NPC deals the replacement
    setTimeout(() => this.requestOffer(this.freeSlot()), 1500);
  }

  private onWish(): void {
    if (G.phase !== 'playing') return;
    const slot = this.freeSlot();
    if (slot < 0) {
      feed('The rail is full - finish a quest first');
      return;
    }
    feed('You whisper a wish... the map ink swirls');
    this.dealToSlot(slot, 2);
  }
}
