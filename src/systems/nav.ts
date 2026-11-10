/**
 * NavSystem - carry-the-champion travel. Grab the meeple (hands pinch or
 * distance-grab), drop it anywhere on the table: the champion travels to the
 * nearest tile; if it lands near the table edge the infinite world recenters
 * beneath it.
 */
import { createSystem, Grabbed, Object3D, Vector3 } from '@iwsdk/core';
import { GRID_H, GRID_W, TILE } from '../scene-assets/game.scene-asset.js';
import { mapTileInfo } from '../gen/mapdef.js';
import { Anchors, emit, feed, G } from '../state.js';
import { HALF_H, HALF_W } from '../layout.js';
import { Champion } from '../components.js';

export class NavSystem extends createSystem({
  champHeld: { required: [Champion, Grabbed] },
}) {
  private wp = new Vector3();
  private tp = new Vector3();

  init(): void {
    this.cleanupFuncs.push(
      this.queries.champHeld.subscribe('disqualify', (entity) => {
        const obj = entity.object3D as Object3D | null;
        const table = Anchors.get('table');
        if (!obj || !table || G.phase !== 'playing') return;
        obj.getWorldPosition(this.wp);
        table.getWorldPosition(this.tp);
        const lx = this.wp.x - this.tp.x;
        const lz = this.wp.z - this.tp.z;
        let gi = Math.round(lx / TILE + HALF_W);
        let gj = Math.round(lz / TILE + HALF_H);
        gi = Math.max(0, Math.min(GRID_W - 1, gi));
        gj = Math.max(0, Math.min(GRID_H - 1, gj));
        G.ci = Math.round(G.centerI + gi - HALF_W);
        G.cj = Math.round(G.centerJ + gj - HALF_H);
        // recenter when dropped near the table edge -> world slides under you
        const margin = 4;
        if (gi < margin || gi > GRID_W - 1 - margin || gj < margin || gj > GRID_H - 1 - margin) {
          G.centerI = G.ci;
          G.centerJ = G.cj;
        }
        G.terrainDirty = true;
        const biome = mapTileInfo(G.ci, G.cj).biome;
        feed(`Champion enters the ${biome} lands (${G.ci}, ${G.cj})`);
        emit('travel', G.ci, G.cj);
      }),
    );
  }
}
