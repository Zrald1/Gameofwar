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
    on('questAccept', () => chime(0.55));
    on('digDone', () => chime(0.7));
    on('weaponClaim', (rarity: string) =>
      chime(rarity === 'Legendary' || rarity === 'Mythic' ? 0.9 : 0.7),
    );
    on('havenBuilt', () => chime(0.65));
    on('pinOk', () => chime(0.6));
    on('wish', () => chime(0.5));
    on('travel', () => chime(0.35));
    on('runStarted', () => chime(0.45));
  }
}
