/**
 * Character creator — applies G.charColor / G.charHat to the champion meeple.
 * The accessory is a small group re-parented under the meeple clone, so it
 * carries wherever the meeple goes (including when a player carries it).
 */
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { Anchors, G } from './state.js';

export const CHAR_COLORS: { name: string; hex: number }[] = [
  { name: 'Azure', hex: 0x4f8fd8 },
  { name: 'Ember', hex: 0xe07830 },
  { name: 'Verdant', hex: 0x55c86a },
  { name: 'Royal', hex: 0x9b6fe0 },
  { name: 'Crimson', hex: 0xd84f4f },
  { name: 'Gold', hex: 0xe0b13f },
];

export const HATS = ['none', 'cap', 'horns', 'crown'] as const;
export type Hat = (typeof HATS)[number];

export const BACKS = ['none', 'cape', 'banner', 'wings'] as const;
export type Back = (typeof BACKS)[number];

/** race-flavored default headgear when the player hasn't picked one */
export const RACE_HATS: Record<string, Hat> = {
  Human: 'none', Dwarf: 'horns', Elf: 'cap', Naga: 'crown', Demon: 'horns',
};

const NAME_A: Record<string, string[]> = {
  Human: ['Kae', 'Bryn', 'Ald', 'Mar', 'Theo'],
  Dwarf: ['Dor', 'Bal', 'Grum', 'Kaz', 'Thra'],
  Elf: ['Syl', 'Ael', 'Fen', 'Lir', 'Cael'],
  Naga: ['Ssz', 'Veth', 'Nyx', 'Zha', 'Iss'],
  Demon: ['Vex', 'Ash', 'Mor', 'Zul', 'Rav'],
};
const NAME_B = ['len', 'na', 'ric', 'wyn', 'dor', 'ith', 'ara', 'os'];

/** deterministic champion name from seed + race — persists across saves */
export function charName(seed: number, race: string | null): string {
  const a = NAME_A[race ?? ''] ?? NAME_A.Human;
  const h = (seed | 0) ^ ((race ?? '').length * 31);
  return a[Math.abs(h) % a.length] + NAME_B[Math.abs(h * 7 + 3) % NAME_B.length];
}

const HAT_NAME = 'char-hat';
const BACK_NAME = 'char-back';

function buildHat(kind: Hat, mat: MeshStandardMaterial): Object3D | null {
  const g = new Group();
  g.name = HAT_NAME;
  if (kind === 'cap') {
    const cone = new Mesh(new ConeGeometry(0.011, 0.014, 10), mat);
    cone.position.y = 0.008;
    g.add(cone);
  } else if (kind === 'horns') {
    for (const s of [-1, 1]) {
      const horn = new Mesh(new ConeGeometry(0.0035, 0.016, 8), mat);
      horn.position.set(s * 0.007, 0.007, 0);
      horn.rotation.z = -s * 0.45;
      g.add(horn);
    }
  } else if (kind === 'crown') {
    const band = new Mesh(new TorusGeometry(0.0085, 0.002, 8, 16), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.004;
    g.add(band);
    const spike = new Mesh(new ConeGeometry(0.003, 0.009, 6), mat);
    spike.position.y = 0.01;
    g.add(spike);
  } else {
    return null;
  }
  return g;
}

function buildBack(kind: Back, color: number): Object3D | null {
  const g = new Group();
  g.name = BACK_NAME;
  const cloth = new MeshStandardMaterial({ color: new Color(color).multiplyScalar(0.55), roughness: 0.8 });
  if (kind === 'cape') {
    const cape = new Mesh(new BoxGeometry(0.02, 0.028, 0.0025), cloth);
    cape.position.set(0, -0.006, -0.0075);
    cape.rotation.x = 0.28;
    g.add(cape);
  } else if (kind === 'banner') {
    const pole = new Mesh(
      new CylinderGeometry(0.0016, 0.0016, 0.05, 6),
      new MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.6 }),
    );
    pole.position.set(0, 0.014, -0.008);
    g.add(pole);
    const flag = new Mesh(new BoxGeometry(0.014, 0.009, 0.0018), cloth);
    flag.position.set(0.0075, 0.03, -0.008);
    g.add(flag);
  } else if (kind === 'wings') {
    const wingMat = new MeshStandardMaterial({
      color: 0xd8ecff, roughness: 0.4, transparent: true, opacity: 0.85,
    });
    for (const s of [-1, 1]) {
      const w = new Mesh(new ConeGeometry(0.008, 0.02, 4), wingMat);
      w.position.set(s * 0.011, 0.012, -0.006);
      w.rotation.z = s * 0.9;
      w.scale.z = 0.35;
      g.add(w);
    }
  } else {
    return null;
  }
  return g;
}

/** retint the meeple + rebuild its headgear from G.charColor/G.charHat */
export function applyCharacter(): void {
  const champ = Anchors.get('champion');
  if (!champ) return;
  const body = champ.getObjectByName('meeple-body') as Mesh | undefined;
  const head = champ.children.find(
    (c) => (c as Mesh).geometry?.type === 'SphereGeometry',
  ) as Mesh | undefined;
  const color = G.charColor || 0x4f8fd8;
  const mat = new MeshStandardMaterial({ color, roughness: 0.5 });
  if (body) body.material = mat;
  if (head && head.name !== 'meeple-ring') head.material = mat;
  const old = champ.getObjectByName(HAT_NAME);
  if (old) {
    champ.remove(old);
  }
  const hatMat = new MeshStandardMaterial({ color: 0xf0d890, roughness: 0.35, metalness: 0.3 });
  const hat = buildHat(G.charHat as Hat, hatMat);
  if (hat) {
    hat.position.y = 0.043; // above the head sphere
    champ.add(hat);
  }
  // back-slot accessory — hangs at the body's midpoint behind the figure
  const oldB = champ.getObjectByName(BACK_NAME);
  if (oldB) champ.remove(oldB);
  const back = buildBack(G.charBack as Back, color);
  if (back) {
    back.position.y = 0.026;
    champ.add(back);
  }
}
