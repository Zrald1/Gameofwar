/**
 * AdventureSystem - "step into the map". The map-table scales up x20 so the
 * 5cm tiles become 1m ground under the player's feet; the rim NPCs become
 * ~1.9m figures standing on real tiles. Thumbstick locomotion then walks
 * the world - the champion tile follows the player, and approaching the
 * grid edge recenters the fold so the world is endless underfoot.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  createSystem,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from '@iwsdk/core';
import { GRID_H, GRID_W, TILE, TILE_TOP } from '../scene-assets/game.scene-asset.js';
import { createRaceWeapon } from '../scene-assets/weapons.scene-asset.js';
import { mapTileInfo } from '../gen/mapdef.js';
import { Biomes } from '../gen/prng.js';
import { bumpEffort, walkLoreXp } from '../gen/skills.js';
import { RARITIES, RARITY_COLORS, Weapon } from '../gen/loot.js';
import { addWeapon, addXp, Anchors, emit, feed, G, on, save } from '../state.js';
import { ADV_SCALE, HALF_H, HALF_W, tileDist, tileHeight, worldTilePos } from '../layout.js';

const TABLE_POS = new Vector3(0, 0.82, -0.55);
const FLOOR_Y = 0.0569; // ground-disc top - the locomotion walk surface
const EDGE = 3; // grid slots from the rim that trigger a recenter

export class AdventureSystem extends createSystem({}) {
  private table!: Object3D;
  private cam = new Vector3();
  private p = { x: 0, y: 0, z: 0 };
  private lastCi = 0;
  private lastCj = 0;
  private weapon: Object3D | null = null;
  private weaponRace: string | null = null;
  private nearNoted = new Set<number>();
  private campHi = { patron: false, wiz: false, wish: false };
  private labels: {
    anchor: string;
    title: string;
    color: string;
    sprite: Sprite;
    cv: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tex: CanvasTexture;
    text: string;
  }[] = [];
  private npcPos = new Vector3();
  private wp = new Vector3();
  /** world-anchored views for weapons spilled on the fold */
  private dropViews: {
    d: { i: number; j: number; w?: Weapon; relic?: string };
    group: Group;
    sprite: Sprite;
    ctx: CanvasRenderingContext2D;
    tex: CanvasTexture;
    text: string;
  }[] = [];

  init(): void {
    this.table = this.world.requireSceneObject('map-table');
    on('advToggle', () => (G.mode === 'adv' ? this.exit() : this.enter()));
    on('advEnter', () => this.enter());
    on('advExit', () => this.exit());
    // floating name plates - the "go talk to THEM" beacon over each camp
    this.labels.push(this.makeLabel('patron', 'GUILD PATRON', '#c79bff'));
    this.labels.push(this.makeLabel('wizard', 'MORVANE', '#8fc4ff'));
  }

  private makeLabel(anchor: string, title: string, color: string) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 56;
    const ctx = cv.getContext('2d')!;
    const tex = new CanvasTexture(cv);
    const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(1.5, 0.33, 1);
    sprite.renderOrder = 998;
    sprite.visible = false;
    this.world.scene.add(sprite);
    return { anchor, sprite, cv, ctx, tex, text: '', title, color };
  }

  private paintSprite(
    ctx: CanvasRenderingContext2D,
    tex: CanvasTexture,
    text: string,
    color: string,
  ): void {
    ctx.clearRect(0, 0, 256, 56);
    ctx.font = `bold ${text.length > 18 ? 20 : 26}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12,16,24,0.55)';
    ctx.fillRect(0, 4, 256, 46);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 39);
    tex.needsUpdate = true;
  }

  private drawLabel(l: (typeof this.labels)[number], dist: number): void {
    const text = `${l.title}  ·  ${dist}m`;
    if (text === l.text) return;
    l.text = text;
    this.paintSprite(l.ctx, l.tex, text, l.color);
  }

  enter(): void {
    if (G.mode === 'adv') return;
    if (G.phase !== 'playing') return;
    if (G.editing) {
      feed('Finish your cartography before stepping through.');
      return;
    }
    G.mode = 'adv';
    // seat the rim NPCs on real tiles beside the spawn - at x20 they are ~1.9m
    this.seatNpcs();
    this.lastCi = G.ci;
    this.lastCj = G.cj;
    G.terrainDirty = true; // rebuild flattens relief + reanchors props
    this.placeTable();
    Anchors.get('champion')!.visible = false;
    this.arm();
    feed('The fold takes you - the map is underfoot now. Walk it.');
    emit('advEntered');
  }

  /** the bloodline weapon rides the right grip - rebuilt if the race changes */
  private arm(): void {
    if (this.weapon && this.weaponRace === G.race) {
      this.weapon.visible = true;
      return;
    }
    const grip = (this.world.player as any).gripSpaces?.right as Object3D | undefined;
    if (!grip) return; // no XR grip space yet - update() retries each frame
    this.weapon?.removeFromParent();
    this.weapon = createRaceWeapon(G.race);
    this.weaponRace = G.race;
    // grip at origin, body forward along -Z; a slight inward cant reads natural
    this.weapon.rotation.set(-0.35, 0.15, 0);
    this.weapon.position.set(0.01, -0.03, 0.02);
    grip.add(this.weapon);
  }

  private disarm(): void {
    if (this.weapon) this.weapon.visible = false;
    for (const l of this.labels) l.sprite.visible = false;
    for (const v of this.dropViews) v.group.visible = false;
  }

  exit(): void {
    if (G.mode !== 'adv') return;
    G.mode = 'table';
    this.table.scale.setScalar(1);
    this.table.position.copy(TABLE_POS);
    this.disarm();
    G.terrainDirty = true;
    feed('The fold lifts you back to the table.');
    emit('advExited');
  }

  /**
   * Fixed camps on dry land near the spawn - destinations you walk to,
   * not companions that teleport with you. They stay on their world tiles
   * across recenters; the fold-map's P/W marks + labels lead you back.
   */
  private seatNpcs(): void {
    const pat = this.landNear(G.ci + 9, G.cj + 5);
    G.patronI = pat.i;
    G.patronJ = pat.j;
    const wiz = this.landNear(G.ci - 7, G.cj - 4);
    G.wizI = wiz.i;
    G.wizJ = wiz.j;
    // the wish crystal becomes a shrine on a real tile too - a third
    // bearing from the camps so the destinations triangle around you
    const wish = this.landNear(G.ci + 4, G.cj - 3);
    G.wishI = wish.i;
    G.wishJ = wish.j;
  }

  /** nearest non-ocean tile to (i,j) - camps need dry ground to stand on */
  private landNear(i: number, j: number): { i: number; j: number } {
    for (let r = 0; r < 7; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (mapTileInfo(i + di, j + dj).biome !== Biomes.OCEAN) return { i: i + di, j: j + dj };
        }
      }
    }
    return { i, j };
  }

  /**
   * Scale the table so the champion tile-top lands under the player at the
   * walk-surface height. Y is aligned to the LOWEST visible tile so no tile
   * ever sinks under the opaque ground disc.
   */
  private placeTable(): void {
    // anchor to the locomotion rig (the capsule that walks), not the camera -
    // in XR they nearly coincide; on desktop the camera is offset from it
    this.cam.copy(this.world.player.position);
    if (!worldTilePos(G.ci, G.cj, this.p)) return;
    let minTop = TILE_TOP + tileHeight(mapTileInfo(Math.round(G.centerI), Math.round(G.centerJ)));
    for (let gj = 0; gj < GRID_H; gj++) {
      for (let gi = 0; gi < GRID_W; gi++) {
        const wx = Math.round(G.centerI + gi - HALF_W);
        const wz = Math.round(G.centerJ + gj - HALF_H);
        const top = TILE_TOP + tileHeight(mapTileInfo(wx, wz));
        if (top < minTop) minTop = top;
      }
    }
    this.table.scale.setScalar(ADV_SCALE);
    this.table.position.set(
      this.cam.x - ADV_SCALE * this.p.x,
      FLOOR_Y + 0.004 - ADV_SCALE * minTop,
      this.cam.z - ADV_SCALE * this.p.z,
    );
  }

  update(): void {
    if (G.mode !== 'adv' || G.phase !== 'playing') return;
    if (!this.weapon?.visible || this.weaponRace !== G.race) this.arm(); // grip may appear late
    // which slot is the player standing on? world -> table-local -> slot.
    // the rig origin is the walk capsule; the head may drift off it
    const rig = this.world.player.position;
    const lx = (rig.x - this.table.position.x) / ADV_SCALE;
    const lz = (rig.z - this.table.position.z) / ADV_SCALE;
    const gi = Math.max(0, Math.min(GRID_W - 1, Math.round(lx / TILE + HALF_W)));
    const gj = Math.max(0, Math.min(GRID_H - 1, Math.round(lz / TILE + HALF_H)));
    const ci = Math.round(G.centerI + gi - HALF_W);
    const cj = Math.round(G.centerJ + gj - HALF_H);
    // labels + spilled drops breathe every frame - they must not freeze
    // when the player stands still
    this.updateLabels();
    this.syncDrops();
    if (ci === this.lastCi && cj === this.lastCj) return;
    this.lastCi = ci;
    this.lastCj = cj;
    if (ci !== G.ci || cj !== G.cj) {
      bumpEffort('walk', tileDist(G.ci, G.cj, ci, cj));
      G.ci = ci;
      G.cj = cj;
      G.hudDirty = true;
      emit('advStep', ci, cj); // per-tile travel - survey quests complete on approach
      this.noteNear();
    }
    if (gi < EDGE || gi > GRID_W - 1 - EDGE || gj < EDGE || gj > GRID_H - 1 - EDGE) {
      // walked to the rim - the fold recenters beneath your feet
      G.centerI = ci;
      G.centerJ = cj;
      G.terrainDirty = true;
      // camps do NOT re-seat - they are fixed destinations on the fold
      feed(`You walk into the ${mapTileInfo(ci, cj).biome} lands (${ci}, ${cj})`);
      const lore = walkLoreXp();
      if (lore > 0) addXp(lore); // trail lore: the land itself teaches
      emit('travel', ci, cj);
      this.placeTable(); // world slides; keep your tile underfoot
    }
  }

  /**
   * A spilled blade: thin steel leaning tip-down, rarity glow ring, name
   * plate overhead. World-anchored like the camp labels - it only shows
   * while its tile is on the fold.
   */
  private makeDropView(d: { i: number; j: number; w?: Weapon; relic?: string }) {
    const group = new Group();
    const col = d.relic
      ? '#ffd76a'
      : (RARITY_COLORS[RARITIES.indexOf(d.w!.rarity)] ?? '#9aa4b8');
    if (d.relic) {
      // a relic: faceted gem turning slowly above the glow ring
      const gem = new Mesh(
        new OctahedronGeometry(0.22),
        new MeshStandardMaterial({ color: 0xffc860, emissive: 0xa06818, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.25 }),
      );
      gem.position.y = 0.55;
      group.add(gem);
    } else {
      const steel = new MeshStandardMaterial({ color: 0xb8c4d8, metalness: 0.7, roughness: 0.35 });
      const blade = new Mesh(new BoxGeometry(0.07, 0.85, 0.018), steel);
      blade.position.set(0, 0.46, 0);
      blade.rotation.z = 0.3;
      group.add(blade);
      const guard = new Mesh(
        new BoxGeometry(0.24, 0.035, 0.05),
        new MeshStandardMaterial({ color: 0x8a6a2f, metalness: 0.5, roughness: 0.5 }),
      );
      guard.position.set(-0.13, 0.84, 0);
      guard.rotation.z = 0.3;
      group.add(guard);
    }
    const ring = new Mesh(
      new RingGeometry(0.42, 0.56, 24),
      new MeshBasicMaterial({ color: new Color(col), transparent: true, opacity: 0.75, side: DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 56;
    const ctx = cv.getContext('2d')!;
    const tex = new CanvasTexture(cv);
    const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(1.5, 0.33, 1);
    sprite.renderOrder = 998;
    sprite.position.y = 1.35;
    group.add(sprite);
    group.visible = false;
    this.world.scene.add(group);
    return { d, group, sprite, ctx, tex, text: '' };
  }

  /** keep one view per spilled drop; walk onto its tile to claim the steel */
  private syncDrops(): void {
    for (const d of G.lootDrops) {
      if (!this.dropViews.some((v) => v.d === d)) this.dropViews.push(this.makeDropView(d));
    }
    for (let k = this.dropViews.length - 1; k >= 0; k--) {
      const v = this.dropViews[k];
      if (!G.lootDrops.includes(v.d)) {
        v.group.removeFromParent();
        this.dropViews.splice(k, 1);
        continue;
      }
      const vis = worldTilePos(v.d.i, v.d.j, this.p);
      if (v.group.visible !== vis) v.group.visible = vis;
      if (!vis) continue;
      this.wp.set(this.p.x, this.p.y, this.p.z);
      this.table.localToWorld(this.wp);
      v.group.position.copy(this.wp);
      const dist = tileDist(G.ci, G.cj, v.d.i, v.d.j);
      const text = `${v.d.relic ?? v.d.w!.name}  ·  ${dist}m`;
      if (text !== v.text) {
        v.text = text;
        const col = v.d.relic
          ? '#ffd76a'
          : (RARITY_COLORS[RARITIES.indexOf(v.d.w!.rarity)] ?? '#9aa4b8');
        this.paintSprite(v.ctx, v.tex, text, col);
      }
      if (dist <= 1) this.claimDrop(v.d);
    }
  }

  private claimDrop(d: { i: number; j: number; w?: Weapon; relic?: string }): void {
    const idx = G.lootDrops.indexOf(d);
    if (idx < 0) return;
    G.lootDrops.splice(idx, 1);
    if (d.relic) {
      G.relics.push(d.relic);
      G.terrainDirty = true;
      feed(`You lift the ${d.relic} - it joins your hoard at the haven.`);
      emit('relicFound', d.relic);
      save();
      return;
    }
    addWeapon(d.w!);
    const armed = G.inventory[G.equipped] === d.w!;
    feed(`You take up the ${d.w!.name}${armed ? ' - it is already in your fist.' : '.'}`);
    emit('weaponClaim', d.w!.rarity);
  }

  /** name plates hover over each camp figure while it is on the fold */
  private updateLabels(): void {
    const camps: [string, number, number][] = [
      ['patron', G.patronI, G.patronJ],
      ['wizard', G.wizI, G.wizJ],
    ];
    for (const l of this.labels) {
      const obj = Anchors.get(l.anchor);
      const camp = camps.find(([k]) => k === l.anchor)!;
      const show = !!obj?.visible;
      if (l.sprite.visible !== show) l.sprite.visible = show;
      if (!show) continue;
      obj.getWorldPosition(this.npcPos);
      l.sprite.position.set(this.npcPos.x, this.npcPos.y + 2.35, this.npcPos.z);
      this.drawLabel(l, tileDist(G.ci, G.cj, camp[1], camp[2]));
    }
  }

  /** first time a mission site comes within reach, say so - it is THE destination */
  private noteNear(): void {
    for (const d of G.digs) {
      if (this.nearNoted.has(d.id)) continue;
      if (tileDist(G.ci, G.cj, d.i, d.j) <= 3) {
        this.nearNoted.add(d.id);
        const q = d.questId >= 0 ? G.quests.get(d.questId) : null;
        feed(
          q
            ? `The X of "${q.title}" smolders close - strike the ground.`
            : 'The scroll\'s X smolders close - strike the ground.',
        );
      }
    }
    for (const q of G.quests.values()) {
      if (q.done || !G.activeQuests.has(q.id)) continue;
      if (this.nearNoted.has(-(q.id + 1))) continue;
      if (tileDist(G.ci, G.cj, q.ti, q.tj) <= 4) {
        this.nearNoted.add(-(q.id + 1));
        feed(`"${q.title}" - your target is near.`);
      }
    }
    // camp arrivals - greet once, re-arm when you wander off and return
    const pd = tileDist(G.ci, G.cj, G.patronI, G.patronJ);
    if (pd <= 4 && !this.campHi.patron) {
      this.campHi.patron = true;
      feed("The patron's pavilion - contracts wait on his lips. Walk up and talk.");
      emit('campArrive', 'patron');
    } else if (pd > 9) this.campHi.patron = false;
    const wd = tileDist(G.ci, G.cj, G.wizI, G.wizJ);
    if (wd <= 4 && !this.campHi.wiz) {
      this.campHi.wiz = true;
      feed('Morvane waits among the stones - bring him your questions.');
      emit('campArrive', 'wizard');
    } else if (wd > 9) this.campHi.wiz = false;
    const sd = tileDist(G.ci, G.cj, G.wishI, G.wishJ);
    if (sd <= 4 && !this.campHi.wish) {
      this.campHi.wish = true;
      feed('The crystal hums - wishes have weight here.');
      emit('campArrive', 'wish');
    } else if (sd > 9) this.campHi.wish = false;
  }
}
