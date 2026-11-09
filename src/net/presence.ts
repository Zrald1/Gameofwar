/**
 * Presence seam — IWSDK ships no netcode by design, so transport lives behind
 * an app-owned interface. Two transports ship:
 *   BroadcastPresence - zero infrastructure, works across tabs same machine
 *   WsPresence        - online play via tools/presence-relay.mjs (?relay=ws://...)
 * Swap transports without touching gameplay systems.
 */

export interface PresenceService {
  readonly id: string;
  readonly connected: boolean;
  /** peers currently in the room (excluding self) */
  peers(): string[];
  send(msg: Record<string, unknown>): void;
  onMessage(fn: (peerId: string, msg: any) => void): void;
  /** role: 'senior' = we were here first (we host the chart); 'junior' = we just arrived */
  onPeer(fn: (peerId: string, joined: boolean, role?: 'senior' | 'junior') => void): void;
  leave(): void;
}

const now = () => Date.now();
const newId = () => Math.random().toString(36).slice(2, 9);

class Base {
  readonly id = newId();
  protected msgFns: ((p: string, m: any) => void)[] = [];
  protected peerFns: ((p: string, j: boolean, r?: 'senior' | 'junior') => void)[] = [];
  onMessage(fn: (p: string, m: any) => void): void {
    this.msgFns.push(fn);
  }
  onPeer(fn: (p: string, j: boolean, r?: 'senior' | 'junior') => void): void {
    this.peerFns.push(fn);
  }
  protected emitMsg(p: string, m: any): void {
    for (const f of this.msgFns) f(p, m);
  }
  protected emitPeer(p: string, j: boolean, r?: 'senior' | 'junior'): void {
    for (const f of this.peerFns) f(p, j, r);
  }
}

/** same-machine tabs share a BroadcastChannel - instant local multiplayer */
class BroadcastPresence extends Base implements PresenceService {
  private bc: BroadcastChannel;
  private seen = new Map<string, number>();
  private timer: number;

  constructor(private room: string) {
    super();
    this.bc = new BroadcastChannel(`atlas-room-${room}`);
    this.bc.onmessage = (ev) => this.onRaw(ev.data);
    this.send({ t: 'hello' });
    this.timer = setInterval(() => {
      this.send({ t: 'beat' });
      for (const [p, t] of this.seen) {
        if (now() - t > 5000) {
          this.seen.delete(p);
          this.emitPeer(p, false);
        }
      }
    }, 1500) as unknown as number;
  }

  get connected(): boolean {
    return true;
  }
  peers(): string[] {
    return [...this.seen.keys()];
  }
  send(msg: Record<string, unknown>): void {
    try {
      this.bc.postMessage({ ...msg, p: this.id });
    } catch {}
  }
  leave(): void {
    this.send({ t: 'bye' });
    clearInterval(this.timer);
    this.bc.close();
  }
  private onRaw(d: any): void {
    if (!d || d.p === this.id) return;
    if (d.t === 'hello') {
      const isNew = !this.seen.has(d.p);
      this.seen.set(d.p, now());
      this.send({ t: 'here' });
      if (isNew) this.emitPeer(d.p, true, 'senior');
      return;
    }
    if (d.t === 'here') {
      if (!this.seen.has(d.p)) {
        this.seen.set(d.p, now());
        this.emitPeer(d.p, true, 'junior');
      }
      return;
    }
    if (d.t === 'bye') {
      if (this.seen.delete(d.p)) this.emitPeer(d.p, false);
      return;
    }
    if (d.t === 'beat') {
      this.seen.set(d.p, now());
      return;
    }
    this.seen.set(d.p, now());
    this.emitMsg(d.p, d);
  }
}

/** online rooms through a tiny ws relay (tools/presence-relay.mjs) */
class WsPresence extends Base implements PresenceService {
  private ws: WebSocket;
  private peerSet = new Set<string>();
  private queue: string[] = [];
  private open = false;
  /** first seconds after connect we are the newcomer */
  private warmUntil = now() + 3000;

  constructor(url: string, room: string) {
    super();
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.open = true;
      this.warmUntil = now() + 3000;
      this.ws.send(JSON.stringify({ t: 'join', room, id: this.id }));
      for (const m of this.queue) this.ws.send(m);
      this.queue = [];
    };
    this.ws.onclose = () => {
      this.open = false;
      for (const p of this.peerSet) this.emitPeer(p, false);
      this.peerSet.clear();
    };
    this.ws.onmessage = (ev) => {
      let d: any;
      try {
        d = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!d) return;
      if (d.t === 'peer+') {
        this.peerSet.add(d.p);
        this.emitPeer(d.p, true, now() < this.warmUntil ? 'junior' : 'senior');
      } else if (d.t === 'peer-') {
        this.peerSet.delete(d.p);
        this.emitPeer(d.p, false);
      } else if (d.p && d.p !== this.id) {
        this.emitMsg(d.p, d);
      }
    };
  }

  get connected(): boolean {
    return this.open;
  }
  peers(): string[] {
    return [...this.peerSet];
  }
  send(msg: Record<string, unknown>): void {
    const s = JSON.stringify({ ...msg, p: this.id });
    if (this.open) {
      try {
        this.ws.send(s);
      } catch {}
    } else this.queue.push(s);
  }
  leave(): void {
    this.ws.close();
  }
}

/** ?relay=ws(s)://host:port picks the online transport; default BroadcastChannel */
export function createPresence(room: string): PresenceService {
  const relay = new URLSearchParams(location.search).get('relay');
  if (relay) {
    try {
      return new WsPresence(relay, room);
    } catch { /* malformed relay url - fall back to local */ }
  }
  return new BroadcastPresence(room);
}
