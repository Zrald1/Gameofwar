/**
 * Presence relay — a tiny WebSocket room server for online play.
 *   npm run relay            (ws://localhost:8787)
 *   PORT=9000 npm run relay
 * Clients join a room with {t:'join', room, id}; the relay keeps rooms,
 * notifies peers (peer+/peer-), and forwards every other message verbatim.
 */
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port: PORT });
/** room -> Map<clientId, ws> */
const rooms = new Map();

wss.on('connection', (ws) => {
  let room = null;
  let id = null;
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!room) {
      if (msg.t !== 'join' || !msg.room || !msg.id) return ws.close();
      room = String(msg.room);
      id = String(msg.id);
      if (!rooms.has(room)) rooms.set(room, new Map());
      const peers = rooms.get(room);
      for (const pid of peers.keys()) ws.send(JSON.stringify({ t: 'peer+', p: pid }));
      for (const p of peers.values()) {
        try { p.send(JSON.stringify({ t: 'peer+', p: id })); } catch {}
      }
      peers.set(id, ws);
      console.log(`+ ${id} -> ${room} (${peers.size} in room)`);
      return;
    }
    // inside a room: relay verbatim to everyone else
    const peers = rooms.get(room);
    if (!peers) return;
    const s = data.toString();
    for (const [pid, peer] of peers) {
      if (pid !== id && peer.readyState === 1) peer.send(s);
    }
  });
  ws.on('close', () => {
    const peers = room && rooms.get(room);
    if (!peers) return;
    peers.delete(id);
    for (const p of peers.values()) {
      try { p.send(JSON.stringify({ t: 'peer-', p: id })); } catch {}
    }
    if (peers.size === 0) rooms.delete(room);
    console.log(`- ${id} <- ${room}`);
  });
});

console.log(`atlas presence relay on ws://0.0.0.0:${PORT}`);
console.log(`clients: open the app with ?relay=ws://<this-host>:${PORT}&room=<name>`);
