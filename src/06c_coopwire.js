// Co-op: the numbers both ends share. This file and 06d are part of the host
// copy of the simulation, which runs in a Worker or in Node, so nothing here
// touches the screen.
// COOP_V is the wire's own version: change it when a message's layout
// changes. Pages on different builds are told apart by COOP_BUILD, which
// build.mjs declares before the sources (a hash of them), so neither needs
// remembering when MOVES or EDEF are tuned.
const COOP_V = 4;
const COOP = {
  SNAP: 1, // message kinds
  STATE: 2,
  EVENT: 3,
  STEP: 1 / 60, // a host step
  SNAP_EVERY: 3, // steps between snapshots, so 20 a second
  STATE_HZ: 30, // client states a second
  DELAY: 0.1, // draw delay, seconds
  RANGE: 45, // enemies within this of a player go in a snapshot
  AWAY: 2, // seconds of silence before a player counts as away
  CLOCK_WIN: 0.6, // clock window, seconds
  WAIT: 1, // seconds without a snapshot before "Waiting for the host"
  GONE: 10, // seconds of silence before a player leaves
  STICK: 3, // target hysteresis, metres
  MAX_DMG: 500,
  // A relay socket with more than this many bytes still queued drops snapshot
  // and state frames rather than queue them (events still go), so a backlog
  // sent in one burst after a stall stays small; the relay lets a burst of
  // 600 frames through and holds a socket to 120 a second after that.
  SOCK_FULL: 8192,
  TICK_MAX: 0.25, // the most elapsed time the Worker hands the host in one call
  GRADES: ["E"], // the grades a co-op room may travel to (the co-op hall opens E only)
  BESIDE: 1.2, // metres to the right of the arrival point the friend (pid 2) arrives
};
// A cave entered by two players is harder (docs/notes/coop.md, "A dungeon for
// two"). extra: enemies added to each room pack, extraDeep to a deep pack,
// one holding two or more brutes; hp and post: health and
// posture of regular enemies, bossHp and bossPost the boss's (the Warden's
// health is WARDEN2.hp's); turns: attack turns held against each player at
// once; bossHeal: the share of its full health the boss regains when a
// player dies in its chamber.
const COOP_TWO = { extra: 1, extraDeep: 2, hp: 1.3, post: 1.3, bossHp: 2.5, bossPost: 1.5, turns: 2, bossHeal: 0.25 };
// The enemy definitions of a dungeon for two, by type: each type's own
// entry behind an object with its health and posture scaled, the dummy's
// left as it is. EDEF itself is never changed. The Warden's is the Warden
// for two (WARDEN2 in 06b): duo, its marks and roar lengths, and an atks
// object of its own holding the solo Warden's attacks, the same objects in
// the same order, since a snapshot finds an attack by its index there; its
// slam is a copy with the aftershock, at the same place in that order.
function coopTwoDefs() {
  const out = {};
  for (const [k, d] of Object.entries(EDEF)) {
    if (d.dummy) {
      out[k] = d;
      continue;
    }
    const o = Object.create(d);
    o.hp = Math.round(d.hp * (d.boss ? COOP_TWO.bossHp : COOP_TWO.hp));
    o.posture = Math.round(d.posture * (d.boss ? COOP_TWO.bossPost : COOP_TWO.post));
    if (k === "warden")
      Object.assign(o, {
        hp: Math.round(d.hp * WARDEN2.hp),
        duo: true,
        marks: WARDEN2.marks,
        roarT: WARDEN2.roar,
        atks: { ...d.atks, slam: { ...d.atks.slam, after: WARDEN2.wave } },
      });
    out[k] = o;
  }
  return out;
}
// The extra spawns of a dungeon for two, { type, x, z, yaw, node } each, to
// go after the world's own. Room packs only: tunnel posts (node -1) and the
// boss get none. Each extra is one more of a member of its pack, drawn in
// spawn order from a generator of its own seeded from the cave's, standing 1
// to 2.5 m from that member, pushed out of the rock as genWorld pushes its
// own. The same world and seed give the same list.
function coopExtras(world, seed) {
  const R = rng(seed ^ 0x2c0),
    groups = new Map(),
    out = [];
  for (const s of world.spawns) {
    if (s.node < 0 || (EDEF[s.type] && EDEF[s.type].boss)) continue;
    if (!groups.has(s.node)) groups.set(s.node, []);
    groups.get(s.node).push(s);
  }
  for (const [node, g] of groups) {
    const deep = g.filter((s) => s.type === "brute").length >= 2,
      n = deep ? COOP_TWO.extraDeep : COOP_TWO.extra;
    for (let k = 0; k < n; k++) {
      const m = g[Math.floor(R() * g.length)],
        a = R() * TAU,
        d = 1 + R() * 1.5,
        o = { x: m.x + Math.sin(a) * d, z: m.z + Math.cos(a) * d };
      world.resolve(o, 1.2);
      out.push({ type: m.type, x: o.x, z: o.z, yaw: R() * TAU, node });
    }
  }
  return out;
}

