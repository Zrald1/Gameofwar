/**
 * GestureSystem — reads real WebXR hand joints each frame and turns poses
 * into game verbs:
 *   point   — fingertip aims a beam at the X / wish / haven ring; dwelling
 *             ~0.45s presses it (point-to-select)
 *   fist    — a closed fist thrown forward punches the X to break ground
 *   thumbs-up / open palm — while a patron offer is live: take it / send away
 * On a Quest the tracked joints drive this; in IWER, set-hand-pose drives
 * the same joints.
 */
import { createSystem, CylinderGeometry, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from '@iwsdk/core';
import { Anchors, emit, feed, G, on } from '../state.js';

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

interface HandState {
  pose: Pose;
  prevKnuckle: Vector3;
  vel: number;
  dwellKey: string | null;
  dwellT: number;
  punchCooldown: number;
  repliedPose: Pose;
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
    // fingertip aim beam — visible while pointing
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
    let best: string | null = null;
    let bestD = AIM_DIST;
    // proximity aim — a pointing fingertip hovering on a thing IS pointing
    // at it (poke semantics); generous on purpose
    let nearD = 0.12;
    for (const key of ['dig-x', 'wish', 'haven', 'patron'] as const) {
      const obj = Anchors.get(key);
      if (!obj || !obj.visible) continue;
      if (key === 'dig-x' && G.activeDigId < 0) continue;
      obj.getWorldPosition(this.toT);
      const d = this.toT.distanceTo(origin);
      if (d < nearD) {
        nearD = d;
        best = key;
        bestD = d;
      }
    }
    if (best) return best;
    // ray aim — fingertip direction for pointing at things farther away
    for (const key of ['dig-x', 'wish', 'haven', 'patron'] as const) {
      const obj = Anchors.get(key);
      if (!obj || !obj.visible) continue;
      if (key === 'dig-x' && G.activeDigId < 0) continue;
      obj.getWorldPosition(this.toT).sub(origin);
      const along = this.toT.dot(dir);
      if (along < 0.05 || along > AIM_DIST) continue;
      const miss = this.toT.addScaledVector(dir, -along).length();
      if (miss < AIM_CONE + along * 0.09 && along < bestD) {
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

      // ---- fist: thrown punch ----
      if (pose === 'fist' && st.vel > PUNCH_SPEED && st.punchCooldown <= 0) {
        st.punchCooldown = 0.6;
        const digx = Anchors.get('dig-x');
        if (digx?.visible && G.activeDigId >= 0) {
          digx.getWorldPosition(this.toT);
          if (this.toT.distanceTo(knuckle) < PUNCH_RANGE) {
            feed('POW — you punched the X!');
            emit('gesturePress', 'dig-x');
            continue;
          }
        }
        const patron = Anchors.get('patron');
        if (patron?.visible) {
          patron.getWorldPosition(this.toT);
          if (this.toT.distanceTo(knuckle) < PUNCH_RANGE) {
            feed('You fist-bump the patron!');
            emit('gesturePress', 'patron');
            continue;
          }
        }
        feed('Punch! (nothing in reach)');
      }

      // ---- NPC replies: thumbs-up = take, open palm = refuse ----
      // one emit per pose entry — a fresh offer arriving mid-gesture is never
      // auto-answered by a stale pose
      if (G.offer && (pose === 'thumbsup' || pose === 'open') && st.repliedPose !== pose) {
        st.repliedPose = pose;
        emit('npcReply', pose === 'thumbsup' ? 'take' : 'refuse');
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
