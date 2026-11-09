/**
 * SfxSystem - one-shot chime feedback on the satisfying moments
 * (dig reveal, wish granted, world recenter). Uses AudioUtils.createOneShot
 * so each chime is a self-cleaning entity; no per-frame work.
 */
import { AudioUtils, createSystem } from '@iwsdk/core';
import { on } from '../state.js';

const CHIME = `${import.meta.env.BASE_URL}audio/chime.mp3`;

export class SfxSystem extends createSystem({}) {
  init() {
    const chime = (volume = 0.5) => {
      AudioUtils.createOneShot(this.world, CHIME, { volume, positional: false });
    };
    on('digDone', () => chime(0.7));
    on('wish', () => chime(0.5));
    on('travel', () => chime(0.35));
  }
}
