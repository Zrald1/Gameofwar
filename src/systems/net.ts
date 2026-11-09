/**
 * NetAvatarSystem — presence over the PresenceService seam. Broadcasts head
 * pose + champion tile + character look at 10 Hz; mirrors each remote peer as
 * a ghost figure at their viewpoint and a colored marker on their champion's
 * tile. Remote map edits replay as tile stamps; on join, the peer with a map
 * shares it so everyone charts the same land. BroadcastChannel covers same-
 * machine tabs; ?relay=ws://host:8787&room=<name> goes online via the relay.
 */
import {
  Color,
  ConeGeometry,
  createSystem,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { createPresence, PresenceService } from '../net/presence.js';
import { decodeMap, applyMap, serializeMap, stampTile, stampVox } from '../gen/mapdef.js';
import { feed, G, on } from '../state.js';
import { worldTilePos } from '../layout.js';
import { RemoteAvatar } from '../components.js';

const SEND_HZ = 10;

interface PeerView {
  ghost: Group;
  marker: Mesh;
  pos: Vector3;
  ci: number;
  cj: number;
  color: number;
}

export class NetAvatarSystem extends createSystem({}) {
  private net!: PresenceService;
  private peers = new Map<string, PeerView>();
  private sendAcc = 0;
  private v = new Vector3();
  private p = { x: 0, y: 0, z: 0 };
  private col = new Color();

  init(): void {
    const room = new URLSearchParams(location.search).get('room') ?? 'default';
    this.net = createPresence(room);
    this.net.onPeer((p, joined, role) => {
      if (joined) {
        feed('A wanderer joins your table');
        // only the senior side shares the chart - no map echo between peers
        if (G.map && role !== 'junior') this.net.send({ t: 'map', def: serializeMap(G.map) });
      } else {
        this.dropPeer(p);
        feed('A wanderer leaves the table');
      }
      G.peers = this.net.peers().length;
      G.hudDirty = true;
    });
    this.net.onMessage((p, m) => this.onMsg(p, m));
    on('tileEdit', (wx: number, wz: number, r: number, tool: string) => {
      this.net.send({ t: 'tile', x: wx, z: wz, r, tool });
    });
    on('voxEdit', (wx: number, wz: number, r: number, op: string, mat: string) => {
      this.net.send({ t: 'vox', x: wx, z: wz, r, op, mat });
    });
    addEventListener('beforeunload', () => this.net.leave());
  }

  private onMsg(p: string, m: any): void {
    if (m.t === 'pose') {
      const view = this.peers.get(p) ?? this.spawnPeer(p);
      view.pos.set(m.p[0], m.p[1], m.p[2]);
      view.ci = m.c[0];
      view.cj = m.c[1];
      if (typeof m.col === 'number' && m.col !== view.color) {
        view.color = m.col;
        this.tint(view, m.col);
      }
    } else if (m.t === 'tile' && G.map) {
      stampTile(G.map, m.x | 0, m.z | 0, m.r | 0, String(m.tool));
      G.terrainDirty = true;
    } else if (m.t === 'vox' && G.map) {
      stampVox(G.map, m.x | 0, m.z | 0, m.r | 0, String(m.op), String(m.mat));
      G.terrainDirty = true;
      feed('A wanderer shapes the world');
    } else if (m.t === 'map') {
      const def = decodeMap(typeof m.def === 'string' ? JSON.parse(m.def) : m.def);
      if (def) {
        applyMap(def);
        feed(`The wanderer's chart unfolds - ${def.name}`);
      }
    }
  }

  private spawnPeer(p: string): PeerView {
    const mat = new MeshStandardMaterial({ color: 0x9aa4b8, roughness: 0.6, transparent: true, opacity: 0.9 });
    const ghost = new Group();
    const body = new Mesh(new ConeGeometry(0.045, 0.11, 10), mat);
    body.position.y = 0.055;
    ghost.add(body);
    const head = new Mesh(new SphereGeometry(0.03, 12, 10), mat);
    head.position.y = 0.135;
    ghost.add(head);
    const marker = new Mesh(new SphereGeometry(0.008, 8, 6), new MeshStandardMaterial({ color: 0x9aa4b8 }));
    const e = this.world.createTransformEntity(ghost);
    e.addComponent(RemoteAvatar);
    const e2 = this.world.createTransformEntity(marker);
    e2.addComponent(RemoteAvatar);
    const view: PeerView = { ghost, marker, pos: new Vector3(), ci: 0, cj: 0, color: 0x9aa4b8 };
    view.ghost.visible = false;
    view.marker.visible = false;
    this.peers.set(p, view);
    return view;
  }

  private dropPeer(p: string): void {
    const view = this.peers.get(p);
    if (!view) return;
    view.ghost.removeFromParent();
    view.marker.removeFromParent();
    this.peers.delete(p);
  }

  private tint(view: PeerView, hex: number): void {
    this.col.setHex(hex);
    (view.ghost.children[0] as Mesh).material = new MeshStandardMaterial({ color: this.col.getHex(), transparent: true, opacity: 0.9 });
    (view.ghost.children[1] as Mesh).material = new MeshStandardMaterial({ color: this.col.getHex(), transparent: true, opacity: 0.9 });
    (view.marker.material as MeshStandardMaterial).color.copy(this.col);
  }

  update(delta: number): void {
    this.sendAcc += delta;
    if (this.sendAcc >= 1 / SEND_HZ) {
      this.sendAcc = 0;
      this.world.camera.getWorldPosition(this.v);
      this.net.send({
        t: 'pose',
        p: [this.v.x, this.v.y, this.v.z],
        c: [G.ci, G.cj],
        col: G.charColor || 0x4f8fd8,
        hat: G.charHat,
      });
    }
    for (const view of this.peers.values()) {
      if (view.pos.lengthSq() > 0) {
        view.ghost.visible = true;
        view.ghost.position.lerp(view.pos, Math.min(1, delta * 8));
      }
      if (worldTilePos(view.ci, view.cj, this.p)) {
        view.marker.visible = true;
        view.marker.position.set(this.p.x, this.p.y + 0.01, this.p.z);
      } else {
        view.marker.visible = false;
      }
    }
  }
}
