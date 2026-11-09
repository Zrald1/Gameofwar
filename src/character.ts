/**
 * Character creator — applies G.charColor / G.charHat to the champion meeple.
 * The accessory is a small group re-parented under the meeple clone, so it
 * carries wherever the meeple goes (including when a player carries it).
 */
import {
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

const HAT_NAME = 'char-hat';

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
}