// Where player pid arrives in world, whose arrival point (where it puts its
// player) is (x, z) facing yaw: pid 1 on the point, the friend (pid 2)
// COOP.BESIDE metres to its right, pushed out of the rock for a body of
// radius r, so the two do not stand inside each other. The host's build and
// a page's coopBuild both place by it, so they agree.
function coopSpot(world, pid, x, z, yaw, r) {
  if (pid !== 2) return { x, z };
  const q = { x: x - Math.cos(yaw) * COOP.BESIDE, z: z + Math.sin(yaw) * COOP.BESIDE };
  world.resolve(q, r);
  return q;
}

// True only in the host copy, whose build declares COOP_HEADLESS first.
const COOP_HEADLESS_HERE = typeof COOP_HEADLESS !== "undefined";

// FNV-1a, 32 bits, over the bytes of the world's vertex positions. Two browsers
// that build the same cave from a seed must get the same string.
function coopWorldSum(world) {
  const pos = world.pos;
  const b = new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) {
    h ^= b[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// The wire. Every message is an ArrayBuffer whose first byte is COOP.SNAP,
// COOP.STATE or COOP.EVENT. Numbers are big-endian (DataView's default).
// Positions are 1/32 m in an int16 (about +-1000 m), angles 2*PI/65536 in a
// uint16, times in a state 1 ms in a uint16 (held at 65.5 s).
const COOP_PS = [
  "free", "guard", "attack", "dodge", "hit", "gbreak", "heal", "execute",
  "blink", "grapple", "inspect", "held", "dead",
];
const COOP_ES = [
  "idle", "alert", "chase", "search", "wind", "act", "rec", "hit",
  "recoil", "stagger", "roar", "return", "dead", "fall", "hold",
];
const COOP_MOVES = Object.keys(MOVES);
const coopQ = (v) => clamp(Math.round(v * 32), -32768, 32767);
const coopAng = (a) => Math.round(((((a % TAU) + TAU) % TAU) / TAU) * 65536) % 65536;
const coopU8 = (v) => clamp(Math.round(v), 0, 255);
const coopMs = (t) => clamp(Math.round(t * 1000), 0, 65535);
const coopIdx = (list, k) => Math.max(0, list.indexOf(k));

function coopType(buf) {
  return new DataView(buf).getUint8(0);
}

// Snapshot, host to client, 20 a second.
//   header 10 bytes: 0 type (1), 1 t u32 ms, 5 ack u16, 7 players u8, 8 enemies u16
//   player 15 bytes: 0 pid u8, 1 x i16, 3 z i16, 5 yaw u16, 7 state u8,
//     8 time in state u16 ms, 10 move u8 (0 none, else MOVES index + 1),
//     11 hp u8 (of 255), 12 speed u8 (1/8 m/s), 13 guardT u8 (1/100 s),
//     14 flags u8 (1 sprint, 2 away)
//   enemy 19 bytes: 0 id u16, 2 x i16, 4 z i16, 6 y u8 (1/8 m), 7 yaw u16,
//     9 state u8, 10 time in state u16 ms, 12 atk u8 (0 none, else index in
//     Object.keys(def.atks) + 1), 13 an u8, 14 hp u16 (1/8), 16 posture u8
//     (of 255 of def.posture), 17 flags u8 (1 aware, 4 dead, 8 and 16 pin,
//     the pid executing it, 32 and 64 the phase less one), 18 dur u8 (1/32 s)
const COOP_SNAP_HEAD = 10,
  COOP_SNAP_PL = 15,
  COOP_SNAP_EN = 19;
function coopSnapEncode(t, ack, players, enemies) {
  const b = new ArrayBuffer(
      COOP_SNAP_HEAD + players.length * COOP_SNAP_PL + enemies.length * COOP_SNAP_EN,
    ),
    v = new DataView(b);
  v.setUint8(0, COOP.SNAP);
  v.setUint32(1, Math.round(t * 1000));
  v.setUint16(5, ack & 65535);
  v.setUint8(7, players.length);
  v.setUint16(8, enemies.length);
  let o = COOP_SNAP_HEAD;
  for (const p of players) {
    v.setUint8(o, p.pid);
    v.setInt16(o + 1, coopQ(p.x));
    v.setInt16(o + 3, coopQ(p.z));
    v.setUint16(o + 5, coopAng(p.yaw));
    v.setUint8(o + 7, coopIdx(COOP_PS, p.state));
    v.setUint16(o + 8, coopMs(p.t));
    v.setUint8(o + 10, p.move ? COOP_MOVES.indexOf(p.move) + 1 : 0);
    v.setUint8(o + 11, coopU8((p.hp / p.maxHp) * 255));
    v.setUint8(o + 12, coopU8(p.speed * 8));
    v.setUint8(o + 13, coopU8(p.guardT * 100));
    v.setUint8(o + 14, (p.sprint ? 1 : 0) | (p.away ? 2 : 0));
    o += COOP_SNAP_PL;
  }
  for (const e of enemies) {
    const post = e.def.posture ? e.posture / e.def.posture : 0;
    v.setUint16(o, e.id);
    v.setInt16(o + 2, coopQ(e.x));
    v.setInt16(o + 4, coopQ(e.z));
    v.setUint8(o + 6, coopU8(e.y * 8));
    v.setUint16(o + 7, coopAng(e.yaw));
    v.setUint8(o + 9, coopIdx(COOP_ES, e.state));
    v.setUint16(o + 10, coopMs(e.t));
    const keys = Object.keys(e.def.atks || {});
    v.setUint8(o + 12, e.atk ? keys.findIndex((k) => e.def.atks[k] === e.atk) + 1 : 0);
    v.setUint8(o + 13, e.an & 255);
    v.setUint16(o + 14, clamp(Math.round(e.hp * 8), 0, 65535));
    v.setUint8(o + 16, coopU8(post * 255));
    v.setUint8(
      o + 17,
      (e.aware ? 1 : 0) |
        (e.dead ? 4 : 0) |
        ((e.pin & 3) << 3) |
        ((clamp(e.phase, 1, 4) - 1) << 5),
    );
    v.setUint8(o + 18, coopU8((e.dur || 0) * 32));
    o += COOP_SNAP_EN;
  }
  return b;
}
function coopSnapDecode(buf) {
  const v = new DataView(buf),
    np = v.getUint8(7),
    ne = v.getUint16(8),
    out = {
      t: v.getUint32(1) / 1000,
      ack: v.getUint16(5),
      players: [],
      en: [],
    };
  let o = COOP_SNAP_HEAD;
  for (let i = 0; i < np; i++) {
    const f = v.getUint8(o + 14),
      m = v.getUint8(o + 10);
    out.players.push({
      pid: v.getUint8(o),
      x: v.getInt16(o + 1) / 32,
      z: v.getInt16(o + 3) / 32,
      yaw: (v.getUint16(o + 5) / 65536) * TAU,
      state: COOP_PS[v.getUint8(o + 7)] || "free",
      tt: v.getUint16(o + 8) / 1000,
      move: m ? COOP_MOVES[m - 1] || null : null,
      hp: v.getUint8(o + 11) / 255,
      speed: v.getUint8(o + 12) / 8,
      guardT: v.getUint8(o + 13) / 100,
      sprint: !!(f & 1),
      away: !!(f & 2),
    });
    o += COOP_SNAP_PL;
  }
  for (let i = 0; i < ne; i++) {
    const f = v.getUint8(o + 17);
    out.en.push({
      id: v.getUint16(o),
      x: v.getInt16(o + 2) / 32,
      z: v.getInt16(o + 4) / 32,
      y: v.getUint8(o + 6) / 8,
      yaw: (v.getUint16(o + 7) / 65536) * TAU,
      state: COOP_ES[v.getUint8(o + 9)] || "idle",
      tt: v.getUint16(o + 10) / 1000,
      atk: v.getUint8(o + 12) - 1,
      an: v.getUint8(o + 13),
      hp: v.getUint16(o + 14) / 8,
      post: v.getUint8(o + 16) / 255,
      aware: !!(f & 1),
      phase: ((f >> 5) & 3) + 1,
      dead: !!(f & 4),
      dur: v.getUint8(o + 18) / 32,
      pin: (f >> 3) & 3,
    });
    o += COOP_SNAP_EN;
  }
  return out;
}

// Client state, client to host, 30 a second. 19 bytes:
//   0 type (2), 1 x i16, 3 z i16, 5 yaw u16, 7 vx i16 (1/64 m/s),
//   9 vz i16 (1/64 m/s), 11 state u8, 12 time in state u16 ms,
//   14 move u8 (0 none, else MOVES index + 1), 15 hp u8 (of 255),
//   16 speed u8 (1/8 m/s), 17 guardT u8 (1/100 s), 18 flags u8 (1 sprint)
function coopStateEncode(p) {
  const b = new ArrayBuffer(19),
    v = new DataView(b);
  v.setUint8(0, COOP.STATE);
  v.setInt16(1, coopQ(p.x));
  v.setInt16(3, coopQ(p.z));
  v.setUint16(5, coopAng(p.yaw));
  v.setInt16(7, clamp(Math.round(p.vx * 64), -32768, 32767));
  v.setInt16(9, clamp(Math.round(p.vz * 64), -32768, 32767));
  v.setUint8(11, coopIdx(COOP_PS, p.state));
  v.setUint16(12, coopMs(p.t));
  v.setUint8(14, p.move ? COOP_MOVES.indexOf(p.move) + 1 : 0);
  v.setUint8(15, coopU8((p.hp / p.maxHp) * 255));
  v.setUint8(16, coopU8(p.speed * 8));
  v.setUint8(17, coopU8(p.guardT * 100));
  v.setUint8(18, p.sprint ? 1 : 0);
  return b;
}
function coopStateDecode(buf) {
  const v = new DataView(buf),
    m = v.getUint8(14);
  return {
    x: v.getInt16(1) / 32,
    z: v.getInt16(3) / 32,
    yaw: (v.getUint16(5) / 65536) * TAU,
    vx: v.getInt16(7) / 64,
    vz: v.getInt16(9) / 64,
    state: COOP_PS[v.getUint8(11)] || "free",
    tt: v.getUint16(12) / 1000,
    move: m ? COOP_MOVES[m - 1] || null : null,
    hp: v.getUint8(15) / 255,
    speed: v.getUint8(16) / 8,
    guardT: v.getUint8(17) / 100,
    sprint: !!(v.getUint8(18) & 1),
  };
}

// Events, either way. 0 type (3), then the array as UTF-8 JSON; arr[0] is
// the event's name.
function coopEventEncode(arr) {
  const j = new TextEncoder().encode(JSON.stringify(arr)),
    b = new ArrayBuffer(1 + j.length);
  new DataView(b).setUint8(0, COOP.EVENT);
  new Uint8Array(b, 1).set(j);
  return b;
}
function coopEventDecode(buf) {
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 1)));
}

