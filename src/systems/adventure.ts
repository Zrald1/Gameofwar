/**
 * AdventureSystem - "step into the map". The map-table scales up x20 so the
 * 5cm tiles become 1m ground under the player's feet; the rim NPCs become
 * ~1.9m figures standing on real tiles. Thumbstick locomotion then walks
 * the world - the champion tile follows the player, and approaching the
 * grid edge recenters the fold so the world is endless underfoot.
 */
import { createSystem, Object3D, Vector3 } from '@iwsdk/core';
import { GRID_H, GRID_W, TILE, TILE_TOP } from '../scene-assets/game.scene-asset.js';
import { mapTileInfo } from '../gen/mapdef.js';
import { Anchors, emit, feed, G, on } from '../state.js';
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

  init(): void {
    this.table = this.world.requireSceneObject('map-table');
    on('advToggle', () => (G.mode === 'adv' ? this.exit() : this.enter()));
    on('advEnter', () => this.enter());
    on('advExit', () => this.exit());
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
    feed('The fold takes you - the map is underfoot now. Walk it.');
    emit('advEntered');
  }

  exit(): void {
    if (G.mode !== 'adv') return;
    G.mode = 'table';
    this.table.scale.setScalar(1);
    this.table.position.copy(TABLE_POS);
    G.terrainDirty = true;
    feed('The fold lifts you back to the table.');
    emit('advExited');
  }

  private seatNpcs(): void {
    G.patronI = G.ci + 2;
    G.patronJ = G.cj;
    G.wizI = G.ci - 2;
    G.wizJ = G.cj + 1;
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
    // which slot is the player standing on? world -> table-local -> slot.
    // the rig origin is the walk capsule; the head may drift off it
    const rig = this.world.player.position;
    const lx = (rig.x - this.table.position.x) / ADV_SCALE;
    const lz = (rig.z - this.table.position.z) / ADV_SCALE;
    const gi = Math.max(0, Math.min(GRID_W - 1, Math.round(lx / TILE + HALF_W)));
    const gj = Math.max(0, Math.min(GRID_H - 1, Math.round(lz / TILE + HALF_H)));
    const ci = Math.round(G.centerI + gi - HALF_W);
    const cj = Math.round(G.centerJ + gj - HALF_H);
    if (ci === this.lastCi && cj === this.lastCj) return;
    this.lastCi = ci;
    this.lastCj = cj;
    if (ci !== G.ci || cj !== G.cj) {
      G.effort.walk += tileDist(G.ci, G.cj, ci, cj);
      G.ci = ci;
      G.cj = cj;
      G.hudDirty = true;
    }
    if (gi < EDGE || gi > GRID_W - 1 - EDGE || gj < EDGE || gj > GRID_H - 1 - EDGE) {
      // walked to the rim - the fold recenters beneath your feet
      G.centerI = ci;
      G.centerJ = cj;
      G.terrainDirty = true;
      this.seatNpcs();
      feed(`You walk into the ${mapTileInfo(ci, cj).biome} lands (${ci}, ${cj})`);
      emit('travel', ci, cj);
      this.placeTable(); // world slides; keep your tile underfoot
    }
  }
}
