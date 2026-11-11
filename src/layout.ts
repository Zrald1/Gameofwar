/**
 * Table-local layout math shared by systems.
 * Grid slot (gi,gj) in [0,GRID_W)x[0,GRID_H); world tile (wx,wz) is what the
 * slot currently displays = (G.centerI + gi - HALF_W, G.centerJ + gj - HALF_H).
 */
import { GRID_H, GRID_W, HEIGHT_SCALE, TILE, TILE_TOP } from './scene-assets/game.scene-asset.js';
import { Biomes, TileInfo } from './gen/prng.js';
import { mapTileInfo } from './gen/mapdef.js';
import { G } from './state.js';

export const HALF_W = (GRID_W - 1) / 2;
export const HALF_H = (GRID_H - 1) / 2;

/** adventure mode: the table node is scaled this much - 5cm tiles become 1m */
export const ADV_SCALE = 20;
/** relief flattening in adventure mode - the capsule walks the flat disc,
 *  so relief is visual only; keep bumps under ankle depth */
const ADV_FLAT = 0.15;

/** tile column height - the single source of truth for terrain relief in
 *  both modes (terrain rebuild and prop anchoring must always agree) */
export function tileHeight(info: TileInfo): number {
  const h = info.biome === Biomes.OCEAN ? 0.004 : 0.006 + info.e * HEIGHT_SCALE;
  return G.mode === 'adv' ? 0.006 + (h - 0.006) * ADV_FLAT : h;
}

export function slotToWorld(gi: number, gj: number): [number, number] {
  return [Math.round(G.centerI + gi - HALF_W), Math.round(G.centerJ + gj - HALF_H)];
}
export function worldToSlot(wx: number, wz: number): [number, number] {
  return [Math.round(wx - G.centerI + HALF_W), Math.round(wz - G.centerJ + HALF_H)];
}
export function slotVisible(wx: number, wz: number): boolean {
  const [gi, gj] = worldToSlot(wx, wz);
  return gi >= 0 && gi < GRID_W && gj >= 0 && gj < GRID_H;
}
/** table-local position of a grid slot's top surface */
export function slotPos(gi: number, gj: number, out: { x: number; y: number; z: number }): void {
  const [wx, wz] = slotToWorld(gi, gj);
  const info = mapTileInfo(wx, wz);
  const h = tileHeight(info);
  out.x = (gi - HALF_W) * TILE;
  out.y = TILE_TOP + h;
  out.z = (gj - HALF_H) * TILE;
}
/** table-local position of a world tile if visible; null if off-grid */
export function worldTilePos(
  wx: number,
  wz: number,
  out: { x: number; y: number; z: number },
): boolean {
  if (!slotVisible(wx, wz)) return false;
  const [gi, gj] = worldToSlot(wx, wz);
  slotPos(gi, gj, out);
  return true;
}
export function tileDist(ai: number, aj: number, bi: number, bj: number): number {
  return Math.max(Math.abs(ai - bi), Math.abs(aj - bj));
}
