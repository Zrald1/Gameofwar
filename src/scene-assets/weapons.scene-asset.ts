/**
 * Race starting weapons - held in the right fist in adventure mode.
 * Built human-scale (~0.8m along -Z, grip at origin) unlike the
 * table-scale props in game.scene-asset.ts. Parentless prototypes.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
} from '@iwsdk/core';

const mat = (color: number, opts: Partial<{ rough: number; metal: number; e: number; ei: number }> = {}) =>
  new MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.8,
    metalness: opts.metal ?? 0.1,
    ...(opts.e ? { emissive: opts.e, emissiveIntensity: opts.ei ?? 1 } : {}),
  });

const wood = mat(0x5a3d20);
const darkWood = mat(0x3a2612);
const steel = mat(0xb8c4d0, { rough: 0.35, metal: 0.85 });
const brass = mat(0x8a6a2f, { rough: 0.4, metal: 0.7 });
const leafCrystal = mat(0x4fd88a, { e: 0x2a9a55, ei: 0.8 });
const ember = mat(0xd84f2f, { e: 0xa03010, ei: 1.1 });
const tide = mat(0x4fd8c8, { e: 0x1a6a60, ei: 0.7 });

function mesh(g: Group, geo: any, m: MeshStandardMaterial, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Mesh {
  const me = new Mesh(geo, m);
  me.position.set(x, y, z);
  me.rotation.set(rx, ry, rz);
  g.add(me);
  return me;
}

/** blade/body points down -Z so a grip-space parent aims it forward */
export function createRaceWeapon(race: string | null): Group {
  const g = new Group();
  g.name = `weapon-${(race ?? 'human').toLowerCase()}`;
  switch (race) {
    case 'Dwarf': {
      // Delver's Hammer: stout haft + block head + rear spike
      mesh(g, new CylinderGeometry(0.018, 0.022, 0.55, 8), darkWood, 0, 0, -0.24, Math.PI / 2);
      mesh(g, new BoxGeometry(0.09, 0.09, 0.16, 1, 1, 1), steel, 0, 0, -0.5);
      mesh(g, new ConeGeometry(0.028, 0.09, 6), steel, 0, 0, 0.06, Math.PI / 2); // back spike
      mesh(g, new BoxGeometry(0.1, 0.02, 0.1), brass, 0, 0, -0.42); // collar
      break;
    }
    case 'Elf': {
      // Living Branch: a crooked limb that keeps growing - leaf crystal tip
      mesh(g, new CylinderGeometry(0.014, 0.024, 0.7, 7), wood, 0, 0.01, -0.3, Math.PI / 2 + 0.06, 0, 0.05);
      mesh(g, new CylinderGeometry(0.008, 0.012, 0.2, 6), wood, 0.045, 0.02, -0.42, Math.PI / 2 - 0.5, 0, -0.7);
      mesh(g, new OctahedronGeometry(0.045), leafCrystal, 0, 0.02, -0.66);
      mesh(g, new ConeGeometry(0.03, 0.07, 5), leafCrystal, 0.09, 0.06, -0.5, 0, 0, -0.9); // leaf sprig
      break;
    }
    case 'Naga': {
      // Tidecaller's Trident: long haft + three shell-bright tines
      mesh(g, new CylinderGeometry(0.014, 0.018, 0.72, 8), darkWood, 0, 0, -0.3, Math.PI / 2);
      mesh(g, new SphereGeometry(0.035, 8, 6), tide, 0, 0, -0.62); // head knot
      for (const dx of [-0.05, 0, 0.05]) {
        mesh(g, new ConeGeometry(0.014, 0.2, 6), steel, dx, 0, -0.74, -Math.PI / 2);
      }
      mesh(g, new BoxGeometry(0.13, 0.02, 0.03), tide, 0, 0, -0.63); // crossbar
      break;
    }
    case 'Demon': {
      // Ember Claw: a jagged black-iron talon, hot at the edge
      mesh(g, new CylinderGeometry(0.016, 0.02, 0.3, 7), darkWood, 0, 0, -0.14, Math.PI / 2);
      const blade = mesh(g, new ConeGeometry(0.045, 0.42, 4), mat(0x2a2a30, { rough: 0.5, metal: 0.6 }), 0, 0, -0.5, -Math.PI / 2);
      blade.scale.set(0.55, 1, 1);
      mesh(g, new ConeGeometry(0.02, 0.12, 4), ember, 0.02, 0.015, -0.52, -Math.PI / 2); // ember edge
      mesh(g, new BoxGeometry(0.07, 0.02, 0.05), brass, 0, 0, -0.3); // guard
      break;
    }
    default: {
      // Human - Squire's Sword: honest steel, brass crossguard
      mesh(g, new CylinderGeometry(0.014, 0.017, 0.18, 8), darkWood, 0, 0, -0.05, Math.PI / 2);
      mesh(g, new SphereGeometry(0.025, 8, 6), brass, 0, 0, 0.05); // pommel
      mesh(g, new BoxGeometry(0.14, 0.018, 0.03), brass, 0, 0, -0.16); // guard
      const blade = mesh(g, new BoxGeometry(0.035, 0.008, 0.5), steel, 0, 0, -0.42);
      blade.scale.y = 1;
      mesh(g, new ConeGeometry(0.024, 0.08, 4), steel, 0, 0, -0.71, -Math.PI / 2, Math.PI / 4); // tip
      break;
    }
  }
  return g;
}