// A fake network for tests. coopFakePair(cfg) joins two links, each
// { send(buf), onmessage, onclose, close() }. cfg is read at every send:
// { ping, jit, loss, hold, rnd } (ms, ms, percent, boolean, and a function
// giving a number in [0, 1) for the jitter and loss, Math.random when it is
// not set, so a test can give it a seeded one). The caller owns the
// clock and passes it, in seconds, to step(now); a frame is stamped with the
// time of the last step. A frame arrives ping / 2 +- jit later; one that is
// "lost" arrives ping + 60 ms later, as a retransmit would. Order is kept.
// While cfg.hold is true nothing is delivered; everything queued then arrives
// on the first step after it clears. close() on one end calls the other's
// onclose on the next step.
function coopFakePair(cfg) {
  let now = 0;
  const mk = () => ({ q: [], last: 0, closed: false, closeSent: false });
  const ab = mk(), // frames going client to host
    ba = mk(); // frames going host to client
  const end = (out, name) => {
    const L = {
      onmessage: null,
      onclose: null,
      name,
      send(buf) {
        if (L.closed || out.closed) return;
        const rnd = cfg.rnd || Math.random;
        let due = now + (cfg.ping / 2 + (rnd() * 2 - 1) * cfg.jit) / 1000;
        if (rnd() * 100 < cfg.loss) due += (cfg.ping + 60) / 1000;
        due = Math.max(due, out.last);
        out.last = due;
        if (cfg.hold) for (const m of out.q) m.held = true;
        out.q.push({ due, buf, held: !!cfg.hold });
      },
      close() {
        L.closed = true;
        out.closed = true;
        out.closeSent = false;
      },
    };
    return L;
  };
  const client = end(ab, "client"),
    host = end(ba, "host");
  const pump = (Q, to) => {
    if (cfg.hold) {
      for (const m of Q.q) m.held = true;
      return;
    }
    while (Q.q.length && (Q.q[0].held || Q.q[0].due <= now)) {
      const m = Q.q.shift();
      if (to.onmessage) to.onmessage(m.buf);
    }
  };
  const step = (t) => {
    now = t;
    pump(ab, host);
    pump(ba, client);
    for (const [Q, to] of [[ab, host], [ba, client]])
      if (Q.closed && !Q.closeSent) {
        Q.closeSent = true;
        Q.q = [];
        to.closed = true;
        if (to.onclose) to.onclose();
      }
  };
  return { client, host, step };
}
