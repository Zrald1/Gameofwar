/**
 * MinimapSystem - a fold-map pinned to the top-right of your view in
 * adventure mode. Terrain is painted live from mapTileInfo so the ink
 * is always true; markers show dig Xs, survey beacons, the haven, the
 * guild patron, Morvane, and your own heading. Off-map destinations
 * get edge arrows so any mission stays findable.
 */
import {
  CanvasTexture,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { mapTileInfo } from '../gen/mapdef.js';
import { Biomes } from '../gen/prng.js';
import { QuestKinds } from '../gen/quests.js';
import { G } from '../state.js';

const SIZE = 256;
const HALF = 13; // show HALF*2+1 tiles across

const BIOME_COL: Record<string, string> = {
  [Biomes.OCEAN]: '#1a5f9c',
  [Biomes.SAND]: '#e6d6a2',
  [Biomes.DESERT]: '#d9a850',
  [Biomes.GRASS]: '#55a455',
  [Biomes.FOREST]: '#2f7a45',
  [Biomes.ROCK]: '#7d7d84',
  [Biomes.SNOW]: '#eef3f8',
};

export class MinimapSystem extends createSystem({}) {
  private cv!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tex!: CanvasTexture;
  private quad!: Mesh;
  private redraw = 0;

  init(): void {
    this.cv = document.createElement('canvas');
    this.cv.width = this.cv.height = SIZE;
    this.ctx = this.cv.getContext('2d')!;
    this.tex = new CanvasTexture(this.cv);
    this.quad = new Mesh(
      new PlaneGeometry(0.18, 0.18),
      new MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }),
    );
    this.quad.renderOrder = 999;
    // top-right of the view; slight inward tilt reads more natural in XR
    this.quad.position.set(0.29, 0.17, -0.55);
    this.quad.rotation.set(0.1, -0.3, 0);
    this.quad.visible = false;
    this.world.camera.add(this.quad);
  }

  update(delta: number): void {
    const show = G.mode === 'adv' && G.phase === 'playing';
    if (this.quad.visible !== show) this.quad.visible = show;
    if (!show) return;
    this.redraw -= delta;
    if (this.redraw > 0) return;
    this.redraw = 0.3;
    this.draw();
  }

  /** world tile -> pixel; +x east-right, +j south-down (north is up) */
  private px(wx: number, wy: number): [number, number] {
    const s = SIZE / (HALF * 2 + 1);
    return [SIZE / 2 + (wx - G.ci) * s, SIZE / 2 + (wy - G.cj) * s];
  }

  private edgeArrow(wx: number, wy: number, color: string, label: string): void {
    const ctx = this.ctx;
    const dx = wx - G.ci;
    const dy = wy - G.cj;
    const ang = Math.atan2(dy, dx);
    const R = SIZE / 2 - 14;
    const ax = SIZE / 2 + Math.cos(ang) * R;
    const ay = SIZE / 2 + Math.sin(ang) * R;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = color;
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, ax, ay - 9 < 10 ? ay + 18 : ay - 9);
  }

  private draw(): void {
    const ctx = this.ctx;
    const s = SIZE / (HALF * 2 + 1);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // parchment ground
    ctx.fillStyle = 'rgba(16, 20, 30, 0.88)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // terrain tiles
    for (let dz = -HALF; dz <= HALF; dz++) {
      for (let dx = -HALF; dx <= HALF; dx++) {
        const info = mapTileInfo(G.ci + dx, G.cj + dz);
        ctx.fillStyle = BIOME_COL[info.biome] ?? '#444';
        const [x, y] = this.px(G.ci + dx, G.cj + dz);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x - s / 2, y - s / 2, s + 0.5, s + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // ---- markers (off-window ones become edge arrows) ----
    const onMap = (wx: number, wy: number) =>
      Math.abs(wx - G.ci) <= HALF && Math.abs(wy - G.cj) <= HALF;

    // dig Xs - the mission sites
    for (const d of G.digs) {
      if (!onMap(d.i, d.j)) {
        this.edgeArrow(d.i, d.j, '#ff5a5a', 'X');
        continue;
      }
      const [x, y] = this.px(d.i, d.j);
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5);
      ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5);
      ctx.lineTo(x - 5, y + 5);
      ctx.stroke();
    }
    // survey quest targets - cyan diamonds
    for (const q of G.quests.values()) {
      if (q.done || q.kind !== QuestKinds.SURVEY || !G.activeQuests.has(q.id)) continue;
      if (!onMap(q.ti, q.tj)) {
        this.edgeArrow(q.ti, q.tj, '#5ae8ff', 'B');
        continue;
      }
      const [x, y] = this.px(q.ti, q.tj);
      ctx.fillStyle = '#5ae8ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    }
    // haven - gold house mark
    if (G.havenI !== 0 || G.havenJ !== 0) {
      if (!onMap(G.havenI, G.havenJ)) this.edgeArrow(G.havenI, G.havenJ, '#ffd76a', 'H');
      else {
        const [x, y] = this.px(G.havenI, G.havenJ);
        ctx.fillStyle = '#ffd76a';
        ctx.fillRect(x - 5, y - 4, 10, 8);
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 4);
        ctx.lineTo(x, y - 10);
        ctx.lineTo(x + 6, y - 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    // patron - violet; wizard - star blue. NPCs you can walk up and talk to.
    const npc = (wx: number, wy: number, col: string, ch: string) => {
      if (!onMap(wx, wy)) {
        this.edgeArrow(wx, wy, col, ch);
        return;
      }
      const [x, y] = this.px(wx, wy);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10141e';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(ch, x, y + 3);
    };
    npc(G.patronI, G.patronJ, '#b06fe0', 'P');
    npc(G.wizI, G.wizJ, '#4f8fd8', 'W');

    // you - white core with a gold ring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    // frame + north tick + title
    ctx.strokeStyle = '#8a6a2f';
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('N', SIZE / 2, 16);
    ctx.textAlign = 'left';
    ctx.fillText(`(${G.ci}, ${G.cj})`, 10, SIZE - 10);
    this.tex.needsUpdate = true;
  }
}
