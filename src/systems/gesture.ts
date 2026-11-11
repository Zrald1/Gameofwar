/**
 * GestureSystem - reads real WebXR hand joints each frame and turns poses
 * into game verbs:
 *   point   - fingertip aims a beam at the X / wish / haven ring; dwelling
 *             ~0.45s presses it (point-to-select)
 *   fist    - a closed fist thrown forward punches the X to break ground
 *   thumbs-up / open palm - while a patron offer is live: take it / send away
 * On a Quest the tracked joints drive this; in IWER, set-hand-pose drives
 * the same joints.
 */
import { createSystem, CylinderGeometry, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from '@iwsdk/core';
import { bumpEffort, punchPowerChance } from '../gen/skills.js';
import { addPower, Anchors, emit, feed, G, on } from '../state.js';

type Pose = 'point' | 'fist' | 'open' | 'thumbsup' | 'relaxed';

const JOINTS = [
  'wrist',
  'thumb-tip',
  'index-finger-phalanx-proximal',
  'index-finger-tip',
  'middle-finger-phalanx-proximal',
  'middle-finger-tip',
  'ring-finger-phalanx-proximal',
  'ring-finger-tip',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-tip',
] as const;

const DWELL_S = 0.45;
const PUNCH_SPEED = 1.0; // m/s knuckle velocity while fisted
const PUNCH_RANGE = 0.45; // fist must land within this of the X (meters)
const AIM_DIST = 2.2; // fingertip beam reach
const AIM_CONE = 0.06; // allowed lateral miss distance per meter
// In adventure mode NPC anchors are human-scale: their entity origin sits at
// the feet, so aim/contact is measured to a chest-level point and radii widen.
const ADV_BODY_H = 1.35;
const ADV_PUNCH = 1.7;
const ADV_AIM_DIST = 9;
const ADV_NEAR = 0.5;

interface HandState {
  pose: Pose;
  prevKnuckle: Vector3;
  vel: number;
  dwellKey: string | null;
  dwellT: number;
  punchCooldown: number;
  repliedPose: Pose;
  wizDwellT: number;
  wizHeld: boolean;
}

export class GestureSystem extends createSystem({}) {
  private hands = new Map<string, HandState>();
  private tip = new Vector3();
  private prox = new Vector3();
  private wrist = new Vector3();
  private tipB = new Vector3();
  private proxB = new Vector3();
  private dir = new Vector3();
  private toT = new Vector3();
  private beam!: Mesh;
  private beamQ = new Quaternion();
  private up = new Vector3(0, 1, 0);

  init(): void {
    // fingertip aim beam - visible while pointing
    this.beam = new Mesh(
      new CylinderGeometry(0.0018, 0.0018, 1, 6),
      new MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55 }),
    );
    this.beam.visible = false;
    this.beam.frustumCulled = false;
    this.world.scene.add(this.beam);
    on('gestureDebug', () => this.debugInfo());
  }

  private debugInfo(): string {
    const parts: string[] = [];
    for (const [side, h] of this.hands) {
      parts.push(`${side}:${h.pose} v=${h.vel.toFixed(2)}`);
    }
    return parts.join(' | ') || 'no hands';
  }

  private classify(j: Map<string, Vector3>): Pose {
    const wrist = j.get('wrist')!;
    const curled = (tipName: string, proxName: string) => {
      const t = j.get(tipName)!;
      const p = j.get(proxName)!;
      // curled when the tip is not much farther from the wrist than its knuckle
      return t.distanceTo(wrist) < p.distanceTo(wrist) * 1.25;
    };
    const indexC = curled('index-finger-tip', 'index-finger-phalanx-proximal');
    const midC = curled('middle-finger-tip', 'middle-finger-phalanx-proximal');
    const ringC = curled('ring-finger-tip', 'ring-finger-phalanx-proximal');
    const pinkC = curled('pinky-finger-tip', 'pinky-finger-phalanx-proximal');
    const thumb = j.get('thumb-tip')!;
    // thumbs-up vs fist: the thumb extends away from the knuckles. A fist's
    // thumb tucks against the curled fingers (tip lands ~2cm from the index
    // knuckle); a thumbs-up thumb reaches ~6cm+. Orientation-free, works on
    // emulated and tracked hands alike.
    const thumbOut = thumb.distanceTo(j.get('index-finger-phalanx-proximal')!) > 0.075;
    if (!indexC && midC && ringC && pinkC) return 'point';
    if (indexC && midC && ringC && pinkC) return thumbOut ? 'thumbsup' : 'fist';
    if (!indexC && !midC && !ringC && !pinkC) return 'open';
    return 'relaxed';
  }

  private aimTarget(origin: Vector3, dir: Vector3): string | null {
    const adv = G.mode === 'adv';
    let best: string | null = null;
    let bestD = adv ? ADV_AIM_DIST : AIM_DIST;
    // proximity aim - a pointing fingertip hovering on a thing IS pointing
    // at it (poke semantics); generous on purpose
    let nearD = adv ? ADV_NEAR : 0.12;
    // figures are aimed at the chest; the wish crystal floats ~1.3m
    // above its plinth - aim where the glowing thing actually is
    const liftOf = (key: string) =>
      adv && (key === 'patron' || key === 'wizard') ? ADV_BODY_H : adv && key === 'wish' ? 1.3 : 0;
    for (const key of ['dig-x', 'wish', 'haven', 'patron', 'wizard'] as const) {
      const obj = Anchors.get(key);
      if (!obj || !obj.visible) continue;
      if (key === 'dig-x' && G.activeDigId < 0) continue;
      obj.getWorldPosition(this.toT);
      this.toT.y += liftOf(key);
      const d = this.toT.distanceTo(origin);
      if (d < nearD) {
        nearD = d;
        best = key;
        bestD = d;
      }
    }
    if (best) return best;
    // ray aim - fingertip direction for pointing at things farther away
    for (const key of ['dig-x', 'wish', 'haven', 'patron', 'wizard'] as const) {
      const obj = Anchors.get(key);
      if (!obj || !obj.visible) continue;
      if (key === 'dig-x' && G.activeDigId < 0) continue;
      obj.getWorldPosition(this.toT);
      this.toT.y += liftOf(key);
      this.toT.sub(origin);
      const along = this.toT.dot(dir);
      if (along < 0.05 || along > bestD) continue;
      const miss = this.toT.addScaledVector(dir, -along).length();
      const cone = (adv ? 0.35 : AIM_CONE) + along * (adv ? 0.16 : 0.09);
      if (miss < cone && along < bestD) {
        bestD = along;
        best = key;
      }
    }
    return best;
  }

  private updateBeam(origin: Vector3, dir: Vector3, len: number, show: boolean): void {
    this.beam.visible = show;
    if (!show) return;
    this.beam.position.copy(origin).addScaledVector(dir, len * 0.5);
    this.beam.scale.set(1, len, 1);
    this.beamQ.setFromUnitVectors(this.up, dir);
    this.beam.quaternion.copy(this.beamQ);
  }

  update(delta: number): void {
    const session = (this.world as any).session;
    if (!session) {
      this.beam.visible = false;
      return;
    }
    const frame = (this.world.renderer as any).xr?.getFrame?.() ?? null;
    const refSpace = (this.world.renderer as any).xr?.getReferenceSpace?.() ?? null;
    if (!frame || !refSpace || typeof frame.getJointPose !== 'function') return;

    const seen = new Set<string>();
    for (const src of session.inputSources) {
      if (!src.hand) continue;
      const side = src.handedness === 'left' ? 'left' : 'right';
      seen.add(side);
      let st = this.hands.get(side);
      if (!st) {
        st = {
          pose: 'relaxed',
          prevKnuckle: new Vector3(),
          vel: 0,
          dwellKey: null,
          dwellT: 0,
          punchCooldown: 0,
          repliedPose: 'relaxed',
          wizDwellT: 0,
          wizHeld: false,
        };
        this.hands.set(side, st);
      }
      // read joints
      const j = new Map<string, Vector3>();
      let ok = true;
      for (const name of JOINTS) {
        const space = src.hand.get(name);
        if (!space) continue;
        const pose = frame.getJointPose(space, refSpace);
        if (!pose) {
          ok = false;
          break;
        }
        const v = new Vector3().copy(pose.transform.position as any);
        j.set(name, v);
      }
      if (!ok || !j.has('wrist') || !j.has('index-finger-tip')) continue;
      // xrOrigin offset: joint poses are in the session reference space; the
      // table anchors are scene-world. Convert via the player's origin.
      const origin = (this.world as any).player;
      if (origin) {
        for (const v of j.values()) origin.localToWorld?.(v as any);
      }

      const knuckle = j.get('index-finger-phalanx-proximal')!;
      const instVel = st.prevKnuckle.lengthSq() > 0 ? knuckle.distanceTo(st.prevKnuckle) / Math.max(delta, 1e-4) : 0;
      st.vel = st.vel * 0.5 + instVel * 0.5;
      st.prevKnuckle.copy(knuckle);
      st.punchCooldown = Math.max(0, st.punchCooldown - delta);

      const pose = this.classify(j);
      if (pose !== st.pose) {
        if (pose !== 'relaxed') feed(`Gesture (${side}): ${pose.toUpperCase()}`);
        st.pose = pose;
        st.dwellKey = null;
        st.dwellT = 0;
        st.repliedPose = 'relaxed';
        st.wizDwellT = 0;
        st.wizHeld = false;
      }

      // ---- fist HELD on the wizard (long-press): replay his lesson ----
      // dwell, not velocity - a held fist can't collide with the dig-X punch.
      // fires once per hold; release and hold again to replay again.
      if (pose === 'fist') {
        const adv = G.mode === 'adv';
        const range = adv ? ADV_PUNCH : PUNCH_RANGE;
        const wizard = Anchors.get('wizard');
        let near = false;
        if (wizard?.visible) {
          wizard.getWorldPosition(this.toT);
          if (adv) this.toT.y += ADV_BODY_H;
          near = this.toT.distanceTo(knuckle) < range;
        }
        if (near) {
          st.wizDwellT += delta;
          if (st.wizDwellT >= 0.7 && !st.wizHeld) {
            st.wizHeld = true;
            feed('The Wizard chuckles - the lesson begins again.');
            emit('gesturePress', 'wizard-bump');
            continue;
          }
        } else {
          st.wizDwellT = 0;
          st.wizHeld = false;
        }
      }

      // ---- point: fingertip beam + dwell press ----
      if (pose === 'point') {
        this.tip.copy(j.get('index-finger-tip')!);
        this.prox.copy(j.get('index-finger-phalanx-proximal')!);
        this.dir.copy(this.tip).sub(this.prox).normalize();
        const key = this.aimTarget(this.tip, this.dir);
        this.updateBeam(this.tip, this.dir, Math.min(AIM_DIST, 1.2), true);
        if (key && key === st.dwellKey) {
          st.dwellT += delta;
          if (st.dwellT >= DWELL_S) {
            feed(`Point-press → ${key === 'dig-x' ? 'the X' : key}`);
            emit('gesturePress', key);
            st.dwellKey = null;
            st.dwellT = 0;
          }
        } else {
          st.dwellKey = key;
          st.dwellT = 0;
        }
      }
      const A = (globalThis as any).__atlas;
      if (A) {
        A.gesture = {
          pose,
          vel: +st.vel.toFixed(2),
          thumbKnuckle: +j.get('thumb-tip')!.distanceTo(j.get('index-finger-phalanx-proximal')!).toFixed(3),
          tip: [+this.tip.x.toFixed(3), +this.tip.y.toFixed(3), +this.tip.z.toFixed(3)],
          dir: [+this.dir.x.toFixed(3), +this.dir.y.toFixed(3), +this.dir.z.toFixed(3)],
        };
      }

      // ---- fist: thrown punch (edit mode: place block at the cursor) ----
      if (pose === 'fist' && st.vel > PUNCH_SPEED && st.punchCooldown <= 0) {
        st.punchCooldown = 0.6;
        bumpEffort('punch');
        if (G.rng() < punchPowerChance()) {
          addPower(1);
          feed('Your fist rings true - the world yields a spark of power.');
        }
        const adv = G.mode === 'adv';
        const range = adv ? ADV_PUNCH : PUNCH_RANGE;
        // a punch thrown at a figure is aimed contact, in any mode
        const patron = Anchors.get('patron');
        if (patron?.visible) {
          patron.getWorldPosition(this.toT);
          if (adv) this.toT.y += ADV_BODY_H;
          if (this.toT.distanceTo(knuckle) < range) {
            feed('You fist-bump the patron!');
            emit('gesturePress', 'patron');
            continue;
          }
        }
        const wizard = Anchors.get('wizard');
        if (wizard?.visible) {
          wizard.getWorldPosition(this.toT);
          if (adv) this.toT.y += ADV_BODY_H;
          if (this.toT.distanceTo(knuckle) < range) {
            feed('The Wizard chuckles - the lesson begins again.');
            emit('gesturePress', 'wizard-bump');
            continue;
          }
        }
        if (G.editing) {
          feed('POW - block placed');
          emit('gesturePress', 'vox-add');
          continue;
        }
        const digx = Anchors.get('dig-x');
        if (digx?.visible && G.activeDigId >= 0) {
          digx.getWorldPosition(this.toT);
          // the X lies flat on the ground - a punch from standing height still counts
          if (this.toT.distanceTo(knuckle) < range + (adv ? 0.5 : 0)) {
            feed('POW - you punched the X!');
            emit('gesturePress', 'dig-x');
            continue;
          }
        }
        const haven = Anchors.get('haven');
        if (haven?.visible) {
          haven.getWorldPosition(this.toT);
          // the ring stands on the ground - same standing-punch slack as the X
          if (this.toT.distanceTo(knuckle) < range + (adv ? 0.5 : 0)) {
            feed('Your fist rings the haven gate!');
            emit('gesturePress', 'haven');
            continue;
          }
        }
        feed('Punch! (nothing in reach)');
      }

      // ---- open-palm swipe (edit mode, no offer live): break a block ----
      if (pose === 'open' && G.editing && !G.offer && st.vel > PUNCH_SPEED && st.punchCooldown <= 0) {
        st.punchCooldown = 0.6;
        feed('Swipe - block broken');
        emit('gesturePress', 'vox-break');
        continue;
      }

      // ---- NPC replies: thumbs-up = take, open palm = refuse ----
      // one emit per pose entry - a fresh offer arriving mid-gesture is never
      // auto-answered by a stale pose
      if ((pose === 'thumbsup' || pose === 'open') && st.repliedPose !== pose) {
        st.repliedPose = pose;
        if (G.offer) emit('npcReply', pose === 'thumbsup' ? 'take' : 'refuse');
        else if (pose === 'thumbsup') emit('wizardHint'); // a deliberate sign deserves an answer
      }
    }
    // hide beam when no pointing hand
    let anyPoint = false;
    for (const side of seen) {
      const st = this.hands.get(side);
      if (st && st.pose === 'point') anyPoint = true;
    }
    if (!anyPoint) this.beam.visible = false;
  }
}
