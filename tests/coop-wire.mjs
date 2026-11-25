// The co-op wire formats and the fake link.
// Run with: node build.mjs && node tests/coop-wire.mjs
import assert from "node:assert/strict";
import { loadHost, fakeClient, check, done } from "./lib/coop.mjs";

const host = loadHost();
host.start({ seed: 99, grade: "E" });
const W = host.wire;
const TAU = Math.PI * 2;
const near = (a, b, q, what) =>
  assert.ok(Math.abs(a - b) <= q, `${what}: ${a} vs ${b} (quantum ${q})`);
const angNear = (a, b, what) => {
  const d = Math.abs((((a - b) % TAU) + TAU) % TAU);
  assert.ok(Math.min(d, TAU - d) <= TAU / 65536, `${what}: ${a} vs ${b}`);
};
const player = (o = {}) => ({
  pid: 2, x: -12.34, z: -345.67, yaw: TAU - 0.0001, state: "gbreak", t: 1.234,
  move: W.moves[2], hp: 37, maxHp: 120, speed: 5.6, guardT: 0.37, sprint: true, away: true,
  ...o,
});
const base = host.G.enemies[0];
const enemy = (o = {}) => ({
  id: 4000, x: -88.97, y: 3.4, z: 0.01, yaw: 0.5, state: "stagger", t: 2.468,
  atk: null, an: 255, hp: 7999.875, posture: base.def.posture * 0.4, def: base.def,
  aware: true, phase: 2, dead: false, dur: 3.4, pin: 2, ...o,
});

check("the real enemy has attacks to index", () => {
  assert.ok(Object.keys(base.def.atks).length >= 1);
});

check("a snapshot survives the round trip", () => {
  const keys = Object.keys(base.def.atks);
  const k = keys.length - 1;
  const p1 = player();
  const p2 = player({ pid: 1, x: 100.01, z: 0, yaw: 0, state: "free", t: 0, move: null,
    hp: 120, speed: 0, guardT: 0, sprint: false, away: false });
  const e1 = enemy();
  const e2 = enemy({ id: 12, x: 17.5, z: -0.03, y: 0, yaw: 3.1, state: "wind", t: 0.004,
    atk: base.def.atks[keys[k]], an: 3, hp: 0, posture: 0, aware: false, phase: 1,
    dead: true, dur: 0, pin: 0 });
  const buf = W.snapEncode(123.456, 70000, [p1, p2], [e1, e2]);
  assert.equal(W.type(buf), 1);
  const d = W.snapDecode(buf);
  near(d.t, 123.456, 0.0005, "t");
  assert.equal(d.ack, 70000 & 65535);
  assert.equal(d.players.length, 2);
  assert.equal(d.en.length, 2);
  for (const [a, b] of [[d.players[0], p1], [d.players[1], p2]]) {
    assert.equal(a.pid, b.pid);
    near(a.x, b.x, 1 / 64, "px");
    near(a.z, b.z, 1 / 64, "pz");
    angNear(a.yaw, b.yaw, "pyaw");
    assert.equal(a.state, b.state);
    near(a.tt, b.t, 0.0005, "ptt");
    assert.equal(a.move, b.move);
    near(a.hp, b.hp / b.maxHp, 1 / 510, "php");
    near(a.speed, b.speed, 1 / 16, "pspeed");
    near(a.guardT, b.guardT, 0.005, "pguardT");
    assert.equal(a.sprint, b.sprint);
    assert.equal(a.away, b.away);
  }
  for (const [a, b] of [[d.en[0], e1], [d.en[1], e2]]) {
    assert.equal(a.id, b.id);
    near(a.x, b.x, 1 / 64, "ex");
    near(a.z, b.z, 1 / 64, "ez");
    near(a.y, b.y, 1 / 16, "ey");
    angNear(a.yaw, b.yaw, "eyaw");
    assert.equal(a.state, b.state);
    near(a.tt, b.t, 0.0005, "ett");
    assert.equal(a.an, b.an);
    near(a.hp, b.hp, 1 / 16, "ehp");
    near(a.post, b.posture / b.def.posture, 1 / 510, "epost");
    assert.equal(a.aware, b.aware);
    assert.equal(a.phase, b.phase);
    assert.equal(a.dead, b.dead);
    near(a.dur, b.dur, 1 / 64, "edur");
    assert.equal(a.pin, b.pin);
  }
  assert.equal(d.en[0].atk, -1);
  assert.equal(d.en[1].atk, k);
  assert.equal(d.en[0].an, 255);
  assert.equal(d.en[0].pin, 2);
  assert.equal(d.en[0].state, "stagger");
  assert.equal(d.players[0].move, W.moves[2]);
  assert.ok(d.players[0].yaw > TAU - 0.001);
});

