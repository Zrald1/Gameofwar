/**
 * MapEditSystem — Cartographer Mode. The champion meeple is the brush cursor:
 * carry it onto a tile, then a palette button stamps the tool there (with
 * brush radius). Entering edit mode snapshots the visible world into a live
 * authored MapDef, so painting is instant and the world starts identical.
 * Export downloads the map JSON + copies it to the clipboard.
 */
import { createSystem } from '@iwsdk/core';
import { Biomes, TileInfo, tileInfo } from '../gen/prng.js';
import { MapDef, serializeMap, stampTile, stampVox } from '../gen/mapdef.js';
import { emit, feed, G, on } from '../state.js';

const KEY_OF: Record<string, number> = {
  [Biomes.OCEAN]: 0, [Biomes.SAND]: 1, [Biomes.DESERT]: 2, [Biomes.GRASS]: 3,
  [Biomes.FOREST]: 4, [Biomes.ROCK]: 5, [Biomes.SNOW]: 6,
};

/** snapshot the visible world into an editable region (wider than the view) */
function ensureEditable(): void {
  if (G.map) return;
  const w = 48, h = 36;
  const ox = Math.round(G.centerI) - (w >> 1);
  const oz = Math.round(G.centerJ) - (h >> 1);
  const tiles = new Int8Array(w * h);
  for (let lz = 0; lz < h; lz++) {
    for (let lx = 0; lx < w; lx++) {
      const info: TileInfo = tileInfo(ox + lx, oz + lz, G.seed);
      tiles[lz * w + lx] = KEY_OF[info.biome];
    }
  }
  const toLocal = (wx: number, wz: number): [number, number] => [wx - ox, wz - oz];
  G.map = {
    name: 'my-map',
    story: 'A land shaped by your own hand.',
    w, h, ox, oz, tiles,
    road: new Set(),
    vox: new Map(),
    champion: toLocal(G.ci, G.cj),
    haven: toLocal(G.havenI, G.havenJ),
    digs: [],
  };
  G.mapName = 'my-map';
  feed('Cartographer mode - the world is now yours to redraw.');
}

export class MapEditSystem extends createSystem({}) {
  init(): void {
    on('editMode', (on2: boolean) => {
      G.editing = on2;
      if (on2) {
        ensureEditable();
        G.terrainDirty = true;
        feed('Carry your meeple onto a tile, then stamp a tool.');
      } else {
        feed('Cartographer mode off - the ink settles.');
      }
    });
    on('editPaint', (tool: string) => this.paint(tool));
    on('voxOp', (op: string) => this.voxOp(op));
    on('editExport', () => this.exportMap());
  }

  /** stamp the active tool at the champion's tile + brush radius */
  private paint(tool: string): void {
    if (!G.editing) return;
    ensureEditable();
    stampTile(G.map!, G.ci, G.cj, G.brushR, tool);
    G.terrainDirty = true;
    emit('tileEdit', G.ci, G.cj, G.brushR, tool);
  }

  /** minecraft-style stamp: place or break blocks at the champion tile */
  private voxOp(op: string): void {
    if (!G.editing) return;
    ensureEditable();
    stampVox(G.map!, G.ci, G.cj, G.brushR, op, G.buildMat);
    G.terrainDirty = true;
    emit('voxEdit', G.ci, G.cj, G.brushR, op, G.buildMat);
  }

  private exportMap(): void {
    const m = G.map;
    if (!m) return feed('Nothing drawn yet - enter Cartographer mode first');
    const js = serializeMap(m);
    try {
      void navigator.clipboard?.writeText(js);
    } catch { /* clipboard unavailable */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([js], { type: 'application/json' }));
    a.download = `${m.name}.json`;
    a.click();
    feed(`Exported ${m.name}.json - drop it in public/maps/ and add it to index.json`);
  }
}
