// The co-op relay. One Worker routes requests; one Durable Object per room
// holds the two sockets and forwards frames between them.
//
//   POST /new        -> { "code": "XXXXXX" }, a room nobody has used
//   GET  /room/CODE  -> WebSocket. The first socket in is the host (pid 1),
//                       the second the friend (pid 2).
//
// Frames are binary and opaque. Friend to host: the relay prepends the
// sender's pid (always 2). Host to friend: the host's first byte is the
// addressee's pid and the relay strips it. The relay's own frames start
// with 0: [0, 1, pid] "joined" and [0, 2, pid] "left" to the host,
// [0, 2] "the host left" to the friend.
//
// Nothing is stored but whether a room exists and when its code was issued,
// and nothing is logged. It uses the WebSocket Hibernation API, so a room
// whose sockets are quiet is not held in memory or billed for duration.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 characters
const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;
const MAX_FRAME = 16384; // bytes, as sent
const MAX_RATE = 120; // frames in any one second, per socket
const WAIT_MS = 10 * 60 * 1000; // a code is good for a first socket this long
const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function allowed(origin, env) {
  if (origin === null) return true;
  if (LOCAL_RE.test(origin)) return true;
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .includes(origin);
}

function cors(origin) {
  if (origin === null) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function makeCode() {
  const code = [];
  const buf = new Uint8Array(16);
  while (code.length < 6) {
    crypto.getRandomValues(buf);
    // 248 = 31 * 8, so every character is equally likely
    for (const b of buf) if (b < 248 && code.length < 6) code.push(ALPHABET[b % 31]);
  }
  return code.join("");
}

// Accepts the upgrade and closes with a code, so that a browser can read it.
function refuse(code, reason) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    if (!allowed(origin, env)) return new Response("origin not allowed", { status: 403 });

    if (url.pathname === "/new") {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
      if (req.method !== "POST") return new Response("POST only", { status: 405 });
      for (let i = 0; i < 8; i++) {
        const code = makeCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await room.fetch("https://room/init", { method: "POST" });
        if (r.status === 200) {
          return new Response(JSON.stringify({ code }), {
            headers: { "Content-Type": "application/json", ...cors(origin) },
          });
        }
      }
      return new Response("no free code", { status: 503, headers: cors(origin) });
    }

    const m = /^\/room\/([^/]+)$/.exec(url.pathname);
    if (m) {
      if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
        return new Response("WebSocket only", { status: 426 });
      }
      if (!CODE_RE.test(m[1])) return refuse(4004, "no such room");
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    return new Response("not found", { status: 404 });
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sent = new Map(); // socket -> recent frame times; lost on hibernation, which is harmless
  }

  wait() {
    return Number(this.env.ROOM_WAIT_MS) || WAIT_MS;
  }

  // The sockets still in the room with this pid (or any pid): open, and not
  // marked gone. The mark is kept in the socket's attachment so that it
  // survives hibernation.
  seats(pid) {
    return this.state.getWebSockets(pid ? String(pid) : undefined).filter((w) => {
      try {
        return w.readyState === 1 && !w.deserializeAttachment().gone;
      } catch {
        return false;
      }
    });
  }

  // A room is in use while it has a seat taken, or its code is still fresh.
  async live() {
    const room = await this.state.storage.get("room");
    if (!room) return false;
    return this.seats().length > 0 || Date.now() - room.issued < this.wait();
  }

  async end() {
    await this.state.storage.deleteAll();
    await this.state.storage.deleteAlarm();
  }

  async fetch(req) {
    if (new URL(req.url).pathname === "/init") {
      if (await this.live()) return new Response("in use", { status: 409 });
      await this.state.storage.put("room", { issued: Date.now() });
      await this.state.storage.setAlarm(Date.now() + this.wait());
      return new Response("ok");
    }

    if (!(await this.live())) {
      await this.end();
      return refuse(4004, "no such room");
    }
    const host = this.seats(1)[0];
    const pid = !host ? 1 : !this.seats(2).length ? 2 : 0;
    if (!pid) return refuse(4001, "room is full");
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server, [String(pid)]);
    server.serializeAttachment({ pid });
    if (pid === 2) host.send(Uint8Array.of(0, 1, 2));
    return new Response(null, { status: 101, webSocket: client });
  }

  // A code nobody used in time is forgotten.
  async alarm() {
    if (this.seats().length === 0) await this.end();
  }

  tooFast(ws) {
    const now = Date.now();
    const times = this.sent.get(ws) || [];
    times.push(now);
    if (times.length > MAX_RATE + 1) times.shift();
    this.sent.set(ws, times);
    return times.length > MAX_RATE && now - times[0] < 1000;
  }

  async kick(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {}
    await this.leave(ws);
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg === "string") return this.kick(ws, 1003, "binary only");
    if (this.tooFast(ws)) return this.kick(ws, 4008, "too many frames");
    if (msg.byteLength > MAX_FRAME) return this.kick(ws, 4009, "frame too large");
    if (msg.byteLength === 0) return;
    const bytes = new Uint8Array(msg);
    const { pid, gone } = ws.deserializeAttachment();
    if (gone) return;
    if (pid === 2) {
      const host = this.seats(1)[0];
      if (!host) return;
      const out = new Uint8Array(bytes.length + 1);
      out[0] = 2;
      out.set(bytes, 1);
      host.send(out);
    } else if (bytes[0] === 2) {
      const friend = this.seats(2)[0];
      if (friend) friend.send(bytes.subarray(1));
    }
  }

  async webSocketClose(ws, code) {
    await this.leave(ws);
    try {
      const echo = code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code);
      ws.close(echo ? code : 1000, "");
    } catch {}
  }

  async webSocketError(ws) {
    await this.leave(ws);
  }

  // Marks a socket gone, and says whether it was not already.
  retire(ws) {
    try {
      const att = ws.deserializeAttachment();
      if (att.gone) return null;
      ws.serializeAttachment({ pid: att.pid, gone: true });
      return att.pid;
    } catch {
      return null;
    }
  }

  // A socket is gone, however it went. The friend going tells the host and
  // frees the seat; the host going tells the friend and ends the room.
  async leave(ws) {
    this.sent.delete(ws);
    const pid = this.retire(ws);
    if (pid === 2) {
      const host = this.seats(1)[0];
      if (host) host.send(Uint8Array.of(0, 2, 2));
    } else if (pid === 1) {
      for (const friend of this.seats(2)) {
        this.retire(friend);
        try {
          friend.send(Uint8Array.of(0, 2));
          friend.close(1000, "host left");
        } catch {}
      }
      await this.end();
    }
  }
}