check("every player and enemy state, and every move, has a name on the wire", () => {
  const ps = ["free", "guard", "attack", "dodge", "hit", "gbreak", "heal", "execute",
    "blink", "grapple", "inspect", "held", "dead"];
  const es = ["idle", "alert", "chase", "search", "wind", "act", "rec", "hit", "recoil",
    "stagger", "roar", "return", "dead", "fall", "hold"];
  assert.deepEqual(W.ps, ps);
  assert.deepEqual(W.es, es);
  const moves = W.moves;
  assert.ok(moves.length > 20, "moves: " + moves.length);
  const d = W.snapDecode(W.snapEncode(0, 0, ps.map((s) => player({ state: s })),
    es.map((s) => enemy({ state: s }))));
  assert.deepEqual(d.players.map((p) => p.state), ps);
  assert.deepEqual(d.en.map((e) => e.state), es);
  {
    const m = W.snapDecode(W.snapEncode(0, 0, moves.map((k) => player({ move: k })), []));
    assert.deepEqual(m.players.map((p) => p.move), moves);
  }
});

check("a snapshot of 31 enemies is at most 700 bytes", () => {
  const es = [];
  for (let i = 0; i < 31; i++) es.push(enemy({ id: i, x: i * 3 - 40 }));
  const buf = W.snapEncode(1, 1, [player(), player({ pid: 1 })], es);
  assert.ok(buf.byteLength <= 700, "bytes: " + buf.byteLength);
  assert.equal(W.snapDecode(buf).en.length, 31);
  const one = (np, ne) =>
    W.snapEncode(1, 1, Array(np).fill(player()), Array(ne).fill(enemy())).byteLength;
  assert.ok(one(1, 0) - one(0, 0) <= 16, "player bytes " + (one(1, 0) - one(0, 0)));
  assert.ok(one(0, 1) - one(0, 0) <= 20, "enemy bytes " + (one(0, 1) - one(0, 0)));
});

check("state and event round trips", () => {
  assert.deepEqual(W.eventDecode(W.eventEncode(["hit", 7, 12, 31.5])), ["hit", 7, 12, 31.5]);
  assert.deepEqual(W.eventDecode(W.eventEncode(["say", "café ☃", { a: [1, null] }])),
    ["say", "café ☃", { a: [1, null] }]);
  assert.equal(W.type(W.eventEncode(["x"])), 3);
  const p = { x: -3.3, z: 250.1, yaw: 4.2, vx: -6.5, vz: 11.3, state: "dodge", t: 0.321,
    move: W.moves[0], hp: 50, maxHp: 100, speed: 24.6, guardT: 0, sprint: true };
  const buf = W.stateEncode(p);
  assert.equal(W.type(buf), 2);
  const d = W.stateDecode(buf);
  near(d.x, p.x, 1 / 64, "x");
  near(d.z, p.z, 1 / 64, "z");
  angNear(d.yaw, p.yaw, "yaw");
  near(d.vx, p.vx, 1 / 128, "vx");
  near(d.vz, p.vz, 1 / 128, "vz");
  assert.equal(d.state, "dodge");
  near(d.tt, p.t, 0.0005, "tt");
  assert.equal(d.move, p.move);
  near(d.hp, 0.5, 1 / 510, "hp");
  near(d.speed, p.speed, 1 / 16, "speed");
  assert.equal(d.guardT, 0);
  assert.equal(d.sprint, true);
  assert.equal(W.stateDecode(W.stateEncode({ ...p, move: null, sprint: false })).move, null);
});

check("a world event with a full description survives the round trip", () => {
  const h = loadHost();
  h.start({ hub: true });
  const c = fakeClient(h, 1, "fighter");
  c.ev("travel", "E", 99);
  const ev = c.events.find((q) => q[0] === "world");
  assert.ok(ev, "no world event");
  const d = ev[1];
  for (const k of ["e", "kind", "grade", "seed", "sum", "n", "enemies", "dead", "bossDead", "t", "from", "won"])
    assert.ok(Object.hasOwn(d, k), "the description has no " + k);
  assert.deepEqual(W.eventDecode(W.eventEncode(ev)), ev);
  // and a hand-made one, back to the hall with a run time
  const back = ["world", { ...d, e: 3, kind: "hub", grade: null, seed: 0, enemies: [[0, "dummy", -5, -1, 3.14]],
    dead: [], bossDead: false, from: "E", won: 312.45 }];
  assert.deepEqual(W.eventDecode(W.eventEncode(back)), back);
});

check("a join of cave 99 fits in one relay frame", () => {
  const h = loadHost();
  h.start({ seed: 99, grade: "E" });
  const c = fakeClient(h, 1, "fighter");
  fakeClient(h, 2, "mage");
  const b = W.eventEncode(["join", c.join]);
  // the relay closes a socket on a frame over 16,384 bytes; it adds the pid byte
  assert.ok(b.byteLength + 1 < 16384, "a join of " + b.byteLength + " bytes");
});

