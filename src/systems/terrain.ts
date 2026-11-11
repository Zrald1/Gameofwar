/**
 * TerrainSystem - owns the instanced terrain/prop meshes and the table-local
 * anchoring of every world-anchored prop (meeple, dig X, beacon, chest,
 * haven, houses, relics). Rebuilds on G.terrainDirty (travel, recenter,
 * game start).
 */
import {
  BoxGeometry,
  Color,
  createSystem,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from '@iwsdk/core';
import { Biomes, hash2, TileInfo } from '../gen/prng.js';
import { mapTileInfo, VOX_DEFS } from '../gen/mapdef.js';
import { QuestKinds } from '../gen/quests.js';
import {
  GRID_H,
  GRID_W,
  HEIGHT_SCALE,
  TILE,
  TILE_TOP,
} from '../scene-assets/game.scene-asset.js';
import { Anchors, G, on } from '../state.js';
import { ADV_SCALE, HALF_H, HALF_W, slotPos, tileHeight, worldTilePos } from '../layout.js';
import { Champion } from '../components.js';
import { Grabbed } from '@iwsdk/core';

const PROP_COLORS = [0, 0x2f7a3a, 0x3f8a4f, 0x8a8a8a, 0xdfeaf0];

const VOX_MAX = 1200;
const VOX = 0.042; // block edge, slightly under TILE so stacks show seams

/** cartographic palette - atlas tints, not raw biome fills */
const SEA_DEEP = 0x0b2b52;
const SEA_SHELF = 0x1a5f9c;
const SEA_SHALLOW = 0x49b3c9;
const SEA_FOAM = 0xbfe8dd;
const SAND_COL = 0xe6d6a2;
const DESERT_DRY = 0xd9a850;
const DESERT_WET = 0xc79b5e;
const GRASS_DRY = 0x8fae5a;
const GRASS_WET = 0x55a455;
const FOREST_COL = 0x2f7a45;
const ROCK_LOW = 0x8a7a5f;
const ROCK_HIGH = 0x7d7d84;
const SNOW_COL = 0xeef3f8;

export class TerrainSystem extends createSystem({
  champGrabbed: { required: [Champion, Grabbed] },
}) {
  private terrain!: InstancedMesh;
  private props!: InstancedMesh;
  private vox!: InstancedMesh;
  private m4 = new Matrix4();
  private col = new Color();
  private col2 = new Color();
  private infoArr: TileInfo[] = [];
  private hArr = new Float32Array(GRID_W * GRID_H);
  private p = { x: 0, y: 0, z: 0 };
  private v = new Vector3();
  private meepleTarget = new Vector3();
  private hasTarget = false;
  private patronRobe!: MeshStandardMaterial;
  private patronPid = '';
  private patronT = 0;
  private patronRigged = false;
  private wizStar: Mesh | null = null;
  private wizTalkT = 0;
  private wizT = 0;
  private wizAim = '';
  private pl = { x: 0, z: 0 };

  /** the player's position in table-local units (adventure mode) */
  private playerLocal(): void {
    this.world.camera.getWorldPosition(this.v);
    const t = Anchors.get('table')!.position;
    this.pl.x = (this.v.x - t.x) / ADV_SCALE;
    this.pl.z = (this.v.z - t.z) / ADV_SCALE;
  }

  init(): void {
    const table = this.world.requireSceneObject('map-table');
    Anchors.set('table', table);
    this.terrain = this.world.requireSceneObject('terrain-mesh') as unknown as InstancedMesh;
    this.props = this.world.requireSceneObject('prop-mesh') as unknown as InstancedMesh;
    // minecraft-style block layer - one instanced draw under the table node
    this.vox = new InstancedMesh(
      new BoxGeometry(VOX, VOX, VOX),
      new MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }),
      VOX_MAX,
    );
    this.vox.instanceMatrix.setUsage(this.props.instanceMatrix.usage);
    this.vox.frustumCulled = false;
    table.add(this.vox);
    this.infoArr = new Array(GRID_W * GRID_H);
    for (const id of [
      'champion', 'scroll-map', 'dig-x', 'chest', 'beacon', 'wish',
      'haven-marker', 'house-0', 'house-1', 'house-2',
      'relic-0', 'relic-1', 'relic-2',
      'card-0', 'card-1', 'card-2', 'card-3',
      'patron', 'wizard',
    ]) {
      Anchors.set(id, this.world.requireSceneObject(id));
    }
    for (const id of [
      'champion', 'scroll-map', 'dig-x', 'chest', 'beacon',
      'house-0', 'house-1', 'house-2', 'relic-0', 'relic-1', 'relic-2',
      'card-0', 'card-1', 'card-2', 'card-3', 'patron', 'wizard',
    ]) {
      Anchors.get(id)!.visible = false;
    }
    // wish pedestal sits on the back-left rim - static
    Anchors.get('wish')!.position.set(-0.68, 0.032, -0.38);
    // the scene id is 'haven-marker'; callers (gesture aim, wizard aim)
    // know it as 'haven' - alias so both names resolve the same node
    Anchors.set('haven', Anchors.get('haven-marker')!);
    // patron robe gets its own material so persona tints don't touch the asset.
    // the manifest clone mounts async - rig it lazily on first visible frame
    this.patronRobe = new MeshStandardMaterial({ color: 0x6a7a9a, roughness: 0.7 });
    // the Wizard's star flares while he is speaking
    on('wizardLine', () => { this.wizTalkT = 1.5; });
    // ... and he turns to face the thing he is talking about
    on('wizardAim', (key: string) => { this.wizAim = key; });
  }

  rebuild(): void {
    // pass 1: sample the world once per slot - neighbor lookups read this cache
    for (let gj = 0; gj < GRID_H; gj++) {
      for (let gi = 0; gi < GRID_W; gi++) {
        const idx = gj * GRID_W + gi;
        const wx = Math.round(G.centerI + gi - HALF_W);
        const wz = Math.round(G.centerJ + gj - HALF_H);
        const info = mapTileInfo(wx, wz);
        this.infoArr[idx] = info;
        this.hArr[idx] = tileHeight(info);
      }
    }
    const champGi = Math.round(G.ci - G.centerI + HALF_W);
    const champGj = Math.round(G.cj - G.centerJ + HALF_H);
    let pi = 0;
    for (let gj = 0; gj < GRID_H; gj++) {
      for (let gi = 0; gi < GRID_W; gi++) {
        const idx = gj * GRID_W + gi;
        const info = this.infoArr[idx];
        const h = this.hArr[idx];
        this.m4.makeScale(1, h, 1);
        this.m4.setPosition((gi - HALF_W) * TILE, TILE_TOP + h / 2, (gj - HALF_H) * TILE);
        this.terrain.setMatrixAt(idx, this.m4);
        this.tileColor(info, gi, gj, idx, gi === champGi && gj === champGj);
        this.terrain.setColorAt(idx, this.col);
        // decor
        if (info.prop > 0 && pi < 240) {
          // adventure: trees grow to real height, boulders stay boulders
          const boost = G.mode === 'adv' ? (info.prop === 3 ? 2 : 4) : 1;
          const ph = (info.prop === 3 ? 0.016 : info.prop === 2 ? 0.03 : 0.045) * boost;
          const ws = G.mode === 'adv' && info.prop !== 3 ? 2.2 : 1;
          this.m4.makeScale((info.prop === 3 ? 1.3 : 1) * ws, ph, (info.prop === 3 ? 1.3 : 1) * ws);
          this.m4.setPosition(
            (gi - HALF_W) * TILE,
            TILE_TOP + h + ph / 2,
            (gj - HALF_H) * TILE,
          );
          this.props.setMatrixAt(pi, this.m4);
          const jitter = 0.85 + hash2(gi, gj, 0x51e) * 0.3;
          this.col.setHex(PROP_COLORS[info.prop]).multiplyScalar(jitter);
          this.props.setColorAt(pi, this.col);
          pi++;
        }
      }
    }
    // hide unused props
    this.m4.makeScale(0, 0, 0);
    for (; pi < 240; pi++) this.props.setMatrixAt(pi, this.m4);
    this.rebuildVox();
    this.terrain.instanceMatrix.needsUpdate = true;
    if (this.terrain.instanceColor) this.terrain.instanceColor.needsUpdate = true;
    this.props.instanceMatrix.needsUpdate = true;
    if (this.props.instanceColor) this.props.instanceColor.needsUpdate = true;
    this.vox.instanceMatrix.needsUpdate = true;
    if (this.vox.instanceColor) this.vox.instanceColor.needsUpdate = true;
    this.reanchor();
  }

  /** draw every block stack in the authored map that falls inside the window */
  private rebuildVox(): void {
    const m = G.map;
    let vi = 0;
    if (m) {
      for (const [k, stack] of m.vox) {
        const wx = m.ox + (k % m.w), wz = m.oz + Math.floor(k / m.w);
        const gi = Math.round(wx - G.centerI + HALF_W);
        const gj = Math.round(wz - G.centerJ + HALF_H);
        if (gi < 0 || gj < 0 || gi >= GRID_W || gj >= GRID_H) continue;
        const base = TILE_TOP + this.hArr[gj * GRID_W + gi];
        for (let lv = 0; lv < stack.length && vi < VOX_MAX; lv++) {
          const def = VOX_DEFS[stack[lv]] ?? VOX_DEFS.s;
          this.m4.makeScale(def.sx, def.sy, def.sz);
          this.m4.setPosition(
            (gi - HALF_W) * TILE,
            base + VOX * (lv + def.sy / 2),
            (gj - HALF_H) * TILE,
          );
          this.vox.setMatrixAt(vi, this.m4);
          const j = 0.85 + hash2(wx + lv, wz, 0x5b0c) * 0.3;
          this.col.setHex(def.c).multiplyScalar(j);
          this.vox.setColorAt(vi, this.col);
          vi++;
        }
      }
    }
    this.m4.makeScale(0, 0, 0);
    for (; vi < VOX_MAX; vi++) this.vox.setMatrixAt(vi, this.m4);
  }

  /** neighbor helpers over the cached pass-1 grid (edges clamp) */
  private infoAt(gi: number, gj: number): TileInfo {
    gi = gi < 0 ? 0 : gi >= GRID_W ? GRID_W - 1 : gi;
    gj = gj < 0 ? 0 : gj >= GRID_H ? GRID_H - 1 : gj;
    return this.infoArr[gj * GRID_W + gi];
  }
  private hAt(gi: number, gj: number): number {
    gi = gi < 0 ? 0 : gi >= GRID_W ? GRID_W - 1 : gi;
    gj = gj < 0 ? 0 : gj >= GRID_H ? GRID_H - 1 : gj;
    return this.hArr[gj * GRID_W + gi];
  }

  /**
   * Atlas-style tile shading: bathymetric ocean + coastal foam, hypsometric
   * land ramp, NW hillshade, faint contours, parchment edge vignette, and a
   * brightened champion tile. Pure color math - no extra draws or allocs.
   */
  private tileColor(info: TileInfo, gi: number, gj: number, idx: number, isChamp: boolean): void {
    const col = this.col;
    if (info.biome === Biomes.OCEAN) {
      const t = Math.min(1, info.e / 0.3);
      if (t < 0.55) {
        col.setHex(SEA_DEEP).lerp(this.col2.setHex(SEA_SHELF), t / 0.55);
      } else {
        col.setHex(SEA_SHELF).lerp(this.col2.setHex(SEA_SHALLOW), (t - 0.55) / 0.45);
      }
      // foam edge where sea meets land
      if (
        this.infoAt(gi + 1, gj).biome !== Biomes.OCEAN ||
        this.infoAt(gi - 1, gj).biome !== Biomes.OCEAN ||
        this.infoAt(gi, gj + 1).biome !== Biomes.OCEAN ||
        this.infoAt(gi, gj - 1).biome !== Biomes.OCEAN
      ) {
        col.lerp(this.col2.setHex(SEA_FOAM), 0.35);
      }
    } else {
      switch (info.biome) {
        case Biomes.SAND:
          col.setHex(SAND_COL);
          break;
        case Biomes.DESERT:
          col.setHex(DESERT_DRY).lerp(this.col2.setHex(DESERT_WET), info.m);
          break;
        case Biomes.GRASS:
          col.setHex(GRASS_DRY).lerp(this.col2.setHex(GRASS_WET), Math.min(1, info.m * 1.5));
          break;
        case Biomes.FOREST:
          col.setHex(FOREST_COL).multiplyScalar(0.85 + info.m * 0.4);
          break;
        case Biomes.ROCK:
          col.setHex(ROCK_LOW).lerp(this.col2.setHex(ROCK_HIGH), Math.min(1, (info.e - 0.56) / 0.18));
          break;
        default:
          col.setHex(SNOW_COL);
          break;
      }
      // authored road - packed-dirt tint over the land color
      if (info.road) col.lerp(this.col2.setHex(0xbfa87a), 0.55);
      // NW hillshade - light falls from the table's upper-left
      const slope = this.hAt(gi + 1, gj) - this.hAt(gi - 1, gj) + (this.hAt(gi, gj + 1) - this.hAt(gi, gj - 1));
      const shade = Math.max(0.7, Math.min(1.18, 1 - slope * 9));
      col.multiplyScalar(shade);
      // faint elevation contour
      if ((info.e * 9) % 1 < 0.07) col.multiplyScalar(0.88);
    }
    // parchment vignette - edges fade like unexplored ink
    const edge = Math.max(Math.abs(gi - HALF_W) / HALF_W, Math.abs(gj - HALF_H) / HALF_H);
    if (edge > 0.72) {
      const k = (edge - 0.72) / 0.28;
      col.multiplyScalar(1 - k * k * 0.38);
    }
    // deterministic ink jitter
    const wx = Math.round(G.centerI + gi - HALF_W);
    const wz = Math.round(G.centerJ + gj - HALF_H);
    col.multiplyScalar(0.94 + hash2(wx, wz, G.seed ^ 0x77) * 0.12);
    // "you are here" - warm lift on the champion's tile
    if (isChamp) col.lerp(this.col2.setHex(0xffd76a), 0.28);
  }

  /** place all world-anchored props on their current tiles */
  private reanchor(): void {
    const meeple = Anchors.get('champion')!;
    if (G.phase === 'playing' && G.mode !== 'adv' && worldTilePos(G.ci, G.cj, this.p)) {
      meeple.visible = true;
      this.meepleTarget.set(this.p.x, this.p.y, this.p.z);
      this.hasTarget = true;
    } else if (G.phase !== 'playing' || G.mode === 'adv') {
      meeple.visible = false;
      this.hasTarget = false;
    }
    // the carried scroll lives on the table rim - meaningless inside the map
    Anchors.get('scroll-map')!.visible = G.mode !== 'adv' && G.phase === 'playing';
    const digx = Anchors.get('dig-x')!;
    const free = G.freeDig;
    if (free && worldTilePos(free.i, free.j, this.p)) {
      digx.visible = true;
      digx.position.set(this.p.x, this.p.y + 0.004, this.p.z);
    } else {
      digx.visible = false;
    }
    const haven = Anchors.get('haven-marker')!;
    if (G.phase === 'playing' && worldTilePos(G.havenI, G.havenJ, this.p)) {
      haven.visible = true;
      haven.position.set(this.p.x, this.p.y + 0.002, this.p.z);
      for (let k = 0; k < 3; k++) {
        const h = Anchors.get(`house-${k}`)!;
        h.visible = k < G.houses;
        if (h.visible) {
          h.position.set(
            this.p.x - 0.055 + k * 0.055,
            this.p.y,
            this.p.z + 0.062,
          );
        }
      }
      for (let k = 0; k < 3; k++) {
        const r = Anchors.get(`relic-${k}`)!;
        r.visible = k < G.relics.length;
        if (r.visible) {
          r.position.set(
            this.p.x - 0.05 + k * 0.05,
            this.p.y + 0.004,
            this.p.z - 0.058,
          );
        }
      }
    } else {
      haven.visible = false;
      for (let k = 0; k < 3; k++) {
        Anchors.get(`house-${k}`)!.visible = false;
        Anchors.get(`relic-${k}`)!.visible = false;
      }
    }
    // survey beacon: first accepted survey quest's target tile
    const beacon = Anchors.get('beacon')!;
    let sq: { ti: number; tj: number } | null = null;
    for (const q of G.quests.values()) {
      if (!q.done && q.kind === QuestKinds.SURVEY && G.activeQuests.has(q.id)) {
        sq = q;
        break;
      }
    }
    if (sq && worldTilePos(sq.ti, sq.tj, this.p)) {
      beacon.visible = true;
      beacon.position.set(this.p.x, this.p.y, this.p.z);
    } else {
      beacon.visible = false;
    }
  }

  update(delta: number): void {
    if (G.terrainDirty) {
      G.terrainDirty = false;
      this.rebuild();
    }
    // meeple glides to its tile unless carried
    if (this.hasTarget) {
      const meeple = Anchors.get('champion')!;
      const carried = this.queries.champGrabbed.entities.size > 0;
      if (!carried) {
        meeple.position.lerp(this.meepleTarget, Math.min(1, delta * 8));
      }
    }
    // guild patron: stands at the rim while you play; perks up with an offer
    const patron = Anchors.get('patron')!;
    const pOn = G.phase === 'playing';
    // in adventure his CAMP is a fixed tile - out of window means out of sight
    const patVis = pOn && (G.mode !== 'adv' || worldTilePos(G.patronI, G.patronJ, this.p));
    if (patron.visible !== patVis) patron.visible = patVis;
    if (pOn && patVis) {
      this.patronT += delta;
      if (!this.patronRigged) {
        const robe = patron.getObjectByName('patron-robe') as Mesh | undefined;
        if (robe) {
          robe.material = this.patronRobe;
          const hood = patron.getObjectByName('patron-hood') as Mesh | undefined;
          if (hood) hood.material = this.patronRobe;
          this.patronRigged = true;
        }
      }
      const o = G.offer;
      if (o && o.npc.id !== this.patronPid) {
        this.patronPid = o.npc.id;
        this.patronRobe.color.setHex(o.npc.robe);
      }
      const bob = o ? 0.006 : 0.0018;
      if (G.mode === 'adv') {
        // in the world he is a ~1.9m figure on a real tile, facing you
        // (this.p already holds his camp tile - patVis computed it above)
        patron.position.set(this.p.x, this.p.y + Math.abs(Math.sin(this.patronT * (o ? 5.2 : 1.4))) * bob, this.p.z);
        this.playerLocal();
        patron.rotation.y = Math.atan2(this.pl.x - this.p.x, this.pl.z - this.p.z);
      } else {
        patron.position.y = 0.032 + Math.abs(Math.sin(this.patronT * (o ? 5.2 : 1.4))) * bob;
        patron.rotation.y = 0.42 + Math.sin(this.patronT * 0.9) * 0.14;
      }
    }
    // the Wizard: guide at the right rim - greets you in, then stays on
    // as the explainer you can always poke for advice
    const wiz = Anchors.get('wizard')!;
    // in adventure his camp is fixed - out of window means out of sight
    const wizVis = G.mode !== 'adv' || G.phase !== 'playing' || worldTilePos(G.wizI, G.wizJ, this.p);
    if (wiz.visible !== wizVis) wiz.visible = wizVis;
    {
      // his own clock - patronT freezes outside 'playing' but the Wizard
      // performs from the intro onward
      this.wizT += delta;
      if (G.mode === 'adv' && G.phase === 'playing' && wizVis) {
        // a life-size guide standing on the land beside you
        wiz.position.set(this.p.x, this.p.y + Math.sin(this.wizT * 1.8) * 0.0025, this.p.z);
      } else if (G.mode !== 'adv') {
        wiz.position.y = 0.032 + Math.sin(this.wizT * 1.8) * 0.0025;
      }
      if (this.wizTalkT > 0 && this.wizAim) {
        // point him at what he is explaining - yaw eases toward the
        // target's table-local position while the tip plays
        const tgt = Anchors.get(this.wizAim);
        if (tgt?.visible) {
          const yaw = Math.atan2(tgt.position.x - wiz.position.x, tgt.position.z - wiz.position.z);
          wiz.rotation.y += (yaw - wiz.rotation.y) * Math.min(1, delta * 10);
        }
      } else if (G.mode === 'adv' && G.phase === 'playing') {
        // in the world he watches you, not the horizon
        if (this.wizTalkT <= 0) this.wizAim = '';
        this.playerLocal();
        const yaw = Math.atan2(this.pl.x - wiz.position.x, this.pl.z - wiz.position.z);
        wiz.rotation.y += (yaw - wiz.rotation.y) * Math.min(1, delta * 6);
      } else {
        if (this.wizTalkT <= 0) this.wizAim = '';
        const sway = -0.38 + Math.sin(this.wizT * 0.7) * 0.12;
        wiz.rotation.y += (sway - wiz.rotation.y) * Math.min(1, delta * 6);
      }
      // clone mounts async - cache the star on first sight instead of
      // getObjectByName every frame
      if (!this.wizStar) {
        this.wizStar = (wiz.getObjectByName('wizard-star') as Mesh | undefined) ?? null;
      }
      const star = this.wizStar;
      if (star) {
        star.rotation.y += delta * 2.2;
        if (this.wizTalkT > 0) {
          this.wizTalkT = Math.max(0, this.wizTalkT - delta);
          const k = this.wizTalkT / 1.5;
          star.scale.setScalar(1 + Math.max(0, Math.sin(this.wizT * 16)) * 0.45 * k);
        } else {
          star.scale.setScalar(1);
        }
      }
    }
  }
}
