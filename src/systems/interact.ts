/**
 * InteractSystem — every hand interaction on the table that is not the
 * champion or quest cards: scroll-glow, the roaming dig X (tracks the
 * nearest active dig site), chest animation, loot, wish crystal, haven
 * building, passive income.
 */
import { createSystem, Grabbed, Pressed } from '@iwsdk/core';
import { Biomes } from '../gen/prng.js';
import { mapTileInfo } from '../gen/mapdef.js';
import { rollLoot } from '../gen/quests.js';
import { rollWeapon, weaponDropChance } from '../gen/loot.js';
import {
  addGold,
  addPower,
  addWeapon,
  addXp,
  Anchors,
  digGoldMul,
  emit,
  feed,
  G,
  levelLuck,
  luckBonus,
  save,
  weaponPower,
} from '../state.js';
import { tileDist, worldTilePos } from '../layout.js';
import { ChestProp, DigMarker, HavenTag, ScrollProp, WishTag } from '../components.js';

const DIG_RANGE = 4;
const HOUSE_COSTS = [50, 120, 300];

export class InteractSystem extends createSystem({
  scrollHeld: { required: [ScrollProp, Grabbed] },
  digPressed: { required: [DigMarker, Pressed] },
  wishPressed: { required: [WishTag, Pressed] },
  havenPressed: { required: [HavenTag, Pressed] },
  chests: { required: [ChestProp] },
}) {
  private glowT = 0;
  private p = { x: 0, y: 0, z: 0 };

  init(): void {
    this.cleanupFuncs.push(
      this.queries.digPressed.subscribe('qualify', () => this.tryDig()),
      this.queries.wishPressed.subscribe('qualify', () => emit('wish')),
      this.queries.havenPressed.subscribe('qualify', () => this.tryBuild()),
    );
  }

  private tryDig(): void {
    if (G.phase !== 'playing' || G.activeDigId < 0) return;
    const dig = G.digs.find((d) => d.id === G.activeDigId);
    if (!dig) return;
    if (tileDist(G.ci, G.cj, dig.i, dig.j) > DIG_RANGE) {
      feed('Too far — carry your champion to the X');
      return;
    }
    const info = mapTileInfo(dig.i, dig.j);
    // chest reveal on the tile
    const chest = Anchors.get('chest')!;
    if (worldTilePos(dig.i, dig.j, this.p)) {
      chest.position.set(this.p.x, this.p.y, this.p.z);
      chest.visible = true;
      const chestEnt = this.queries.chests.entities.values().next().value;
      if (chestEnt) chestEnt.setValue(ChestProp, 'openT', 0);
    }
    // consume the dig entry + hide marker BEFORE emit (stage-2 may re-show)
    G.digs = G.digs.filter((d) => d.id !== dig.id);
    G.activeDigId = -1;
    Anchors.get('dig-x')!.visible = false;
    if (dig.questId >= 0) {
      emit('digDone', dig.questId, dig.i, dig.j);
      return;
    }
    // free treasure from the held scroll — luck from race AND level
    const loot = rollLoot(
      G.rng,
      luckBonus(info.biome === Biomes.OCEAN) + levelLuck(),
    );
    const gold = Math.round(loot.gold * digGoldMul());
    addGold(gold);
    addPower(loot.power + Math.round(weaponPower() * 0.1));
    addXp(15);
    if (loot.legendary) {
      G.relics.push(loot.item);
      G.terrainDirty = true;
      feed(`LEGENDARY — ${loot.item}! (+${loot.power} power)`);
    } else if (loot.item) {
      feed(`Found ${loot.item} (+${loot.power}p, +${gold}g)`);
    } else {
      feed(`Dug up ${gold} gold`);
    }
    // weapon drop — a free dig can still yield a legendary (0.1% mythic floor)
    if (G.rng() < weaponDropChance(-1)) {
      const w = rollWeapon(G.rng, -1, '');
      addWeapon(w);
      feed(`${w.rarity.toUpperCase()} DROP — ${w.name} (+${w.power}p)`);
    }
    save();
    G.freeDig = null;
    emit('freeDigSpent');
  }

  private tryBuild(): void {
    if (G.phase !== 'playing') return;
    if (G.houses >= 3) {
      feed('Haven is complete — it hums with life');
      return;
    }
    const cost = HOUSE_COSTS[G.houses];
    if (G.gold < cost) {
      feed(`Need ${cost}g to raise a house (have ${G.gold}g)`);
      return;
    }
    addGold(-cost);
    G.houses++;
    emit('havenBuilt');
    G.terrainDirty = true;
    feed(`House raised! Haven income: +${G.houses * 2}g / 10s`);
    save();
  }

  update(delta: number, time: number): void {
    // X marker tracks the nearest active dig site
    const digx = Anchors.get('dig-x');
    if (digx && G.phase === 'playing' && G.digs.length > 0) {
      let best = G.digs[0];
      let bd = tileDist(G.ci, G.cj, best.i, best.j);
      for (const d of G.digs) {
        const dd = tileDist(G.ci, G.cj, d.i, d.j);
        if (dd < bd) {
          best = d;
          bd = dd;
        }
      }
      G.activeDigId = best.id;
      if (worldTilePos(best.i, best.j, this.p)) {
        digx.visible = true;
        digx.position.set(this.p.x, this.p.y + 0.004, this.p.z);
        const held = this.queries.scrollHeld.entities.size > 0;
        this.glowT += delta * (held ? 6 : 2);
        digx.scale.setScalar(1 + Math.sin(this.glowT) * (held ? 0.18 : 0.06));
      } else {
        digx.visible = false;
      }
    } else if (digx) {
      digx.visible = false;
      G.activeDigId = -1;
    }
    // chest open anim
    for (const e of this.queries.chests.entities) {
      const t = e.getValue(ChestProp, 'openT') as number;
      if (t < 0) continue;
      const nt = t + delta;
      const lid = (e.object3D as any)?.getObjectByName('chest-lid');
      if (lid) lid.rotation.x = -1.9 * Math.min(nt / 0.5, 1);
      if (nt > 2.2) {
        e.setValue(ChestProp, 'openT', -1);
        (e.object3D as any).visible = false;
      } else {
        e.setValue(ChestProp, 'openT', nt);
      }
    }
    // haven passive income
    if (G.phase === 'playing' && G.houses > 0) {
      G.incomeAcc += delta;
      if (G.incomeAcc >= 10) {
        G.incomeAcc = 0;
        addGold(G.houses * 2);
        feed(`Haven yields +${G.houses * 2}g`);
      }
    }
    // wish crystal idle shimmer
    const crystal = Anchors.get('wish')?.getObjectByName('wish-crystal');
    if (crystal) {
      crystal.rotation.y = time * 1.4;
      crystal.position.y = 0.065 + Math.sin(time * 2) * 0.004;
    }
  }
}