check("the fake link delays, keeps order and never drops", () => {
  const cfg = { ping: 200, jit: 20, loss: 50, hold: false };
  const { client, host: hostEnd, step } = W.fakePair(cfg);
  const got = [];
  let now = 0;
  hostEnd.onmessage = (b) => got.push({ n: new DataView(b).getUint8(1), at: now });
  const sent = [];
  for (let i = 0; i < 200; i++) {
    now = i * 0.01;
    step(now);
    const b = new ArrayBuffer(2);
    new DataView(b).setUint8(1, i % 256);
    sent[i] = now;
    client.send(b);
  }
  for (let k = 0; k < 600; k++) {
    now = 2 + k * 0.01;
    step(now);
  }
  assert.equal(got.length, 200);
  got.forEach((g, i) => {
    assert.equal(g.n, i % 256, "order at " + i);
    assert.ok(g.at - sent[i] >= 0.08 - 1e-9, `frame ${i} arrived after ${g.at - sent[i]}`);
  });
  // the other way, no loss and no jitter: exactly ping / 2
  cfg.loss = 0;
  cfg.jit = 0;
  cfg.ping = 100;
  let back = -1;
  client.onmessage = () => (back = now);
  now = 10;
  step(now);
  hostEnd.send(new ArrayBuffer(1));
  for (let k = 1; k <= 10; k++) {
    now = 10 + k * 0.01;
    step(now);
  }
  near(back, 10.05, 0.0101, "ping read live at each send");
});

check("the fake link draws its loss and jitter from cfg.rnd when it is set", () => {
  // arrival times of 40 frames sent 10 ms apart, with cfg.rnd as given
  const arrivals = (rnd) => {
    const cfg = { ping: 100, jit: 10, loss: 30, hold: false, rnd };
    const { client, host: hostEnd, step } = W.fakePair(cfg);
    const at = [];
    let now = 0;
    hostEnd.onmessage = () => at.push(now);
    for (let i = 0; i < 40; i++) {
      now = i * 0.01;
      step(now);
      client.send(new ArrayBuffer(1));
    }
    for (let k = 1; k <= 200; k++) {
      now = 0.39 + k * 0.005;
      step(now);
    }
    return at;
  };
  const real = Math.random;
  let calls = 0;
  Math.random = () => {
    calls++;
    return real();
  };
  try {
    // a draw of 0: jitter -jit and lost (0 < loss), so ping / 2 - jit + ping + 60
    const zero = arrivals(() => 0);
    assert.equal(zero.length, 40);
    near(zero[0], 0.05 - 0.01 + 0.16, 0.0051, "first frame, all draws 0");
    // a draw of 0.5: no jitter, and lost only when loss is over 50
    const half = arrivals(() => 0.5);
    near(half[0], 0.05, 0.0051, "first frame, all draws 0.5");
    // a seeded generator: the same seed gives the same arrivals
    const seeded = (seed) => {
      let s = seed >>> 0;
      return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    };
    assert.deepEqual(arrivals(seeded(7)), arrivals(seeded(7)));
    assert.notDeepEqual(arrivals(seeded(7)), arrivals(seeded(8)));
    assert.equal(calls, 0, "Math.random is not read while cfg.rnd is set");
    // without cfg.rnd it is Math.random
    arrivals(undefined);
    assert.ok(calls >= 80, "Math.random read " + calls + " times without cfg.rnd");
  } finally {
    Math.random = real;
  }
});

check("the link hands over the same ArrayBuffer", () => {
  const cfg = { ping: 0, jit: 0, loss: 0, hold: false };
  const { client, host: hostEnd, step } = W.fakePair(cfg);
  const b = W.eventEncode(["a"]);
  let got = null;
  hostEnd.onmessage = (m) => (got = m);
  client.send(b);
  step(0.01);
  assert.equal(got, b);
});

check("a held link delivers the backlog in order when released", () => {
  const cfg = { ping: 40, jit: 0, loss: 0, hold: false };
  const { client, host: hostEnd, step } = W.fakePair(cfg);
  const got = [];
  hostEnd.onmessage = (b) => got.push(new DataView(b).getUint8(0));
  const send = (n) => {
    const b = new ArrayBuffer(1);
    new DataView(b).setUint8(0, n);
    client.send(b);
  };
  step(0);
  send(0);
  step(0.05);
  assert.deepEqual(got, [0]);
  cfg.hold = true;
  for (let i = 1; i <= 5; i++) {
    step(0.05 + i * 0.1);
    send(i);
  }
  step(2);
  step(5);
  assert.deepEqual(got, [0], "nothing arrives while held");
  cfg.hold = false;
  send(6);
  step(5.001);
  assert.deepEqual(got, [0, 1, 2, 3, 4, 5], "the backlog arrives on the first step");
  step(5.1);
  assert.deepEqual(got, [0, 1, 2, 3, 4, 5, 6]);
});

check("close() on either end calls the other's onclose on the next step", () => {
  for (const who of ["client", "host"]) {
    const cfg = { ping: 20, jit: 0, loss: 0, hold: false };
    const pair = W.fakePair(cfg);
    const other = who === "client" ? pair.host : pair.client;
    let closed = 0,
      mine = 0;
    other.onclose = () => closed++;
    pair[who].onclose = () => mine++;
    pair[who].close();
    assert.equal(closed, 0, "not before a step");
    pair.step(0.1);
    assert.equal(closed, 1);
    pair.step(0.2);
    assert.equal(closed, 1);
    assert.equal(mine, 0);
  }
});

done();
