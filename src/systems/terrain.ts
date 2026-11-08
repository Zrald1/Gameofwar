/**
 * TerrainSystem — owns the instanced terrain/prop meshes and the table-local
 * anchoring of every world-anchored prop (meeple, dig X, beacon, chest,
 * haven, houses, relics). Rebuilds on G.terrainDirty (travel, recenter,
 * game start).
 */
import {
  Color,
  createSystem,
  InstancedMesh,
  Matrix4,
  Object3D,
  Vector3,
} from '@iwsdk/core';
import {
  BIOME_COLORS,
  Biomes,
  hash2,
  tileInfo,
} from '../gen/prng.js';
import { QuestKinds } from '../gen/quests.js';
import {
  GRID_H,
  GRID_W,
  HEIGHT_SCALE,
  TILE,
  TILE_TOP,
} from '../scene-assets/game.scene-asset.js';
import { Anchors, G } from '../state.js';
import { HALF_H, HALF_W, slotPos, worldTilePos } from '../layout.js';
import { Champion } from '../components.js';
import { Grabbed } from '@iwsdk/core';

const PROP_COLORS = [0, 0x2f7a3a, 0x3f8a4f, 0x8a8a8a, 0xdfeaf0];

export class TerrainSystem extends createSystem({
  champGrabbed: { required: [Champion, Grabbed] },
}) {
  private terrain!: InstancedMesh;
  private props!: InstancedMesh;
  private m4 = new Matrix4();
  private col = new Color();
  private p = { x: 0, y: 0, z: 0 };
  private v = new Vector3();
  private meepleTarget = new Vector3();
  private hasTarget = false;

  init(): void {
    const table = this.world.requireSceneObject('map-table');
    Anchors.set('table', table);
    this.terrain = this.world.requireSceneObject('terrain-mesh') as unknown as InstancedMesh;
    this.props = this.world.requireSceneObject('prop-mesh') as unknown as InstancedMesh;
    for (const id of [
      'champion', 'scroll-map', 'dig-x', 'chest', 'beacon', 'wish',
      'haven-marker', 'house-0', 'house-1', 'house-2',
      'relic-0', 'relic-1', 'relic-2',
      'card-0', 'card-1', 'card-2', 'card-3',
    ]) {
      Anchors.set(id, this.world.requireSceneObject(id));
    }
    for (const id of [
      'champion', 'scroll-map', 'dig-x', 'chest', 'beacon',
      'house-0', 'house-1', 'house-2', 'relic-0', 'relic-1', 'relic-2',
      'card-0', 'card-1', 'card-2', 'card-3',
    ]) {
      Anchors.get(id)!.visible = false;
    }
    // wish pedestal sits on the back-left rim — static
    Anchors.get('wish')!.position.set(-0.68, 0.032, -0.38);
  }

  /** world tile -> grid height above pad */
  private tileH(wx: number, wz: number): number {
    const info = tileInfo(wx, wz, G.seed);
    return info.biome === Biomes.OCEAN ? 0.004 : 0.006 + info.e * HEIGHT_SCALE;
  }

  rebuild(): void {
    let pi = 0;
    for (let gj = 0; gj < GRID_H; gj++) {
      for (let gi = 0; gi < GRID_W; gi++) {
        const wx = Math.round(G.centerI + gi - HALF_W);
        const wz = Math.round(G.centerJ + gj - HALF_H);
        const info = tileInfo(wx, wz, G.seed);
        const h = this.tileH(wx, wz);
        const idx = gj * GRID_W + gi;
        this.m4.makeScale(1, h, 1);
        this.m4.setPosition((gi - HALF_W) * TILE, TILE_TOP + h / 2, (gj - HALF_H) * TILE);
        this.terrain.setMatrixAt(idx, this.m4);
        const jitter = 0.9 + hash2(wx, wz, G.seed ^ 0x77) * 0.2;
        this.col.setHex(BIOME_COLORS[info.biome]).multiplyScalar(jitter);
        this.terrain.setColorAt(idx, this.col);
        // decor
        if (info.prop > 0 && pi < 240) {
          const ph = info.prop === 3 ? 0.016 : info.prop === 2 ? 0.03 : 0.045;
          this.m4.makeScale(info.prop === 3 ? 1.3 : 1, ph, info.prop === 3 ? 1.3 : 1);
          this.m4.setPosition(
            (gi - HALF_W) * TILE,
            TILE_TOP + h + ph / 2,
            (gj - HALF_H) * TILE,
          );
          this.props.setMatrixAt(pi, this.m4);
          this.col.setHex(PROP_COLORS[info.prop]);
          this.props.setColorAt(pi, this.col);
          pi++;
        }
      }
    }
    // hide unused props
    this.m4.makeScale(0, 0, 0);
    for (; pi < 240; pi++) this.props.setMatrixAt(pi, this.m4);
    this.terrain.instanceMatrix.needsUpdate = true;
    if (this.terrain.instanceColor) this.terrain.instanceColor.needsUpdate = true;
    this.props.instanceMatrix.needsUpdate = true;
    if (this.props.instanceColor) this.props.instanceColor.needsUpdate = true;
    this.reanchor();
  }

  /** place all world-anchored props on their current tiles */
  private reanchor(): void {
    const meeple = Anchors.get('champion')!;
    if (G.phase === 'playing' && worldTilePos(G.ci, G.cj, this.p)) {
      meeple.visible = true;
      this.meepleTarget.set(this.p.x, this.p.y, this.p.z);
      this.hasTarget = true;
    } else if (G.phase !== 'playing') {
      meeple.visible = false;
      this.hasTarget = false;
    }
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
  }
}
