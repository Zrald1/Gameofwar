/**
 * Procedural assets for ATLAS ETERNAL - the living-map diorama.
 * All factories return parentless Object3D prototypes; the scene places
 * them as children of the `map-table` node (table-local coordinates).
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  CanvasTexture,
  InstancedMesh,
  DoubleSide,
} from '@iwsdk/core';

export const TILE = 0.05;
export const GRID_W = 26;
export const GRID_H = 16;
export const TILE_TOP = 0.034; // local y of the playfield surface (table-local)
export const HEIGHT_SCALE = 0.032; // max terrain height above pad

const mat = (color: number, opts: Partial<{ rough: number; metal: number; e: number; ei: number }> = {}) =>
  new MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.85,
    metalness: opts.metal ?? 0.05,
    ...(opts.e ? { emissive: opts.e, emissiveIntensity: opts.ei ?? 1 } : {}),
  });

/** dark disc ground - 100m radius so adventure walking never outruns the
 *  walk surface; 1m deep so the capsule can never tunnel through */
export function createGroundFloor(): Group {
  const g = new Group();
  const floor = new Mesh(new CylinderGeometry(100, 100, 1, 64), mat(0x11141c, { rough: 1 }));
  floor.position.y = -0.5;
  g.add(floor);
  const rim = new Mesh(new RingGeometry(98.6, 99.4, 96), mat(0x2a3550, { e: 0x16223a, ei: 0.6 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.002;
  g.add(rim);
  return g;
}

/** floating map table: slab, brass rim, glowing under-disc, recessed pad */
export function createMapTable(): Group {
  const g = new Group();
  const slab = new Mesh(new BoxGeometry(1.52, 0.06, 0.98), mat(0x3d2a18, { rough: 0.85 }));
  g.add(slab);
  const pad = new Mesh(new BoxGeometry(GRID_W * TILE + 0.04, 0.008, GRID_H * TILE + 0.04), mat(0x18202e, { rough: 1 }));
  pad.position.y = 0.03;
  g.add(pad);
  const rimMat = mat(0x8a6a2f, { rough: 0.4, metal: 0.7 });
  const mkRail = (w: number, d: number, x: number, z: number) => {
    const r = new Mesh(new BoxGeometry(w, 0.02, d), rimMat);
    r.position.set(x, 0.035, z);
    g.add(r);
  };
  const hw = 1.52 / 2;
  const hd = 0.98 / 2;
  mkRail(1.52, 0.025, 0, hd - 0.012);
  mkRail(1.52, 0.025, 0, -hd + 0.012);
  mkRail(0.025, 0.98, hw - 0.012, 0);
  mkRail(0.025, 0.98, -hw + 0.012, 0);
  // brass corner studs on the slab margins
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const stud = new Mesh(new CylinderGeometry(0.011, 0.013, 0.012, 10), rimMat);
    stud.position.set(sx * (hw - 0.028), 0.036, sz * (hd - 0.028));
    g.add(stud);
  }
  // engraved compass rose on the right margin - flat brass inlay
  const rose = new Group();
  rose.name = 'compass-rose';
  const roseMat = mat(0xb08a3f, { e: 0x6a4d18, ei: 0.45, metal: 0.6, rough: 0.45 });
  const ring = new Mesh(new RingGeometry(0.017, 0.022, 24), roseMat);
  ring.rotation.x = -Math.PI / 2;
  rose.add(ring);
  for (let k = 0; k < 4; k++) {
    const long = k < 2;
    const spoke = new Mesh(new BoxGeometry(long ? 0.004 : 0.0025, 0.0015, long ? 0.032 : 0.024), roseMat);
    spoke.rotation.y = (k * Math.PI) / 4;
    spoke.position.y = 0.0005;
    rose.add(spoke);
  }
  const hub = new Mesh(new CylinderGeometry(0.0045, 0.0045, 0.002, 10), roseMat);
  rose.add(hub);
  rose.position.set(hw - 0.048, 0.031, 0.34);
  g.add(rose);
  const glow = new Mesh(
    new CylinderGeometry(0.62, 0.72, 0.02, 32),
    mat(0x1a6a4a, { e: 0x1a8a5a, ei: 0.9 }),
  );
  glow.position.y = -0.05;
  g.add(glow);
  return g;
}

/** instanced terrain tiles - matrices+colors driven by TerrainSystem */
export function createTerrainMesh(): InstancedMesh {
  const m = new InstancedMesh(
    new BoxGeometry(TILE * 0.94, 1, TILE * 0.94),
    mat(0xffffff, { rough: 0.95 }),
    GRID_W * GRID_H,
  );
  m.name = 'terrain-mesh';
  m.frustumCulled = false;
  return m;
}

/** instanced decor: trees / cacti / rocks / snowtrees */
export function createPropMesh(): InstancedMesh {
  const m = new InstancedMesh(
    new ConeGeometry(0.016, 1, 5),
    mat(0xffffff, { rough: 0.9 }),
    240,
  );
  m.name = 'prop-mesh';
  m.frustumCulled = false;
  return m;
}

/** champion meeple - pawn body + head + base ring */
export function createMeeple(): Group {
  const g = new Group();
  const bodyMat = mat(0x4f8fd8, { rough: 0.5 });
  const body = new Mesh(new CylinderGeometry(0.008, 0.013, 0.026, 12), bodyMat);
  body.position.y = 0.013;
  body.name = 'meeple-body';
  g.add(body);
  const head = new Mesh(new SphereGeometry(0.009, 12, 10), bodyMat);
  head.position.y = 0.034;
  g.add(head);
  const ring = new Mesh(new RingGeometry(0.012, 0.017, 20), mat(0xffd76a, { e: 0xaa8830, ei: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  g.add(ring);
  return g;
}

/** the treasure-map scroll - grabbable, held => X glows */
export function createScroll(): Group {
  const g = new Group();
  const paper = mat(0xe8d5a8, { rough: 0.8 });
  const roll = new Mesh(new CylinderGeometry(0.016, 0.016, 0.11, 14), paper);
  roll.rotation.z = Math.PI / 2;
  g.add(roll);
  const capMat = mat(0x7a5a30, { rough: 0.5, metal: 0.3 });
  for (const s of [-1, 1]) {
    const cap = new Mesh(new CylinderGeometry(0.019, 0.019, 0.012, 14), capMat);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * 0.055;
    g.add(cap);
  }
  const tie = new Mesh(new RingGeometry(0.0165, 0.019, 12), mat(0xa03030, { rough: 0.7 }));
  tie.rotation.y = Math.PI / 2;
  g.add(tie);
  return g;
}

/** quest card - thin card; face texture is assigned by QuestSystem at
 *  runtime (canvas creation is DOM work - not allowed in the asset realm) */
export function createCard(): Group {
  const g = new Group();
  const frame = new Mesh(new BoxGeometry(0.078, 0.112, 0.004), mat(0x1c2030, { rough: 0.6 }));
  g.add(frame);
  const face = new Mesh(new PlaneGeometry(0.072, 0.106), new MeshBasicMaterial({ color: 0x141824 }));
  face.name = 'card-face';
  face.position.z = 0.0025;
  g.add(face);
  return g;
}

/** treasure chest - 'lid' child pivots open */
export function createChest(): Group {
  const g = new Group();
  const wood = mat(0x6a4526, { rough: 0.7 });
  const gold = mat(0xd8a53f, { rough: 0.35, metal: 0.7 });
  const base = new Mesh(new BoxGeometry(0.055, 0.024, 0.04), wood);
  base.position.y = 0.012;
  g.add(base);
  const lid = new Group();
  lid.name = 'chest-lid';
  const lidMesh = new Mesh(new BoxGeometry(0.055, 0.016, 0.04), wood);
  lidMesh.position.set(0, 0.008, 0.02);
  lid.add(lidMesh);
  const band = new Mesh(new BoxGeometry(0.058, 0.018, 0.012), gold);
  band.position.set(0, 0.008, 0.02);
  lid.add(band);
  lid.position.set(0, 0.024, -0.02);
  g.add(lid);
  const inner = new Mesh(new PlaneGeometry(0.045, 0.032), mat(0xffe95e, { e: 0xffd040, ei: 1.4 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.025;
  g.add(inner);
  return g;
}

/** X dig marker - emissive crossed bars */
export function createDigX(): Group {
  const g = new Group();
  const xm = mat(0xff5030, { e: 0xff3010, ei: 1.2 });
  for (const s of [-1, 1]) {
    const bar = new Mesh(new BoxGeometry(0.05, 0.004, 0.011), xm);
    bar.rotation.y = (s * Math.PI) / 4;
    g.add(bar);
  }
  return g;
}

/** survey beacon - glowing pillar marking the target biome */
export function createBeacon(): Group {
  const g = new Group();
  const pillar = new Mesh(
    new CylinderGeometry(0.006, 0.009, 0.09, 10),
    mat(0x50c8ff, { e: 0x2090ff, ei: 1.2 }),
  );
  pillar.position.y = 0.045;
  g.add(pillar);
  const cap = new Mesh(new OctahedronGeometry(0.012), mat(0xbfe8ff, { e: 0x60c0ff, ei: 1.5 }));
  cap.position.y = 0.1;
  g.add(cap);
  return g;
}

/** wish pedestal - plinth + floating crystal (press to ask for a quest) */
export function createWishPedestal(): Group {
  const g = new Group();
  const plinth = new Mesh(new CylinderGeometry(0.035, 0.045, 0.03, 12), mat(0x2a2438, { rough: 0.6 }));
  plinth.position.y = 0.015;
  g.add(plinth);
  const crystal = new Mesh(new OctahedronGeometry(0.02), mat(0xa070ff, { e: 0x8050ff, ei: 1.5 }));
  crystal.name = 'wish-crystal';
  crystal.position.y = 0.065;
  g.add(crystal);
  return g;
}

/** haven marker - golden ring + posts on the home tile */
export function createHaven(): Group {
  const g = new Group();
  const gold = mat(0xd8b04f, { e: 0x8a6820, ei: 0.5, metal: 0.5, rough: 0.4 });
  const ring = new Mesh(new RingGeometry(0.02, 0.026, 20), gold);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  g.add(ring);
  for (const [x, z] of [[-0.022, -0.022], [0.022, -0.022], [-0.022, 0.022], [0.022, 0.022]]) {
    const post = new Mesh(new CylinderGeometry(0.003, 0.003, 0.03, 8), gold);
    post.position.set(x, 0.015, z);
    g.add(post);
  }
  return g;
}

/** little house for the haven */
export function createHouse(): Group {
  const g = new Group();
  const walls = new Mesh(new BoxGeometry(0.038, 0.026, 0.034), mat(0xcbb98f, { rough: 0.9 }));
  walls.position.y = 0.013;
  g.add(walls);
  const roof = new Mesh(new ConeGeometry(0.032, 0.02, 4), mat(0x9a4030, { rough: 0.8 }));
  roof.position.y = 0.036;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const door = new Mesh(new PlaneGeometry(0.01, 0.016), mat(0x4a3220));
  door.position.set(0, 0.008, 0.0175);
  g.add(door);
  return g;
}

/** legendary relic gem displayed on the haven shelf */
export function createRelic(): Group {
  const g = new Group();
  const gem = new Mesh(new IcosahedronGeometry(0.012, 0), mat(0xffe95e, { e: 0xffb020, ei: 1.6 }));
  gem.position.y = 0.016;
  g.add(gem);
  return g;
}

/** guild patron - robed envoy standing at the table rim with offers.
 *  'patron-robe'/'patron-hood' share one material so the runtime can
 *  retint the whole figure per persona in a single write */
export function createPatron(): Group {
  const g = new Group();
  const robeMat = mat(0x6a7a9a, { rough: 0.7 });
  const robe = new Mesh(new ConeGeometry(0.022, 0.07, 10), robeMat);
  robe.position.y = 0.035;
  robe.name = 'patron-robe';
  g.add(robe);
  const hood = new Mesh(new ConeGeometry(0.013, 0.02, 10), robeMat);
  hood.position.y = 0.086;
  hood.name = 'patron-hood';
  g.add(hood);
  const head = new Mesh(new SphereGeometry(0.01, 10, 8), mat(0xe8c8a0, { rough: 0.8 }));
  head.position.y = 0.073;
  g.add(head);
  const staff = new Mesh(new CylinderGeometry(0.0022, 0.0028, 0.088, 8), mat(0x5a3c22, { rough: 0.6 }));
  staff.position.set(0.024, 0.044, 0.004);
  staff.rotation.z = -0.08;
  g.add(staff);
  const orb = new Mesh(new OctahedronGeometry(0.007), mat(0x9fe8ff, { e: 0x50b0ff, ei: 1.3 }));
  orb.position.set(0.0275, 0.092, 0.004);
  g.add(orb);
  const ring = new Mesh(new RingGeometry(0.019, 0.026, 20), mat(0xcfd8ea, { e: 0x8899bb, ei: 0.6 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  g.add(ring);
  g.add(hitProxy(0.05));
  return g;
}

/** the Wizard - guide figure standing at the right rim. Tall pointy hat +
 *  long beard + star-topped staff; 'wizard-robe'/'wizard-hat' share one
 *  material for single-write retints. Greets players in intro/race. */
export function createWizard(): Group {
  const g = new Group();
  const robeMat = mat(0x3a4a8a, { rough: 0.65 });
  const robe = new Mesh(new ConeGeometry(0.02, 0.072, 10), robeMat);
  robe.position.y = 0.036;
  robe.name = 'wizard-robe';
  g.add(robe);
  const head = new Mesh(new SphereGeometry(0.01, 10, 8), mat(0xe8c8a0, { rough: 0.8 }));
  head.position.y = 0.076;
  g.add(head);
  const beard = new Mesh(new ConeGeometry(0.008, 0.03, 8), mat(0xd8d8e0, { rough: 0.9 }));
  beard.position.set(0, 0.062, 0.005);
  beard.rotation.x = 0.35;
  g.add(beard);
  const brim = new Mesh(new CylinderGeometry(0.021, 0.023, 0.0035, 12), robeMat);
  brim.position.y = 0.084;
  g.add(brim);
  const hat = new Mesh(new ConeGeometry(0.012, 0.042, 10), robeMat);
  hat.position.y = 0.105;
  hat.rotation.z = 0.12;
  hat.name = 'wizard-hat';
  g.add(hat);
  const staff = new Mesh(new CylinderGeometry(0.0022, 0.0028, 0.095, 8), mat(0x5a3c22, { rough: 0.6 }));
  staff.position.set(-0.026, 0.047, 0.003);
  staff.rotation.z = 0.09;
  g.add(staff);
  const star = new Mesh(new OctahedronGeometry(0.008), mat(0xffe95e, { e: 0xffb020, ei: 1.6 }));
  star.position.set(-0.0305, 0.096, 0.003);
  star.name = 'wizard-star';
  g.add(star);
  const ring = new Mesh(new RingGeometry(0.019, 0.026, 20), mat(0x8fa0e0, { e: 0x5566aa, ei: 0.6 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  g.add(ring);
  g.add(hitProxy(0.065));
  return g;
}

/** invisible ray-target - 5cm figures are slivers to click on desktop; this
 *  transparent cylinder (raycastable, renders nothing) gives RayInteractable
 *  a forgiving volume. Named 'hit-proxy' so systems can ignore it. */
function hitProxy(halfY: number): Mesh {
  const m = new Mesh(
    new CylinderGeometry(0.045, 0.045, halfY * 2, 8),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  m.position.y = halfY;
  m.name = 'hit-proxy';
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/** low wall behind the table so the diorama reads as a scene */
export function createBackdrop(): Group {
  const g = new Group();
  const arc = new Mesh(new RingGeometry(1.35, 1.45, 48, 1, Math.PI * 0.15, Math.PI * 0.7), mat(0x1a2233, { rough: 1 }));
  arc.rotation.x = -Math.PI / 2;
  g.add(arc);
  return g;
}
