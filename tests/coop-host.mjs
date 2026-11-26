// The headless host copy builds and loads in Node, and hosts players it
// never simulates.
// Run with: node build.mjs && node tests/coop-host.mjs
import assert from "node:assert/strict";
import { loadHost, fakeClient, run, check, done } from "./lib/coop.mjs";

// A host on cave 99.
function cave() {
  const h = loadHost();
  h.start({ seed: 99, grade: "E" });
  return h;
}
// Small cave 99's checksum, as cave() builds it.
const SMALL99 = "91628121";
// The generator's own spawns of a world: up to and including the Warden's,
// which genWorld pushes last; any after it are the extras for two.
const ownSpawns = (w) => {
  const at = w.spawns.findIndex((s) => s.type === "warden");
  assert.ok(at >= 0, "the Warden is among the spawns");
  return w.spawns.slice(0, at + 1);
};
// A host that starts in the hall, as a room does.
function hall() {
  const h = loadHost();
  h.start({ hub: true });
  return h;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const named = (c, name) => c.events.filter((ev) => ev[0] === name);
const front = (q, d) => ({ x: q.x + Math.sin(q.yaw) * d, z: q.z + Math.cos(q.yaw) * d });
// Where pid arrives in the host's world whose arrival point is at: pid 1 on
// it, the friend (pid 2) 1.2 m to its right, out of the rock. The
// placeholder keeps the arrival's facing.
function arrival(h, pid, at) {
  if (pid !== 2) return at;
  const yaw = h.G.player.yaw,
    q = { x: at.x - Math.cos(yaw) * 1.2, z: at.z + Math.sin(yaw) * 1.2 };
  h.G.world.resolve(q, 0.45);
  return q;
}
const worlds = (c) => named(c, "world").map((ev) => ev[1]);
// A walkable point d metres from enemy e, in its line of sight, searching
// round from angle a0.
function spot(h, e, d, a0 = 0) {
  const w = h.G.world;
  for (let i = 0; i < 72; i++) {
    const a = a0 + (i * Math.PI) / 36,
      x = e.x + Math.sin(a) * d,
      z = e.z + Math.cos(a) * d;
    if (w.fieldAt(x, z) > 0.6 && w.los(e.x, e.z, x, z)) return { x, z, a };
  }
  throw new Error("no spot " + d + " m from the enemy");
}
// The husk at index i of the spawn list (cave 99: 37 stands alone near the
// start, 18 in a pack of four, 42 just outside the boss chamber).
function husk(h, i) {
  const e = h.G.enemies[i];
  assert.equal(e.type, "husk");
  return e;
}
// The husk that stands alone near the start: the tunnel post (node -1)
// nearest the world's start that the start cannot see (cave 99: 37; big
// cave 99 for two: 134).
function lone(h) {
  const w = h.G.world,
    s = w.spawn;
  let best = null;
  for (const e of h.G.enemies)
    if (e.type === "husk" && w.spawns[e.id].node === -1 && !w.los(s.x, s.z, e.x, e.z))
      if (!best || dist(e, s) < dist(best, s)) best = e;
  assert.ok(best, "no tunnel post out of the start's sight");
  return best;
}
// Keeps a client standing at a point, one state a tick.
const hold = (c, q, extra) => () => c.at(q.x, q.z, extra);
// Runs until e has dropped its hunt, for at most sec seconds, counting the
// swings it starts. A swing begun before its player went is finished; no
// new one starts. Returns the number of new swings.
function dropsHunt(h, e, sec, each) {
  let winds = 0,
    s0 = e.state;
  run(h, sec, () => {
    if (each) each();
    if (e.state === "wind" && s0 !== "wind") winds++;
    s0 = e.state;
    if (!e.aware) return false;
  });
  // the step after the last state read
  if (e.state === "wind" && s0 !== "wind") winds++;
  return winds;
}

check("the host copy loads in Node and builds cave 99", () => {
  const h = loadHost();
  h.start({ seed: 99, grade: "E" });
  assert.equal(h.G.enemies.length, 47);
  assert.equal(h.G.world.pos.length / 9, 81835);
});
check("two host copies do not share state", () => {
  const a = loadHost(),
    b = loadHost();
  a.start({ seed: 99, grade: "E" });
  b.start({ seed: 7, grade: "E" });
  assert.notEqual(a.G.world, b.G.world);
});
check("coopWorldSum of cave 99 is the same on two fresh host copies", () => {
  const a = loadHost(),
    b = loadHost();
  a.start({ seed: 99, grade: "E" });
  b.start({ seed: 99, grade: "E" });
  const sa = a.sum(a.G.world),
    sb = b.sum(b.G.world);
  assert.match(sa, /^[0-9a-f]{8}$/);
  assert.equal(sa, sb);
  b.start({ seed: 7, grade: "E" });
  assert.notEqual(b.sum(b.G.world), sa);
});

check("joining sends the cave and every enemy", () => {
  const h = cave();
  const a = fakeClient(h, 1, "fighter");
  const j = a.join;
  assert.ok(j, "no join event");
  assert.equal(j.v, 3);
  assert.equal(j.e, 1);
  assert.equal(j.kind, "cave");
  assert.equal(j.n, 1);
  assert.equal(j.pid, 1);
  assert.equal(j.seed, 99);
  assert.equal(j.grade, "E");
  assert.equal(j.enemies.length, 47);
  assert.equal(j.sum, h.sum(h.G.world));
  assert.deepEqual(j.dead, []);
  assert.equal(j.bossDead, false);
  assert.deepEqual(j.peers, []);
  assert.equal(typeof j.t, "number");
  const sp = h.G.world.spawns;
  j.enemies.forEach(([id, type, x, z, yaw], i) => {
    assert.equal(id, i);
    assert.equal(type, sp[i].type);
    assert.ok(Math.abs(x - sp[i].x) < 0.01 && Math.abs(z - sp[i].z) < 0.01);
    assert.equal(typeof yaw, "number");
  });
  for (const e of h.G.enemies) {
    assert.equal(h.S.byId.get(e.id), e);
    assert.equal(e.an, 0);
    assert.equal(e.pin, 0);
  }
  // the placeholder: dead and far outside the cave
  const ph = h.G.player;
  assert.equal(ph.remote, true);
  assert.equal(ph.state, "dead");
  assert.ok(h.G.world.fieldAt(ph.x, ph.z) < -2);
  // the proxy stands at the cave's start and is remote
  const px = h.S.px.get(1);
  assert.equal(px.remote, true);
  assert.equal(px.clsId, "fighter");
  assert.ok(dist(px, h.G.world.spawn) < 1e-9);
  // the second sees the first; the first is told of the second
  const b = fakeClient(h, 2, "mage");
  assert.deepEqual(b.join.peers, [[1, "fighter"]]);
  assert.deepEqual(a.events.at(-1), ["peer", 2, "mage"]);
  assert.equal(b.events.filter((ev) => ev[0] === "peer").length, 0);
  // a dead enemy is listed as dead
  h.G.enemies[5].dead = true;
  const c = fakeClient(h, 3, "fighter");
  assert.deepEqual(c.join.dead, [5]);
});
check("a hello joins a matching version and build, and refuses another or none", () => {
  const h = cave(),
    got = new Map();
  h.send = (pid, buf) => {
    if (h.wire.type(buf) !== 3) return;
    if (!got.has(pid)) got.set(pid, []);
    got.get(pid).push(h.wire.eventDecode(buf));
  };
  // ["hello", seq, v, cls, build]; rest is what follows the class
  const hello = (pid, v, cls, ...rest) => h.recv(pid, h.wire.eventEncode(["hello", 0, v, cls, ...rest]));
  assert.equal(typeof h.v, "number");
  assert.match(String(h.build), /^[0-9a-f]{8}$/, "the host carries the build stamp");
  hello(1, h.v, "fighter", h.build);
  assert.ok(h.S.px.has(1), "a matching hello joins");
  assert.equal(h.S.px.get(1).clsId, "fighter");
  assert.equal(got.get(1).length, 1);
  assert.equal(got.get(1)[0][0], "join");
  assert.equal(got.get(1)[0][1].pid, 1);
  // another version: told so, and no proxy
  hello(2, h.v + 1, "mage", h.build);
  assert.ok(!h.S.px.has(2), "a wrong version does not join");
  assert.deepEqual(got.get(2), [["no", "version"]]);
  // the wire is version 3 since a world for two means the big cave: a page
  // of version 2 is refused
  assert.equal(h.v, 3);
  hello(8, 2, "mage", h.build);
  assert.ok(!h.S.px.has(8), "a version 2 hello joined");
  assert.deepEqual(got.get(8), [["no", "version"]]);
  // the same version from another build, or with no stamp: told so too
  const other = (parseInt(h.build, 16) ^ 1).toString(16).padStart(8, "0");
  hello(4, h.v, "mage", other);
  assert.ok(!h.S.px.has(4), "another build does not join");
  assert.deepEqual(got.get(4), [["no", "version"]]);
  hello(5, h.v, "mage");
  assert.ok(!h.S.px.has(5), "a hello with no stamp does not join");
  assert.deepEqual(got.get(5), [["no", "version"]]);
  hello(6, h.v, "mage", null);
  hello(7, h.v, "mage", 12345678);
  assert.ok(!h.S.px.has(6) && !h.S.px.has(7), "a stamp that is not this build's string does not join");
  // a hello from a player already in is ignored
  const px = h.S.px.get(1);
  hello(1, h.v, "mage", h.build);
  assert.equal(h.S.px.get(1), px);
  assert.equal(got.get(1).length, 1);
  // a frame that is not a hello does not join anyone
  h.recv(3, h.wire.eventEncode(["hit", 1, 37, 10, 0]));
  h.recv(3, h.wire.stateEncode({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, state: "free", t: 0, move: null, hp: 1, maxHp: 1, speed: 0, guardT: 0, sprint: false }));
  h.recv(3, new ArrayBuffer(0));
  assert.ok(!h.S.px.has(3));
  assert.equal(got.has(3), false);
});
check("the join says whether the host has started, and a friend already in is told once when it does", () => {
  const h = cave();
  const b = fakeClient(h, 2, "mage");
  assert.equal(b.join.started, false, "no state from pid 1 yet");
  const a = fakeClient(h, 1, "fighter");
  assert.equal(a.join.started, false);
  // the friend's states start nothing
  b.at(h.G.world.spawn.x, h.G.world.spawn.z);
  assert.equal(named(b, "started").length, 0);
  // the host's page sends its first state: it has started
  a.at(h.G.world.spawn.x, h.G.world.spawn.z);
  assert.deepEqual(named(b, "started"), [["started"]], "the friend is told");
  assert.equal(named(a, "started").length, 0, "the host's page is not");
  a.at(h.G.world.spawn.x, h.G.world.spawn.z);
  run(h, 3);
  assert.equal(named(b, "started").length, 1, "told once");
  // sticky: a friend who joins later, with the host away or dead, enters at once
  h.leave(2);
  a.at(h.G.world.spawn.x, h.G.world.spawn.z, { state: "dead", hp: 0 });
  run(h, 3);
  assert.equal(h.S.px.get(1).away, true);
  const c = fakeClient(h, 2, "tanker");
  assert.equal(c.join.started, true);
  // a fresh run has not started
  h.start({ seed: 99, grade: "E" });
  const d = fakeClient(h, 2, "mage");
  assert.equal(d.join.started, false);
});
check("a class change, in the room or mid-run, changes the proxy in place and tells the other player", () => {
  const h = cave();
  const a = fakeClient(h, 1, "fighter");
  const b = fakeClient(h, 2, "mage");
  const px = h.S.px.get(2);
  // on the room screen, before its first state
  const mageHp = px.maxHp;
  const s1 = b.ev("cls", "tanker");
  assert.equal(h.S.px.get(2), px, "the same proxy");
  assert.equal(px.clsId, "tanker");
  assert.equal(px.maxHp, px.cls.hp);
  assert.equal(px.hp, px.cls.hp);
  assert.ok(px.maxHp > mageHp, "a tanker's health, not a mage's");
  assert.equal(px.pid, 2);
  assert.equal(px.remote, true);
  assert.equal(px.heard, -Infinity, "still not entered");
  assert.deepEqual(a.events.at(-1), ["cls", 2, "tanker"]);
  assert.equal(named(b, "cls").length, 0, "the one who picked is not told");
  assert.equal(named(a, "peer").length, 1, "no second peer: it has not joined again");
  // the event is acknowledged like any other
  assert.equal(px.ack, s1);
  // a class co-op does not offer plays as the first base class
  const base = "assassin";
  b.ev("cls", "enforcer");
  assert.equal(px.clsId, base);
  assert.deepEqual(a.events.at(-1), ["cls", 2, base]);
  // not a class id at all, or the class it already is: nothing changes or is said
  const n = named(a, "cls").length;
  b.ev("cls", 7);
  b.ev("cls");
  b.ev("cls", base);
  assert.equal(px.clsId, base);
  assert.equal(named(a, "cls").length, n);
  // a later joiner sees the class as changed
  b.ev("cls", "mage");
  h.leave(1);
  const a2 = fakeClient(h, 1, "fighter");
  assert.deepEqual(a2.join.peers, [[2, "mage"]]);
  // mid-run, hurt: the same place, the same share of health, the new class
  const sp = h.G.world.spawn;
  b.at(sp.x + 2, sp.z, { hp: 0.5 });
  // (the share travels as a byte)
  const share = px.hp / px.maxHp;
  assert.ok(Math.abs(share - 0.5) < 0.01);
  const x0 = px.x;
  b.ev("cls", "tanker");
  assert.equal(px.clsId, "tanker");
  assert.ok(Math.abs(px.hp - px.cls.hp * share) < 1e-9, "the same share of a tanker's health");
  assert.equal(px.x, x0, "where it stood");
  assert.ok(Math.abs(px.x - (sp.x + 2)) < 0.05);
  assert.notEqual(px.heard, -Infinity);
  assert.deepEqual(a2.events.at(-1), ["cls", 2, "tanker"]);
  // the host's own page changes the same way, and the friend hears it
  a2.ev("cls", "ranger");
  assert.equal(h.S.px.get(1).clsId, "ranger");
  assert.deepEqual(b.events.at(-1), ["cls", 1, "ranger"]);
});
check("an enemy hunts the nearer player and keeps it within 3 m", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  let qa = spot(h, e, 4),
    qb = spot(h, e, 6, qa.a + Math.PI);
  run(h, 1, () => {
    a.at(qa.x, qa.z);
    b.at(qb.x, qb.z);
  });
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 1);
  // placed again round where the husk now is: B 1.5 m nearer is not enough
  qa = spot(h, e, 4);
  qb = spot(h, e, 2.5, qa.a + Math.PI);
  a.at(qa.x, qa.z);
  b.at(qb.x, qb.z);
  run(h, 1 / 60);
  assert.equal(e.tg, 1);
  // 3.1 m nearer is
  qa = spot(h, e, 4);
  qb = spot(h, e, 0.9, qa.a + Math.PI);
  a.at(qa.x, qa.z);
  b.at(qb.x, qb.z);
  run(h, 1 / 60);
  assert.equal(e.tg, 2);
});
check("an away player is not hunted", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter");
  const q = spot(h, e, 4);
  run(h, 1, hold(a, q));
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 1);
  assert.equal(h.S.px.get(1).away, false);
  // silence: away after 2 s, and from then on not hunted
  run(h, 2.05);
  assert.equal(h.S.px.get(1).away, true);
  assert.equal(e.tg, 0);
  assert.equal(dropsHunt(h, e, 1.6), 0, "a new swing at an away player");
  assert.equal(e.aware, false, "still hunting: " + e.state);
  run(h, 0.5);
  assert.equal(e.aware, false);
  assert.equal(e.tg, 0);
  // a state brings them back
  a.at(q.x, q.z);
  run(h, 1 / 60);
  assert.equal(h.S.px.get(1).away, false);
});
// With every present player dead the host wipes (below), so B stays alive
// in the boss chamber, where no regular enemy may hunt them.
check("a dead player is not hunted: the living one in the boss chamber is the target and is left alone, so the enemy goes home", () => {
  const h = cave(),
    e = husk(h, 37),
    bc = h.G.world.boss;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const q = spot(h, e, 4);
  const inBoss = () => b.at(bc.x, bc.z);
  const live = () => {
      a.at(q.x, q.z);
      inBoss();
    },
    dead = () => {
      a.at(q.x, q.z, { state: "dead", hp: 0 });
      inBoss();
    };
  run(h, 1, live);
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 1);
  run(h, 1 / 60, dead);
  assert.equal(e.tg, 2);
  const w = dropsHunt(h, e, 1.6, dead);
  assert.equal(w, 0, "a new swing at a dead player");
  assert.equal(e.aware, false, "still hunting: " + e.state);
  assert.equal(e.state, "return");
  // it walks home and stays unaware with the dead player in sight
  run(h, 12, dead);
  assert.equal(e.aware, false);
  assert.ok(Math.hypot(e.x - e.hx, e.z - e.hz) < 1.5, "not home");
  assert.equal(h.G.enemies[37], e, "the enemies were reset");
  assert.equal(named(a, "reset").length, 0);
});
check("the boss chamber rule is per player", () => {
  const h = cave(),
    w = h.G.world,
    bc = w.boss,
    e = husk(h, 42);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const qa = { x: bc.x, z: bc.z },
    // B beside the husk (close enough to wake it from behind) on the side
    // away from the chamber
    qb = spot(h, e, 2, Math.atan2(e.x - bc.x, e.z - bc.z));
  assert.ok(dist(qb, bc) > bc.r + 3);
  run(h, 2, () => {
    a.at(qa.x, qa.z);
    b.at(qb.x, qb.z);
  });
  assert.equal(h.S.px.get(1).inBoss, true);
  assert.equal(h.S.px.get(2).inBoss, false);
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 2);
  run(h, 2, () => {
    a.at(qa.x, qa.z);
    b.at(qb.x, qb.z);
  });
  assert.equal(e.aware, true, "gave up with its target outside the chamber");
  // B steps into the chamber, near its edge by the husk and in its sight
  const u = Math.atan2(e.x - bc.x, e.z - bc.z);
  let qi = null;
  for (let r = bc.r - 1; r > bc.r - 6 && !qi; r -= 0.5)
    for (let k = 0; k <= 16 && !qi; k++) {
      const an = u + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.1,
        q = { x: bc.x + Math.sin(an) * r, z: bc.z + Math.cos(an) * r };
      if (w.fieldAt(q.x, q.z) > 0.6 && w.los(e.x, e.z, q.x, q.z)) qi = q;
    }
  assert.ok(qi, "no point in the chamber in the husk's sight");
  run(h, 2, () => {
    a.at(qa.x, qa.z);
    b.at(qi.x, qi.z);
  });
  assert.equal(h.S.px.get(2).inBoss, true);
  assert.equal(e.aware, false);
  assert.ok(e.state === "return" || e.state === "idle", e.state);
  // and stays out of it
  run(h, 3, () => {
    a.at(qa.x, qa.z);
    b.at(qi.x, qi.z);
  });
  assert.equal(e.aware, false);
});
check("nothing on the host hurts or moves a proxy", () => {
  const h = cave(),
    e = husk(h, 18);
  const a = fakeClient(h, 1, "fighter");
  const q = spot(h, e, 1.5);
  const px = h.S.px.get(1);
  let acts = 0,
    winds = 0,
    an0 = e.an,
    s0 = e.state;
  // a state every 1.5 s keeps them present; between states nothing changes
  run(h, 20, (i) => {
    if (i % 90 === 0) a.at(q.x, q.z);
    assert.equal(px.x, Math.round(q.x * 32) / 32);
    assert.equal(px.z, Math.round(q.z * 32) / 32);
    assert.equal(px.hp, px.maxHp);
    assert.equal(px.state, "free");
    for (const o of h.G.enemies) if (o.tg === 1 && o.state === "act") acts++;
    if (e.state === "wind" && s0 !== "wind") winds++;
    s0 = e.state;
  });
  assert.ok(acts > 0, "nobody attacked");
  // a new swing, a new number
  assert.ok(winds > 0, "the husk never swung");
  assert.equal(e.an, (an0 + winds) & 255);
});
check("snapshots: 20 a second, the other player in each, enemies by range", () => {
  const h = cave(),
    w = h.G.world,
    s = w.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const near = h.G.enemies[37],
    far = h.G.enemies[44];
  assert.ok(Math.abs(dist(near, s) - 30) < 2 && Math.abs(dist(far, s) - 60) < 4);
  const qb = { x: s.x + 1, z: s.z };
  run(h, 5, () => {
    a.at(s.x, s.z);
    b.at(qb.x, qb.z);
  });
  assert.ok(Math.abs(a.nsnap - 100) <= 1, "client 1 got " + a.nsnap);
  assert.ok(Math.abs(b.nsnap - 100) <= 1, "client 2 got " + b.nsnap);
  assert.deepEqual(a.snap.players.map((p) => p.pid), [2]);
  assert.deepEqual(b.snap.players.map((p) => p.pid), [1]);
  const pl = a.snap.players[0];
  assert.ok(Math.abs(pl.x - qb.x) < 0.05 && Math.abs(pl.z - qb.z) < 0.05);
  assert.equal(pl.away, false);
  assert.ok(Math.abs(a.snap.t - h.S.step / 60) < 1e-3);
  assert.equal(a.snap.ack, 1, "its at");
  // both stayed asleep, so only range decides
  for (const e of [near, far]) {
    assert.equal(e.state, "idle");
    assert.equal(e.aware, false);
  }
  const ids = a.snap.en.map((r) => r.id);
  assert.ok(ids.includes(near.id), "the enemy 30 m away is missing");
  assert.ok(!ids.includes(far.id), "the enemy 60 m away is sent");
  // every enemy sent is in range, awake, or dying
  for (const r of a.snap.en) {
    const e = h.S.byId.get(r.id);
    assert.ok(dist(e, s) < 45 + 1 || e.aware || e.state !== "idle" || e.dead);
  }
  // an enemy that stops qualifying is kept a second, then dropped: moved
  // into range (40 m, too far to see anyone) and back
  const t = far.x,
    tz = far.z;
  far.x = s.x + 40;
  far.z = s.z;
  run(h, 0.2, () => a.at(s.x, s.z));
  assert.ok(a.snap.en.some((r) => r.id === far.id), "not sent within range");
  far.x = t;
  far.z = tz;
  run(h, 0.8, () => a.at(s.x, s.z));
  assert.ok(a.snap.en.some((r) => r.id === far.id), "dropped within its second of grace");
  run(h, 0.4, () => a.at(s.x, s.z));
  assert.ok(!a.snap.en.some((r) => r.id === far.id), "kept past its grace");
  // an away player is flagged
  run(h, 2.5, () => a.at(s.x, s.z));
  assert.equal(a.snap.players[0].away, true);
});
check("leaving removes the proxy, tells the other, and the host plays on", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const q = spot(h, e, 4);
  run(h, 1, () => {
    b.at(q.x, q.z);
    a.at(h.G.world.spawn.x, h.G.world.spawn.z);
  });
  assert.equal(e.tg, 2);
  h.leave(2);
  assert.equal(h.S.px.has(2), false);
  assert.deepEqual(a.events.at(-1), ["peer", 2, null]);
  const step = h.S.step,
    n = a.nsnap;
  run(h, 1, () => a.at(h.G.world.spawn.x, h.G.world.spawn.z));
  assert.equal(h.S.step, step + 60);
  assert.equal(a.nsnap, n + 20);
  assert.deepEqual(a.snap.players, []);
  assert.notEqual(e.tg, 2);
});
check("with nobody joined the host does not step", () => {
  const h = cave();
  const t0 = h.G.t,
    pos = h.G.enemies.map((e) => [e.x, e.z]);
  run(h, 1);
  assert.equal(h.S.step, 0);
  assert.equal(h.G.t, t0);
  assert.deepEqual(h.G.enemies.map((e) => [e.x, e.z]), pos);
  fakeClient(h, 1, "fighter");
  run(h, 0.5);
  assert.equal(h.S.step, 30);
  h.leave(1);
  run(h, 1);
  assert.equal(h.S.step, 30);
});
check("a malformed frame is ignored", () => {
  const h = cave();
  const a = fakeClient(h, 1, "fighter");
  const s = h.G.world.spawn;
  a.at(s.x + 2, s.z);
  const px = h.S.px.get(1),
    x0 = px.x,
    heard = px.heard;
  const st = h.wire.stateEncode({ ...px, x: s.x + 5 });
  const bad = [
    new ArrayBuffer(0),
    new Uint8Array([9, 1, 2, 3]).buffer,
    st.slice(0, 10),
    new Uint8Array([3, 0x7b, 0x21]).buffer, // an EVENT whose body is not JSON
    new Uint8Array([1, 0, 0]).buffer, // a snapshot sent the wrong way, cut short
    "not a frame",
    null,
  ];
  for (const buf of bad) assert.doesNotThrow(() => h.recv(1, buf));
  assert.doesNotThrow(() => h.recv(7, st)); // nobody of that id
  assert.equal(px.x, x0);
  assert.equal(px.heard, heard);
  assert.equal(h.S.px.size, 1);
  run(h, 0.1, () => a.at(s.x + 2, s.z));
  assert.equal(h.S.step, 6);
});
// Task 5: what clients can ask of the host.
// A walkable point d metres from e that it cannot see, searching outward.
function unseen(h, e, d0) {
  const w = h.G.world;
  for (let d = d0; d < d0 + 20; d += 0.5)
    for (let i = 0; i < 72; i++) {
      const a = (i * Math.PI) / 36,
        x = e.x + Math.sin(a) * d,
        z = e.z + Math.cos(a) * d;
      if (w.fieldAt(x, z) > 0.6 && !w.los(e.x, e.z, x, z)) return { x, z };
    }
  throw new Error("no hidden spot near the enemy");
}
// A hit event's arguments after the seq: eid, dmg, post, flags, src, fx, fz,
// seenState, seenAn.
const hit = (c, e, dmg, o = {}) =>
  c.ev(
    "hit",
    e.id,
    dmg,
    o.post ?? 0,
    o.flags ?? 0,
    o.src ?? "melee",
    o.fx ?? null,
    o.fz ?? null,
    o.seen ?? "chase",
    o.an ?? e.an,
  );
const warden = (h) => h.G.enemies.find((e) => e.def.boss);
// Kills the Warden through hit events from c, below COOP.MAX_DMG each.
function killWarden(c, w) {
  for (let i = 0; i < 4 && !w.dead; i++) hit(c, w, Math.min(400, w.hp + 1));
  assert.equal(w.dead, true, "the Warden did not die");
}

check("a proposed hit takes exactly the damage sent", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter");
  const q = spot(h, e, 4);
  run(h, 1, hold(a, q));
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.hp, 42);
  const p0 = e.posture,
    k = e.state === "wind" ? 1.25 : 1;
  const seq = hit(a, e, 10, { post: 5 });
  assert.equal(e.hp, 32);
  assert.equal(e.posture, p0 + 5 * k);
  assert.equal(e.state, "hit", "a husk flinches");
  run(h, 3 / 60, hold(a, q));
  assert.equal(a.snap.ack, seq);
  const r = a.snap.en.find((x) => x.id === e.id);
  assert.equal(r.hp, 32);
  // a hit with a blast centre, sent from behind: no backstab either
  e.yaw = Math.atan2(e.x - q.x, e.z - q.z);
  const s2 = hit(a, e, 7.5, { fx: e.x + 1, fz: e.z, src: "melee" });
  assert.equal(e.hp, 24.5);
  run(h, 3 / 60, hold(a, q));
  assert.equal(a.snap.ack, s2);
});
check("the host adds no ambush bonus to a proposal", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "assassin");
  assert.ok(h.S.px.get(1).cls.ambush > 1);
  const s = h.G.world.spawn;
  run(h, 0.5, () => a.at(s.x, s.z));
  assert.equal(e.aware, false);
  hit(a, e, 10, { seen: "idle" });
  assert.equal(e.hp, 32, "not 42 - 10 * ambush");
  // nor berserk's
  h.S.px.get(1).buff = "berserk";
  hit(a, e, 10);
  assert.equal(e.hp, 22);
});
check("a hit that kills sends one kill with the killer's pid", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const q = spot(h, e, 4);
  run(h, 0.5, () => {
    a.at(q.x, q.z);
    b.at(q.x + 0.5, q.z);
  });
  const f0 = h.G.player.focus;
  hit(b, e, 20);
  assert.equal(named(a, "kill").length, 0);
  hit(b, e, 30);
  assert.equal(e.dead, true);
  for (const c of [a, b]) {
    const k = named(c, "kill");
    assert.equal(k.length, 1, "client " + c.pid + " got " + k.length);
    assert.equal(k[0][1], e.id);
    assert.equal(k[0][2], 2);
    assert.equal(typeof k[0][3], "number");
  }
  // the rewards went to the killer's proxy, not the placeholder
  assert.ok(h.S.px.get(2).focus > h.S.px.get(1).focus);
  assert.equal(h.G.player.focus, f0);
  // the dead stay dead and are announced once
  hit(a, e, 20);
  run(h, 3, () => {
    a.at(q.x, q.z);
    b.at(q.x + 0.5, q.z);
  });
  assert.equal(named(a, "kill").length, 1);
  assert.equal(named(b, "kill").length, 1);
});
check("favour the attacker: a flinch seen before the swing still lands", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter");
  const q = spot(h, e, 2);
  run(h, 1, hold(a, q));
  const swing = () => {
    e.state = "act";
    e.t = 0;
    e.atk = Object.values(e.def.atks)[0];
    e.hitDone = true;
    e.an = 5;
    e.hp = 42;
    e.posture = 0;
  };
  swing();
  hit(a, e, 1, { seen: "wind", an: 5 });
  assert.equal(e.state, "hit", "the flinch did not land");
  // a different swing: the hit lands, the swing goes on
  swing();
  hit(a, e, 1, { seen: "wind", an: 4 });
  assert.equal(e.state, "act");
  assert.equal(e.hp, 41);
  // the client saw the swing itself: no flinch
  swing();
  hit(a, e, 1, { seen: "act", an: 5 });
  assert.equal(e.state, "act");
  // a dot tick never flinches
  swing();
  hit(a, e, 1, { seen: "chase", an: 5, flags: 2 });
  assert.equal(e.state, "act");
  // a brute (poise 1) flinches only on a heavy hit seen outside wind
  const br = h.G.enemies[9];
  assert.equal(br.def.poise, 1);
  const bs = () => {
    br.state = "act";
    br.t = 0;
    br.atk = Object.values(br.def.atks)[0];
    br.hitDone = true;
    br.an = 9;
    br.posture = 0;
  };
  bs();
  hit(a, br, 1, { seen: "chase", an: 9 });
  assert.equal(br.state, "act", "a light hit flinched a brute");
  bs();
  hit(a, br, 1, { seen: "wind", an: 9, flags: 1 });
  assert.equal(br.state, "act", "a heavy hit seen in wind flinched a brute");
  bs();
  hit(a, br, 1, { seen: "chase", an: 9, flags: 1 });
  assert.equal(br.state, "hit");
});
check("a hit over the ceiling, on a dead enemy or an unknown id does nothing", () => {
  const h = cave(),
    e = husk(h, 37),
    br = h.G.enemies[9];
  const a = fakeClient(h, 1, "fighter");
  const s = h.G.world.spawn;
  a.at(s.x, s.z);
  let seq = hit(a, br, 501);
  assert.equal(br.hp, 120);
  run(h, 3 / 60, () => a.at(s.x, s.z));
  assert.equal(a.snap.ack, seq, "a refused hit is still acknowledged");
  hit(a, br, 500);
  assert.equal(br.dead, true, "a hit of exactly the ceiling is applied");
  const kills = named(a, "kill").length;
  hit(a, br, 10);
  assert.equal(named(a, "kill").length, kills);
  const hp = h.G.enemies.map((o) => o.hp);
  // unknown ids, wrong types, missing fields and unknown names
  const bad = [
    ["hit", 99, 9999, 10, 0, 0, "melee", null, null, "chase", 0],
    ["hit", 99, String(e.id), 10, 0, 0, "melee", null, null, "chase", 0],
    ["hit", 99, null, 10],
    ["hit", 99, e.id, "10", 0, 0, "melee"],
    ["hit", 99, e.id, -10, 0, 0, "melee"],
    ["hit", 99, e.id, NaN, 0, 0, "melee"],
    ["hit", 99, e.id],
    ["hit", 99, { id: e.id }, 10],
    ["parry", 99, e.id, 0, "lots"],
    ["parry", 99, e.id],
    ["pin", 99, "x"],
    ["exec", 99, -1],
    ["pshot", 99, 1, 2],
    ["pblast", 99, "a", 1, 1, 1, 1, 1],
    ["spawn", 99, 50, "husk", 0, 0],
    ["no such event", 99, 1, 2, 3],
    ["hit"],
    [],
    [1, 2, 3],
    { hit: 1 },
    "hit",
    null,
    42,
  ];
  for (const ev of bad)
    assert.doesNotThrow(() => h.recv(1, h.wire.eventEncode(ev)), JSON.stringify(ev));
  assert.deepEqual(
    h.G.enemies.map((o) => o.hp),
    hp,
  );
  assert.equal(e.dead, false);
  run(h, 3 / 60, () => a.at(s.x, s.z));
  assert.equal(a.snap.ack, 99, "the numbered ones are acknowledged");
  // and the host goes on applying good ones
  seq = hit(a, e, 2);
  assert.equal(e.hp, 40);
  run(h, 3 / 60, () => a.at(s.x, s.z));
  assert.equal(a.snap.ack, 99, "an older seq does not lower the ack");
  assert.ok(seq < 99);
});
check("a hit pulls the enemy onto the hitter", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const qa = spot(h, e, 4);
  let qb = unseen(h, e, 5);
  const both = () => {
    a.at(qa.x, qa.z);
    b.at(qb.x, qb.z);
  };
  run(h, 1, both);
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 1);
  // B out of its sight: the hit lands, the target stays
  assert.equal(h.G.world.los(e.x, e.z, qb.x, qb.z), false);
  hit(b, e, 1);
  assert.equal(e.hp, 41);
  assert.equal(e.tg, 1);
  // B in sight, half a metre further than A: B becomes the target and
  // stays it (the hit's knockback is within the 3 m hysteresis)
  run(h, 1, both);
  const qa2 = spot(h, e, 4);
  qb = spot(h, e, 4.5, qa2.a + Math.PI);
  a.at(qa2.x, qa2.z);
  b.at(qb.x, qb.z);
  run(h, 1 / 60, () => {
    a.at(qa2.x, qa2.z);
    b.at(qb.x, qb.z);
  });
  assert.equal(e.tg, 1);
  hit(b, e, 1);
  assert.equal(e.tg, 2);
  // it keeps B and hunts B: what it last saw of its quarry is where B is
  run(h, 1.5, () => {
    a.at(qa2.x, qa2.z);
    b.at(qb.x, qb.z);
    assert.equal(e.tg, 2);
  });
  assert.equal(e.aware, true);
  assert.ok(Math.hypot(e.lsx - qb.x, e.lsz - qb.z) < 0.05, "it tracks A, not B");
});
check("a parry adds posture and recoils, or staggers when full", () => {
  const h = cave(),
    br = h.G.enemies[9];
  const a = fakeClient(h, 1, "fighter");
  const q = spot(h, br, 3);
  run(h, 1, hold(a, q));
  assert.equal(br.aware, true);
  br.state = "chase";
  br.posture = 0;
  a.ev("parry", br.id, br.an, 30);
  assert.equal(br.posture, 30);
  assert.equal(br.state, "recoil");
  assert.equal(br.dur, 1.0);
  assert.equal(br.t, 0);
  run(h, 0.1, hold(a, q));
  a.ev("parry", br.id, br.an, br.def.posture);
  assert.equal(br.state, "stagger");
  // a parry on a staggered enemy changes nothing
  run(h, 0.5, hold(a, q));
  const t = br.t,
    dur = br.dur;
  a.ev("parry", br.id, br.an, 30);
  assert.equal(br.state, "stagger");
  assert.equal(br.t, t);
  assert.equal(br.dur, dur);
  // the Warden recoils for less
  const w = warden(h);
  w.state = "chase";
  w.posture = 0;
  a.ev("parry", w.id, w.an, 30);
  assert.equal(w.state, "recoil");
  assert.equal(w.dur, 0.55);
});
check("an execution: the first pin wins and only that player's exec kills", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const q = spot(h, e, 2);
  const both = () => {
    a.at(q.x, q.z);
    b.at(q.x + 0.3, q.z);
  };
  run(h, 1, both);
  // not staggered: a pin does nothing
  a.ev("pin", e.id);
  assert.equal(e.pin, 0);
  a.ev("parry", e.id, e.an, e.def.posture);
  assert.equal(e.state, "stagger");
  run(h, 0.5, both);
  a.ev("pin", e.id);
  b.ev("pin", e.id);
  assert.equal(e.pin, 1);
  assert.ok(e.dur - e.t >= 1.5 - 1e-9);
  run(h, 3 / 60, both);
  assert.equal(a.snap.en.find((r) => r.id === e.id).pin, 1);
  assert.equal(b.snap.en.find((r) => r.id === e.id).pin, 1);
  b.ev("exec", e.id);
  assert.equal(e.dead, false);
  assert.equal(named(a, "kill").length, 0);
  a.ev("exec", e.id);
  assert.equal(e.dead, true);
  const k = named(b, "kill");
  assert.equal(k.length, 1);
  assert.deepEqual(k[0].slice(0, 3), ["kill", e.id, 1]);
  // a pin that is never finished lets go when the stagger ends
  const e2 = husk(h, 18),
    q2 = spot(h, e2, 2);
  const near2 = () => {
    a.at(q2.x, q2.z);
    b.at(q2.x + 0.3, q2.z);
  };
  run(h, 1, near2);
  a.ev("parry", e2.id, e2.an, e2.def.posture);
  b.ev("pin", e2.id);
  assert.equal(e2.pin, 2);
  run(h, 5, () => {
    near2();
    if (e2.state !== "stagger") return false;
  });
  assert.notEqual(e2.state, "stagger");
  run(h, 1 / 60, near2);
  assert.equal(e2.pin, 0);
  b.ev("exec", e2.id);
  assert.equal(e2.dead, false);
});
check("an enemy shot is announced once and never hits a proxy", () => {
  const h = cave(),
    sp = h.G.enemies[2];
  assert.equal(sp.type, "spit");
  const a = fakeClient(h, 1, "fighter");
  // in front of it, where an idle enemy looks
  const q = spot(h, sp, 8, sp.yaw);
  const px = h.S.px.get(1);
  // each swing of the shot fires one shot as it enters act; a shot that
  // meets a wall in the step it is made is never seen in G.projs
  const reached = new Map();
  let passed = 0,
    fired = 0,
    s0 = sp.state;
  run(h, 8, (i) => {
    a.at(q.x, q.z);
    if (sp.state === "act" && s0 !== "act") fired++;
    s0 = sp.state;
    for (const pr of h.G.projs) {
      if (pr.src !== sp) continue;
      if (reached.has(pr) && reached.get(pr) === i - 1 && pr.life > 0) passed++;
      if (Math.hypot(pr.x - px.x, pr.z - px.z) < 0.8 && !reached.has(pr)) reached.set(pr, i);
    }
    assert.equal(px.hp, px.maxHp);
    assert.equal(px.state, "free");
  });
  const shots = named(a, "shot").filter((ev) => ev[1] === sp.id);
  if (sp.state === "act" && s0 !== "act") fired++;
  assert.ok(fired > 0, "the spitter never shot");
  assert.equal(shots.length, fired);
  assert.ok(passed > 0, "no shot flew on through the proxy");
  for (const [, , x, y, z, vx, vz, dmg, t] of shots) {
    for (const v of [x, y, z, vx, vz, t]) assert.equal(typeof v, "number");
    assert.ok(Math.hypot(vx, vz) > 10);
    assert.equal(dmg, sp.def.atks[Object.keys(sp.def.atks).find((k) => sp.def.atks[k].kind === "shot")].dmg);
  }
});
check("the Warden's slam sends a ring and its second phase a roar", () => {
  const h = cave(),
    w = warden(h),
    bc = h.G.world.boss;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const q = spot(h, w, 10);
  const both = () => {
    a.at(q.x, q.z);
    b.at(h.G.world.spawn.x, h.G.world.spawn.z);
  };
  assert.ok(dist(q, bc) < bc.r);
  run(h, 1, both);
  assert.equal(w.aware, true, "the Warden did not wake");
  assert.equal(named(a, "ring").length, 0);
  Object.assign(w, { state: "wind", atk: w.def.atks.slam, t: 0, hitDone: false });
  run(h, 1, both);
  for (const c of [a, b]) {
    const r = named(c, "ring");
    assert.equal(r.length, 1, "client " + c.pid + " got " + r.length + " rings");
    const [, x, z, radius, dur, t] = r[0];
    assert.ok(Math.abs(x - w.tx) < 0.01 && Math.abs(z - w.tz) < 0.01);
    assert.equal(radius, 5.4);
    assert.equal(dur, 0.6);
    assert.equal(typeof t, "number");
  }
  // the roar: once, when a hit takes it under half
  hit(a, w, w.hp - 311);
  assert.equal(w.phase, 1);
  assert.equal(named(a, "roar").length, 0);
  hit(a, w, 2);
  assert.equal(w.phase, 2);
  for (const c of [a, b]) {
    const r = named(c, "roar");
    assert.equal(r.length, 1);
    assert.equal(r[0][1], w.id);
    assert.equal(typeof r[0][2], "number");
  }
  hit(a, w, 2);
  run(h, 1, both);
  assert.equal(named(a, "roar").length, 1);
});
check("one death resets nothing; both dead resets the enemies", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  let da = false,
    db = false;
  const both = () => {
    a.at(s.x, s.z, da ? { state: "dead", hp: 0 } : {});
    b.at(s.x + 1, s.z, db ? { state: "dead", hp: 0 } : {});
  };
  run(h, 0.5, both);
  for (const i of [37, 41, 43]) hit(a, husk(h, i), 42);
  da = true;
  run(h, 1, both);
  assert.equal(h.G.enemies.filter((e) => e.dead).length, 3);
  assert.equal(named(a, "reset").length, 0);
  db = true;
  run(h, 1 / 60, both);
  for (const c of [a, b]) assert.equal(named(c, "reset").length, 1);
  const [, r, t] = named(a, "reset")[0];
  assert.equal(typeof t, "number");
  assert.equal(r.enemies.length, 47);
  assert.deepEqual(r.dead, []);
  assert.equal(r.bossDead, false);
  assert.equal(h.G.enemies.length, 47);
  assert.equal(h.G.enemies.filter((e) => e.dead).length, 0);
  const sp = h.G.world.spawns;
  h.G.enemies.forEach((e, i) => {
    assert.equal(e.id, i);
    assert.equal(e.type, sp[i].type);
    assert.equal(h.S.byId.get(i), e);
    assert.equal(e.an, 0);
    assert.equal(e.pin, 0);
  });
  r.enemies.forEach(([id, type], i) => {
    assert.equal(id, i);
    assert.equal(type, sp[i].type);
  });
  // not again while the same players stay dead
  run(h, 2, both);
  assert.equal(named(a, "reset").length, 1);
  // one back on their feet, then both dead again: a second
  da = false;
  run(h, 0.5, both);
  assert.equal(named(a, "reset").length, 1);
  da = true;
  run(h, 0.5, both);
  assert.equal(named(a, "reset").length, 2);
  // with the boss dead it stays dead, and its id is skipped
  da = db = false;
  run(h, 0.5, both);
  const w = warden(h);
  killWarden(a, w);
  assert.equal(h.G.bossDead, true);
  da = db = true;
  run(h, 0.5, both);
  const last = named(b, "reset");
  assert.equal(last.length, 3);
  const r3 = last[2][1];
  assert.equal(r3.bossDead, true);
  assert.equal(r3.enemies.length, 46);
  assert.ok(!r3.enemies.some(([id]) => id === w.id));
  assert.equal(h.G.enemies.length, 46);
  assert.ok(!h.G.enemies.some((e) => e.def.boss));
  h.G.enemies.forEach((e, i) => assert.equal(e.id, i));
  assert.equal(h.S.byId.has(w.id), false);
  // a hit on the reset enemies lands on the new ones
  da = db = false;
  run(h, 0.1, both);
  hit(a, husk(h, 37), 2);
  assert.equal(h.S.byId.get(37).hp, 40);
});
check("an away player does not hold up the wipe", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  run(h, 0.5, () => {
    a.at(s.x, s.z);
    b.at(s.x + 1, s.z);
  });
  hit(a, husk(h, 37), 42);
  // A falls silent; B is dead
  const deadB = () => b.at(s.x + 1, s.z, { state: "dead", hp: 0 });
  run(h, 1.5, deadB);
  assert.equal(h.S.px.get(1).away, false);
  assert.equal(named(b, "reset").length, 0, "reset while A was still there");
  run(h, 1, deadB);
  assert.equal(h.S.px.get(1).away, true);
  assert.equal(named(b, "reset").length, 1);
  assert.equal(husk(h, 37).dead, false);
  // nobody present: no wipe
  const h2 = cave(),
    c = fakeClient(h2, 1, "fighter");
  c.at(s.x, s.z, { state: "dead", hp: 0 });
  run(h2, 1 / 60);
  assert.equal(named(c, "reset").length, 1, "a lone dead player is a wipe");
  run(h2, 0.5);
  c.at(s.x, s.z);
  run(h2, 0.5);
  // dead and gone silent at once: away before the next check matters
  c.at(s.x, s.z, { state: "dead", hp: 0 });
  h2.S.px.get(1).heard = -10;
  run(h2, 1);
  assert.equal(named(c, "reset").length, 1, "a wipe with nobody present");
});
check("the gate takes both back to the hall, only once the boss is dead, and the room stays open", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const both = () => {
    a.at(s.x, s.z);
    b.at(s.x + 1, s.z);
  };
  run(h, 1, both);
  const e0 = h.S.epoch;
  b.ev("gate");
  assert.equal(h.S.epoch, e0, "a gate with the boss alive swapped the world");
  assert.equal(worlds(a).length, 0);
  run(h, 0.5, both);
  assert.equal(h.S.step, 90);
  killWarden(a, warden(h));
  run(h, 0.5, both);
  const runT = h.G.runT;
  assert.ok(Math.abs(runT - 2) < 0.05, "runT " + runT);
  b.ev("gate");
  assert.equal(h.S.kind, "hub");
  assert.equal(h.S.epoch, e0 + 1);
  const f = front(h.G.world.portals.find((q) => q.grade === "E"), 3.5);
  for (const c of [a, b]) {
    const d = worlds(c).at(-1);
    assert.equal(worlds(c).length, 1);
    assert.equal(d.kind, "hub");
    assert.equal(d.e, e0 + 1);
    assert.equal(d.from, "E");
    assert.equal(d.won, runT);
    assert.equal(named(c, "end").length, 0);
  }
  for (const px of h.S.px.values()) assert.ok(dist(px, arrival(h, px.pid, f)) < 0.01, "pid " + px.pid + " is not in front of E's gate");
  // the room stays open: the host steps and snapshots on, and the party can
  // set out again
  const step = h.S.step,
    na = a.nsnap;
  run(h, 1, () => {
    a.at(f.x, f.z);
    b.at(f.x + 1, f.z);
  });
  assert.equal(h.S.step, step + 60);
  assert.ok(a.nsnap > na);
  b.ev("gate");
  assert.equal(h.S.epoch, e0 + 1, "a gate in the hall swapped the world");
  a.ev("travel", "E", 7);
  assert.equal(h.S.kind, "cave");
  assert.equal(h.G.seed, 7);
});
check("a player's shots and blasts go to the other player only", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  a.ev("pshot", 1, 1.25, 2, 10, -3, 0.2, 0.5, 1);
  const sb = a.ev("pblast", 4, 5, 3.5, 1, 0.4, 0.1);
  assert.deepEqual(named(b, "pshot"), [["pshot", 1, 1, 1.25, 2, 10, -3, 0.2, 0.5, 1]]);
  assert.deepEqual(named(b, "pblast"), [["pblast", 1, 4, 5, 3.5, 1, 0.4, 0.1]]);
  assert.equal(named(a, "pshot").length + named(a, "pblast").length, 0);
  b.ev("pblast", 1, 2, 3, 0, 0, 0);
  assert.deepEqual(named(a, "pblast"), [["pblast", 2, 1, 2, 3, 0, 0, 0]]);
  run(h, 3 / 60, () => a.at(s.x, s.z));
  assert.equal(a.snap.ack, sb);
});
// Task 7: event numbers, and the Warden's execution.
check("a seq that is not an integer from 1 to 65535 is refused and not acknowledged", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter");
  const s = h.G.world.spawn,
    here = () => a.at(s.x, s.z);
  const send = (seq, ...args) => h.recv(1, h.wire.eventEncode(["hit", seq, e.id, 1, 0, 0, "melee", null, null, "chase", 0, ...args]));
  send(5);
  assert.equal(e.hp, 41, "a good seq is applied");
  run(h, 3 / 60, here);
  assert.equal(a.snap.ack, 5);
  for (const seq of [0, -1, 1.5, 65536, 1e9, "6", null, true, NaN]) {
    const hp = e.hp;
    assert.doesNotThrow(() => send(seq), String(seq));
    assert.equal(e.hp, hp, "seq " + String(seq) + " was applied");
  }
  // a missing seq too
  h.recv(1, h.wire.eventEncode(["hit"]));
  run(h, 3 / 60, here);
  assert.equal(a.snap.ack, 5, "a bad seq was acknowledged");
  send(65535);
  assert.equal(e.hp, 40, "65535 is still a seq");
  run(h, 3 / 60, here);
  assert.equal(a.snap.ack, 65535);
});
check("a Warden execution is a hit: it survives, the pin clears and it recoils for 1 s", () => {
  const h = cave(),
    w = warden(h);
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const q = spot(h, w, 3);
  const both = () => {
    a.at(q.x, q.z);
    b.at(q.x + 0.3, q.z);
  };
  run(h, 1, both);
  assert.equal(w.aware, true, "the Warden did not wake");
  const exec = (c) => hit(c, w, 120, { src: "exec", flags: 1, seen: "stagger" });
  // staggered and pinned by 1: an execution from 1
  a.ev("parry", w.id, w.an, w.def.posture);
  assert.equal(w.state, "stagger");
  a.ev("pin", w.id);
  assert.equal(w.pin, 1);
  const hp = w.hp;
  exec(a);
  assert.equal(w.hp, hp - 120);
  assert.equal(w.dead, false);
  assert.equal(w.pin, 0, "the pin is still set");
  assert.equal(w.state, "recoil");
  assert.equal(w.dur, 1.0);
  assert.equal(w.t, 0);
  assert.equal(w.posture, 0);
  // a hit marked exec from a player who did not pin it changes no state
  run(h, 1.2, both);
  w.state = "chase";
  w.posture = 0;
  a.ev("parry", w.id, w.an, w.def.posture);
  b.ev("pin", w.id);
  a.ev("pin", w.id);
  assert.equal(w.pin, 2);
  exec(a);
  assert.equal(w.state, "stagger", "the other player's pin was overruled");
  assert.equal(w.pin, 2);
  // an execution that takes it under half: it roars, as single player does
  w.hp = w.def.hp * 0.5 + 60;
  exec(b);
  assert.equal(w.phase, 2);
  assert.equal(w.state, "roar");
  assert.equal(w.pin, 0);
  assert.equal(named(a, "roar").length, 1);
  // one that kills it
  run(h, 1.5, both);
  w.state = "chase";
  w.posture = 0;
  a.ev("parry", w.id, w.an, w.def.posture);
  a.ev("pin", w.id);
  w.hp = 100;
  exec(a);
  assert.equal(w.dead, true);
  assert.deepEqual(named(b, "kill").map((k) => k.slice(0, 3)), [["kill", w.id, 1]]);
});
// The lobby: a room that starts in the hall and travels between worlds.
// The point d metres in front of a portal (portalFront).
check("a room starts in the hall", () => {
  const h = hall();
  assert.equal(h.S.kind, "hub");
  assert.equal(h.S.epoch, 1);
  assert.equal(h.S.n, 1);
  assert.deepEqual(h.G.enemies.map((e) => e.type), ["dummy"]);
  assert.equal(h.S.byId.get(0), h.G.enemies[0]);
  const a = fakeClient(h, 1, "fighter");
  const j = a.join;
  assert.equal(j.v, 3);
  assert.equal(j.e, 1);
  assert.equal(j.kind, "hub");
  assert.equal(j.grade, null);
  assert.equal(j.seed, 0);
  assert.equal(j.n, 1);
  assert.equal(j.sum, h.sum(h.G.world));
  assert.deepEqual(j.enemies.map((q) => q[1]), ["dummy"]);
  assert.deepEqual(
    h.G.world.portals.map((q) => [q.grade, q.open]),
    [["E", true], ["D", false], ["C", false], ["B", false], ["A", false], ["S", false]],
  );
  // the proxy stands at the hall's start and is there once it answered
  const px = h.S.px.get(1);
  assert.ok(dist(px, h.G.world.spawn) < 1e-9);
  assert.equal(px.here, true);
  // the placeholder: dead and far outside the hall
  assert.equal(h.G.player.state, "dead");
  assert.ok(h.G.world.fieldAt(h.G.player.x, h.G.player.z) < -2);
});
check("the co-op hall is the same with any save", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter");
  // with E cleared the solo hall opens D; the co-op hall does not
  h.clearGrade("E", "fighter");
  assert.equal(h.sum(h.genHub(true)), a.join.sum);
  assert.notEqual(h.sum(h.genHub()), a.join.sum);
  h.start({ hub: true });
  assert.equal(h.sum(h.G.world), a.join.sum);
  assert.equal(h.G.world.portals.find((q) => q.grade === "D").open, false);
});
check("the host's player travels", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  a.ev("travel", "E", 99);
  // the cave a fresh host builds for two from that seed
  const ref = loadHost();
  ref.start({ seed: 99, grade: "E", two: true });
  const sum = ref.sum(ref.G.world);
  assert.equal(ref.G.world.big, true);
  for (const c of [a, b]) {
    const w = worlds(c);
    assert.equal(w.length, 1, "client " + c.pid + " got " + w.length + " worlds");
    const d = w[0];
    assert.equal(d.e, 2);
    assert.equal(d.kind, "cave");
    assert.equal(d.grade, "E");
    assert.equal(d.seed, 99);
    // two in the room: a dungeon for two, with its extra enemies
    assert.equal(d.n, 2);
    assert.equal(d.enemies.length, h.G.world.spawns.length);
    assert.ok(d.enemies.length > ownSpawns(h.G.world).length);
    assert.deepEqual(d.dead, []);
    assert.equal(d.bossDead, false);
    assert.equal(d.sum, sum);
    assert.equal(d.from, null);
    assert.equal(d.won, null);
    assert.equal(typeof d.t, "number");
  }
  assert.equal(h.S.kind, "cave");
  assert.equal(h.S.epoch, 2);
  assert.equal(h.G.enemies.length, h.G.world.spawns.length);
  // both stand at the cave's start at full health, the friend beside it
  for (const px of h.S.px.values()) {
    assert.ok(dist(px, arrival(h, px.pid, h.G.world.spawn)) < 1e-9);
    assert.equal(px.hp, px.maxHp);
    assert.equal(px.state, "free");
  }
});
check("the friend cannot travel, nor can anyone travel where it may not", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  const same = (why) => {
    assert.equal(h.S.epoch, 1, why);
    assert.equal(h.S.kind, "hub", why);
    assert.equal(worlds(a).length + worlds(b).length, 0, why);
  };
  b.ev("travel", "E", 99);
  same("the friend travelled");
  a.ev("travel", "D", 99);
  same("a sealed grade");
  a.ev("travel", "hub");
  same("to the hall from the hall");
  for (const seed of [null, "99", undefined, NaN, Infinity, [99]]) {
    a.ev("travel", "E", seed);
    same("seed " + String(seed));
  }
  a.ev("travel", "Z", 99);
  a.ev("travel");
  same("an unknown place");
  a.ev("travel", "E", 99);
  assert.equal(h.S.epoch, 2);
  b.ev("travel", "hub");
  a.ev("travel", "E", 7);
  assert.equal(h.S.epoch, 2, "to a cave from a cave");
  assert.equal(h.G.seed, 99);
});
check("a player is not there until it answers", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter", { at: false });
  const px = h.S.px.get(2);
  assert.equal(px.here, false, "here before its at");
  b.arrive();
  assert.equal(px.here, true);
  a.ev("travel", "E", 99);
  assert.equal(px.here, false, "here in a world it has not answered");
  assert.equal(h.S.px.get(1).here, true);
  const e = lone(h),
    q = spot(h, e, 2),
    n = b.nsnap;
  // standing beside the husk, by its own word and on the host
  run(h, 1, () => {
    a.at(h.G.world.spawn.x, h.G.world.spawn.z);
    b.at(q.x, q.z);
  });
  assert.equal(b.nsnap, n, "a snapshot before its at");
  assert.ok(dist(px, arrival(h, 2, h.G.world.spawn)) < 1e-9, "a state moved it");
  hit(b, e, 10);
  assert.equal(e.hp, e.def.hp, "a hit landed");
  assert.equal(px.ack, 0, "a hit was acknowledged");
  Object.assign(px, { x: q.x, z: q.z, heard: h.S.step / 60 });
  run(h, 1, () => a.at(h.G.world.spawn.x, h.G.world.spawn.z));
  assert.equal(e.aware, false, "it woke for a player not there");
  assert.notEqual(e.tg, 2, "it hunts a player not there");
  // the answer: all four work
  b.arrive();
  assert.equal(px.here, true);
  run(h, 1, () => {
    a.at(h.G.world.spawn.x, h.G.world.spawn.z);
    b.at(q.x, q.z);
  });
  assert.ok(b.nsnap > n, "no snapshot after its at");
  assert.ok(dist(px, q) < 0.05, "its state did not move it");
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 2);
  const seq = hit(b, e, 10);
  assert.ok(e.hp < e.def.hp, "the hit did not land");
  assert.equal(px.ack, seq);
});
check("a wrong epoch is not an arrival", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter", { at: false });
  b.arrive();
  a.ev("travel", "E", 99);
  const px = h.S.px.get(2),
    ack = px.ack;
  for (const e of [h.S.epoch - 1, h.S.epoch + 1, String(h.S.epoch), null]) {
    b.ev("at", e);
    assert.equal(px.here, false, "at " + String(e));
    assert.equal(px.ack, ack, "an at for another epoch was acknowledged: " + String(e));
  }
  const seq = b.ev("at", h.S.epoch);
  assert.equal(px.here, true);
  assert.equal(px.ack, seq);
});
check("event numbers start again at every swap", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter", { at: false }),
    b = fakeClient(h, 2, "fighter", { at: false });
  a.arrive();
  b.arrive();
  for (let i = 0; i < 5; i++) b.ev("cls", i % 2 ? "mage" : "fighter");
  assert.equal(h.S.px.get(2).ack, 6);
  const t = a.ev("travel", "E", 99);
  assert.equal(t, 2);
  for (const pid of [1, 2]) assert.equal(h.S.px.get(pid).ack, 0, "pid " + pid);
  // the client counts from 1 again: its at is 1
  assert.equal(b.arrive(), 1);
  assert.equal(h.S.px.get(2).ack, 1);
  assert.equal(a.arrive(), 1);
  assert.equal(h.S.px.get(1).ack, 1);
  run(h, 3 / 60, () => a.at(h.G.world.spawn.x, h.G.world.spawn.z));
  assert.equal(a.snap.ack, 1);
});
check("an arrival after a wipe gets the enemies again", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter", { at: false });
  run(h, 0.5, () => a.at(s.x, s.z));
  hit(a, husk(h, 37), 42);
  assert.equal(husk(h, 37).dead, true);
  assert.equal(named(a, "kill").length, 1);
  assert.equal(named(b, "kill").length, 0, "a kill sent to a player not there");
  b.arrive();
  const r = named(b, "reset");
  assert.equal(r.length, 1);
  assert.ok(r[0][1].dead.includes(37));
  assert.equal(r[0][1].enemies.length, 47);
  assert.equal(named(a, "reset").length, 0);
  // nothing changed since: no list again
  const c = fakeClient(h, 3, "fighter", { at: false });
  c.arrive();
  assert.equal(named(c, "reset").length, 0);
  // a wipe while one is away in the swap: no reset for it, the list on arrival
  const h2 = hall(),
    a2 = fakeClient(h2, 1, "fighter"),
    b2 = fakeClient(h2, 2, "fighter", { at: false });
  b2.arrive();
  a2.ev("travel", "E", 99);
  const s2 = h2.G.world.spawn;
  run(h2, 0.2, () => a2.at(s2.x, s2.z, { state: "dead", hp: 0 }));
  assert.equal(named(a2, "reset").length, 1, "a lone dead player is a wipe");
  assert.equal(named(b2, "reset").length, 0);
  b2.arrive();
  assert.equal(named(b2, "reset").length, 1);
});
check("back to the hall", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  a.ev("travel", "E", 99);
  const s = h.G.world.spawn;
  run(h, 0.5, () => {
    a.at(s.x, s.z, { hp: 0.5 });
    b.at(s.x + 1, s.z, { state: "dead", hp: 0 });
  });
  a.ev("travel", "hub");
  assert.equal(h.S.kind, "hub");
  assert.equal(h.S.epoch, 3);
  for (const c of [a, b]) {
    const d = worlds(c).at(-1);
    assert.equal(d.kind, "hub");
    assert.equal(d.e, 3);
    assert.equal(d.grade, null);
    assert.equal(d.seed, 0);
    assert.equal(d.from, "E");
    assert.equal(d.won, null);
    assert.deepEqual(d.enemies.map((q) => q[1]), ["dummy"]);
  }
  const f = front(h.G.world.portals.find((q) => q.grade === "E"), 3.5);
  for (const px of h.S.px.values()) {
    assert.ok(dist(px, arrival(h, px.pid, f)) < 0.01, "pid " + px.pid + " is not in front of E's gate");
    assert.equal(px.hp, px.maxHp);
    assert.equal(px.state, "free");
  }
});
check("a second trip is a fresh cave", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter");
  a.ev("travel", "E", 99);
  assert.equal(h.S.epoch, 2);
  const first = worlds(a).at(-1).sum;
  run(h, 0.2, () => a.at(h.G.world.spawn.x, h.G.world.spawn.z));
  killWarden(a, warden(h));
  hit(a, husk(h, 37), 42);
  assert.equal(h.G.bossDead, true);
  a.ev("travel", "hub");
  assert.equal(h.S.epoch, 3);
  assert.equal(h.G.bossDead, false);
  a.ev("travel", "E", 7);
  assert.equal(h.S.epoch, 4);
  const d = worlds(a).at(-1);
  assert.equal(d.seed, 7);
  assert.notEqual(d.sum, first);
  assert.equal(d.bossDead, false);
  assert.deepEqual(d.dead, []);
  assert.equal(h.G.bossDead, false);
  assert.ok(h.G.enemies.length > 0);
  assert.ok(h.G.enemies.every((e) => !e.dead));
  assert.ok(h.G.enemies.some((e) => e.def.boss));
  h.G.enemies.forEach((e, i) => assert.equal(h.S.byId.get(i), e));
});
check("crossing requests swap once", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter", { at: false });
  b.arrive();
  a.ev("travel", "E", 99);
  b.arrive();
  run(h, 0.2, () => a.at(h.G.world.spawn.x, h.G.world.spawn.z));
  killWarden(a, warden(h));
  const e0 = h.S.epoch;
  // Return to base and the friend's step into the gate, before the next tick
  a.ev("travel", "hub");
  b.ev("gate");
  assert.equal(h.S.epoch, e0 + 1);
  assert.equal(h.S.kind, "hub");
  run(h, 1 / 60);
  assert.equal(h.S.epoch, e0 + 1);
  // the other order: the friend's step into the gate, then Return to base
  b.arrive();
  a.ev("travel", "E", 7);
  b.arrive();
  assert.equal(h.S.px.get(2).here, true);
  run(h, 0.2, () => a.at(h.G.world.spawn.x, h.G.world.spawn.z));
  killWarden(a, warden(h));
  const e1 = h.S.epoch;
  b.ev("gate");
  a.ev("travel", "hub");
  assert.equal(h.S.epoch, e1 + 1);
  assert.equal(h.S.kind, "hub");
  run(h, 1 / 60);
  assert.equal(h.S.epoch, e1 + 1);
});
check("a join mid-swap", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter", { at: false });
  a.arrive();
  a.ev("travel", "E", 99);
  assert.equal(h.S.px.get(1).here, false);
  const b = fakeClient(h, 2, "mage");
  assert.equal(b.join.kind, "cave");
  assert.equal(b.join.seed, 99);
  assert.equal(b.join.e, h.S.epoch);
  assert.equal(b.join.sum, h.sum(h.G.world));
  assert.equal(h.S.px.get(2).here, true);
});
// Every world puts the friend's proxy beside the host's, never inside it,
// until the friend's page is heard; the host's on the arrival point.
check("the friend's proxy arrives beside the host's", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  const beside = (why, at) => {
    const p1 = h.S.px.get(1),
      p2 = h.S.px.get(2),
      d = dist(p1, p2);
    assert.ok(dist(p1, at) < 1e-6, why + ": pid 1 is off the arrival point");
    assert.ok(d >= 0.8 && d <= 1.6, why + ": " + d.toFixed(3) + " m apart");
    assert.ok(h.G.world.fieldAt(p2.x, p2.z) > 0, why + ": pid 2 in the rock");
  };
  beside("the join", h.G.world.spawn);
  a.ev("travel", "E", 99);
  beside("the cave", h.G.world.spawn);
  a.ev("travel", "hub");
  beside("back in the hall", front(h.G.world.portals.find((q) => q.grade === "E"), 3.5));
  assert.equal(b.world.kind, "hub");
});
// A class picked as the host travels: dropped while that player is not
// there, and taken from the cls a page sends after its at.
check("a cls across a swap: dropped before the at, heard after it", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage", { at: false });
  b.arrive();
  a.ev("travel", "E", 99);
  assert.equal(h.S.px.get(2).here, false);
  b.ev("cls", "tanker");
  assert.equal(h.S.px.get(2).clsId, "mage");
  assert.equal(named(a, "cls").length, 0);
  b.arrive();
  b.ev("cls", "tanker");
  assert.equal(h.S.px.get(2).clsId, "tanker");
  assert.deepEqual(named(a, "cls"), [["cls", 2, "tanker"]]);
  // the same class again changes nothing and tells nobody
  b.ev("cls", "tanker");
  assert.equal(named(a, "cls").length, 1);
});
check("the dummy stands back up", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter");
  const d = h.G.enemies[0];
  assert.equal(d.type, "dummy");
  run(h, 0.2, () => a.at(d.x, d.z - 2));
  a.ev("parry", d.id, d.an, d.def.posture);
  assert.equal(d.state, "stagger");
  a.ev("pin", d.id);
  assert.equal(d.pin, 1);
  a.ev("exec", d.id);
  assert.equal(d.dead, false);
  assert.equal(d.hp, d.def.hp);
  assert.equal(d.posture, 0);
  assert.equal(d.pin, 0);
  assert.equal(d.state, "idle");
  assert.equal(named(a, "kill").length, 0);
  run(h, 0.5, () => a.at(d.x, d.z - 2));
  assert.equal(h.G.enemies[0], d);
  assert.equal(d.dead, false);
});
// ---- a dungeon tuned for two ----
// A room whose hall has pids 1 and 2 in it, and the host's player travels
// to cave seed: a dungeon for two.
function forTwo(seed = 99) {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  a.ev("travel", "E", seed);
  return { h, a, b };
}
// The room packs of a spawn list by node: tunnel posts (node -1) and the
// boss are none.
function packs(h, spawns) {
  const m = new Map();
  for (const s of spawns) {
    if (s.node < 0 || h.EDEF[s.type].boss) continue;
    if (!m.has(s.node)) m.set(s.node, []);
    m.get(s.node).push(s);
  }
  return m;
}
// A deep pack holds two or more brutes.
const deepPack = (list) => list.filter((s) => s.type === "brute").length >= 2;
// The health and posture an enemy of type has in a dungeon for two.
function scaled(h, type) {
  const d = h.EDEF[type];
  if (d.dummy) return { hp: d.hp, posture: d.posture };
  return d.boss
    ? { hp: Math.round(d.hp * 1.8), posture: Math.round(d.posture * 1.5) }
    : { hp: Math.round(d.hp * 1.3), posture: Math.round(d.posture * 1.3) };
}
check("the count of players fixes the tuning", () => {
  const { h, a, b } = forTwo();
  for (const c of [a, b]) assert.equal(worlds(c).at(-1).n, 2, "client " + c.pid);
  assert.equal(h.S.n, 2);
  assert.equal(h.NET.two, true);
  assert.ok(h.G.enemies.length > ownSpawns(h.G.world).length);
  // one in the hall: a cave for one, and a friend who joins it changes nothing
  const h1 = hall(),
    a1 = fakeClient(h1, 1, "fighter");
  a1.ev("travel", "E", 99);
  assert.equal(worlds(a1).at(-1).n, 1);
  assert.equal(h1.S.n, 1);
  assert.equal(h1.NET.two, false);
  const b1 = fakeClient(h1, 2, "mage");
  assert.equal(b1.join.n, 1);
  assert.equal(b1.join.enemies.length, 47);
  assert.equal(h1.G.enemies.length, 47);
  assert.equal(h1.S.n, 1);
  assert.equal(h1.NET.two, false);
  // two, then the friend leaves: back to the hall and out again is for one
  h.leave(2);
  a.ev("travel", "hub");
  a.ev("travel", "E", 99);
  assert.equal(worlds(a).at(-1).n, 1);
  assert.equal(h.S.n, 1);
  assert.equal(h.NET.two, false);
  assert.equal(h.G.enemies.length, 47);
  assert.equal(h.G.world.spawns.length, 47);
});
check("more enemies", () => {
  const { h, a } = forTwo(),
    sp1 = h.genWorld(99, true).spawns,
    sp = h.G.world.spawns,
    w = h.G.world;
  // the generator's own spawns come first and are unchanged
  assert.deepEqual(sp.slice(0, sp1.length), sp1);
  const extras = sp.slice(sp1.length),
    g1 = packs(h, sp1),
    g2 = packs(h, sp);
  assert.equal(g2.size, g1.size);
  let deep = 0,
    want = 0;
  for (const [node, list] of g1) {
    const k = deepPack(list) ? 2 : 1;
    if (k === 2) deep++;
    want += k;
    assert.equal(g2.get(node).length, list.length + k, "room " + node);
  }
  assert.ok(deep > 0, "cave 99 has no room with two brutes");
  assert.equal(extras.length, want);
  for (const x of extras) {
    assert.notEqual(x.node, -1, "an extra on a tunnel post");
    assert.ok(!h.EDEF[x.type].boss, "an extra boss");
    assert.ok(w.fieldAt(x.x, x.z) > 0, "an extra in the rock");
    const pack = g1.get(x.node);
    assert.ok(pack, "an extra in no room");
    assert.ok(pack.some((s) => s.type === x.type), "an extra of a type not in its pack");
    assert.ok(pack.some((s) => dist(s, x) < 3), "an extra far from its pack");
    assert.ok(Number.isFinite(x.yaw));
  }
  // every spawn is an enemy, on the host and in the world event
  assert.equal(h.G.enemies.length, sp.length);
  assert.equal(worlds(a).at(-1).enemies.length, sp.length);
  h.G.enemies.forEach((e, i) => assert.equal(h.S.byId.get(i), e));
  // the same seed gives the same extras
  assert.deepEqual(forTwo().h.G.world.spawns, sp);
});
check("tougher", () => {
  const { h, a } = forTwo(),
    E = h.EDEF,
    hk = lone(h),
    w = warden(h);
  assert.equal(hk.def.hp, Math.round(E.husk.hp * 1.3));
  assert.equal(hk.def.posture, Math.round(E.husk.posture * 1.3));
  assert.equal(w.def.hp, Math.round(620 * 1.8));
  assert.equal(w.def.posture, 210);
  for (const e of h.G.enemies) {
    const s = scaled(h, e.type);
    assert.equal(e.def.hp, s.hp, e.type);
    assert.equal(e.def.posture, s.posture, e.type);
    assert.equal(e.hp, e.def.hp, "health at spawn");
    assert.notEqual(e.def, E[e.type]);
    // the rest of the definition is the type's own
    assert.equal(e.def.atks, E[e.type].atks);
    assert.equal(e.def.name, E[e.type].name);
  }
  assert.equal(E.husk.hp, 42, "EDEF changed");
  assert.equal(E.husk.posture, 50, "EDEF changed");
  assert.equal(E.warden.hp, 620, "EDEF changed");
  // a snapshot's posture fraction reads the scaled posture
  hk.posture = hk.def.posture / 2;
  const r = h.wire.snapDecode(h.wire.snapEncode(0, 0, [], [hk])).en[0];
  assert.ok(Math.abs(r.post - 0.5) <= 1 / 255, "posture " + r.post);
  // the Warden's second phase: at half its scaled health and not before
  const s = h.G.world.spawn;
  run(h, 0.2, () => a.at(s.x, s.z));
  const half = w.def.hp / 2;
  hit(a, w, 400);
  hit(a, w, w.hp - Math.ceil(half) - 1);
  assert.ok(w.hp > half, "health " + w.hp);
  assert.equal(w.phase, 1, "phase 2 at " + w.hp);
  hit(a, w, 2);
  assert.ok(w.hp < half && w.hp > 620 / 2, "health " + w.hp);
  assert.equal(w.phase, 2);
});
// Six husks awake, three beside each of two players standing d metres apart
// and in sight of their own three, away from the boss chamber. Returns, over
// sec seconds, the most tokens held against one player and in all.
// opts.b(step) may give b's state fields for that step; opts.each(step, per)
// sees the holders of each target after the step; opts.keep leaves the
// targets at the end unchecked.
function crowd(h, a, b, sec = 10, d = 30, opts = {}) {
  const w = h.G.world,
    bc = w.boss,
    ok = (q) => w.fieldAt(q.x, q.z) > 2.5 && Math.hypot(q.x - bc.x, q.z - bc.z) > bc.r + 12;
  let pair = null;
  for (const n of w.nodes) {
    if (pair || !ok(n)) continue;
    for (let i = 0; i < 72 && !pair; i++) {
      const an = (i * Math.PI) / 36,
        q = { x: n.x + Math.sin(an) * d, z: n.z + Math.cos(an) * d };
      if (ok(q)) pair = [{ x: n.x, z: n.z }, q];
    }
  }
  assert.ok(pair, "no two spots " + d + " m apart");
  const husks = h.G.enemies.filter((e) => e.type === "husk").slice(0, 6);
  assert.equal(husks.length, 6);
  husks.forEach((e, i) => {
    const q = pair[i % 2];
    let put = false;
    for (let k = 0; k < 72 && !put; k++) {
      const an = (Math.floor(i / 2) * 2 * Math.PI) / 3 + (k * Math.PI) / 36,
        x = q.x + Math.sin(an) * 2.5,
        z = q.z + Math.cos(an) * 2.5;
      if (w.fieldAt(x, z) > 0.8 && w.los(x, z, q.x, q.z)) {
        Object.assign(e, { x, z, hx: x, hz: z, yaw: Math.atan2(q.x - x, q.z - z) });
        put = true;
      }
    }
    assert.ok(put, "no room for husk " + i);
  });
  let most = 0,
    total = 0;
  const per = new Map();
  let step = 0;
  run(h, sec, () => {
    a.at(pair[0].x, pair[0].z);
    b.at(pair[1].x, pair[1].z, opts.b ? opts.b(step) : {});
    per.clear();
    let n = 0;
    for (const e of h.G.enemies)
      if (e.token && !e.dead && !e.def.boss) {
        n++;
        per.set(e.tg, (per.get(e.tg) || 0) + 1);
      }
    for (const v of per.values()) most = Math.max(most, v);
    total = Math.max(total, n);
    if (opts.each) opts.each(step, per);
    step++;
  });
  if (!opts.keep) {
    assert.ok(husks.every((e) => e.aware), "a husk did not wake");
    assert.equal(husks[0].tg, 1);
    assert.equal(husks[1].tg, 2);
  }
  return { most, total };
}
check("two attackers per player", () => {
  const { h, a, b } = forTwo(),
    r = crowd(h, a, b);
  assert.ok(r.most <= 2, "against one player: " + r.most);
  assert.equal(r.total, 4, "in all: " + r.total);
  // a cave built for one: two in all
  const h1 = cave(),
    a1 = fakeClient(h1, 1, "fighter"),
    b1 = fakeClient(h1, 2, "mage");
  assert.equal(h1.S.n, 1);
  const r1 = crowd(h1, a1, b1);
  assert.ok(r1.total <= 2, "in all, for one: " + r1.total);
  assert.ok(r1.total > 0, "nobody attacked");
});
// Four hold a turn, two against each player; then pid 2 sends dead states or
// goes quiet for longer than COOP.AWAY and its three hunt pid 1: from the tick
// after the switch on, no more than two turns are held against pid 1.
for (const how of ["dead states", "silence"]) {
  check("a switched target gives up the turn: " + how, () => {
    const { h, a, b } = forTwo();
    let start = -1,
      sw = -1,
      worst = 0;
    const quiet = { at: () => {} },
      bb = how === "silence" ? { at: (x, z, o) => (start >= 0 ? quiet.at() : b.at(x, z, o)) } : b;
    crowd(h, a, bb, 12, 30, {
      keep: true,
      b: () => (start >= 0 && how === "dead states" ? { state: "dead", hp: 0 } : {}),
      each: (step, per) => {
        const n = [...per.values()].reduce((x, y) => x + y, 0),
          mine = h.G.enemies.filter((e) => e.type === "husk").slice(0, 6)[1];
        if (start < 0) {
          if (step >= 120 && n === 4 && per.get(1) === 2 && per.get(2) === 2) start = step;
        } else if (sw < 0) {
          if (mine.tg === 1) sw = step;
        } else worst = Math.max(worst, per.get(1) || 0);
      },
    });
    assert.ok(start >= 0, "never four holders, two each");
    assert.ok(sw >= 0, "the three never switched to pid 1");
    assert.ok(worst <= 2, "against the living player: " + worst);
  });
}
// Two hold a turn against pid 1 and a third holds one against pid 2, the
// players side by side: a hit from pid 1 that turns the third onto pid 1
// leaves at most two holders against pid 1 on the next tick.
check("a turn is given up on a target change by a hit", () => {
  const { h, a, b } = forTwo(),
    w = h.G.world;
  let me = null,
    third = null,
    after = null;
  crowd(h, a, b, 12, 3, {
    keep: true,
    each: (step, per) => {
      if (third && !after) {
        after = { mine: per.get(1) || 0, tg: third.tg, token: third.token };
        return;
      }
      if (third || step < 60 || per.get(1) !== 2) return;
      me = h.S.px.get(1);
      const you = h.S.px.get(2);
      // one that the hit turns and whose new target then sticks
      third = h.G.enemies.find(
        (e) =>
          e.token && !e.dead && !e.def.boss && e.tg === 2 && w.los(e.x, e.z, me.x, me.z) &&
          Math.hypot(e.x - me.x, e.z - me.z) - Math.hypot(e.x - you.x, e.z - you.z) < 2.5,
      ) || null;
      // a damage-over-time tick: no flinch, so nothing else drops its turn
      if (third) a.ev("hit", third.id, 1, 0, 2, "", me.x, me.z, third.state, third.an);
    },
  });
  assert.ok(third, "never two against pid 1 and one against pid 2 that a hit could turn");
  assert.ok(after, "no tick after the hit");
  assert.equal(after.tg, 1, "the hit did not turn it");
  assert.ok(after.mine <= 2, "against pid 1: " + after.mine);
});
// pids 1 and 2 in the boss chamber with the Warden awake. dead(on) has pid
// 2 send dead states from the next tick.
function atBoss(h, a, b) {
  const w = warden(h),
    bc = h.G.world.boss,
    qa = spot(h, w, 6),
    qb = spot(h, w, 8, qa.a + Math.PI);
  assert.ok(dist(qa, bc) < bc.r && dist(qb, bc) < bc.r);
  let dead = false;
  const both = () => {
    a.at(qa.x, qa.z);
    b.at(qb.x, qb.z, dead ? { state: "dead", hp: 0 } : {});
  };
  run(h, 1, both);
  assert.equal(w.aware, true, "the Warden did not wake");
  assert.equal(h.S.px.get(2).inBoss, true);
  return { w, both, dead: (on) => (dead = on) };
}
check("a death at the boss feeds it", () => {
  const { h, a, b } = forTwo(),
    { w, both, dead } = atBoss(h, a, b),
    fed = (c) => named(c, "fed");
  w.hp = w.def.hp * 0.4;
  dead(true);
  run(h, 1 / 60, both);
  assert.ok(Math.abs(w.hp - w.def.hp * 0.65) < 1e-6, "health " + w.hp);
  for (const c of [a, b]) {
    const f = fed(c);
    assert.equal(f.length, 1, "client " + c.pid + " got " + f.length);
    assert.equal(f[0][1], w.id);
    assert.equal(typeof f[0][2], "number");
  }
  // more dead states from the same death add nothing
  run(h, 0.5, both);
  assert.ok(Math.abs(w.hp - w.def.hp * 0.65) < 1e-6);
  assert.equal(fed(a).length, 1);
  // risen and dead again at 90%: it stops at full
  dead(false);
  run(h, 0.2, both);
  w.hp = w.def.hp * 0.9;
  dead(true);
  run(h, 1 / 60, both);
  assert.equal(w.hp, w.def.hp);
  assert.equal(fed(b).length, 2);
  // in its second phase, fed above half: still the second phase
  dead(false);
  run(h, 0.2, both);
  hit(a, w, 400);
  hit(a, w, w.hp - w.def.hp * 0.4);
  assert.equal(w.phase, 2);
  dead(true);
  run(h, 1 / 60, both);
  assert.ok(w.hp > w.def.hp / 2, "health " + w.hp);
  assert.equal(w.phase, 2);
  assert.equal(fed(a).length, 3);
});
check("no feed outside the chamber, with the boss asleep or in a cave for one", () => {
  const fed = (c) => named(c, "fed");
  // outside the chamber
  {
    const { h, a, b } = forTwo(),
      w = warden(h),
      qa = spot(h, w, 6),
      s = h.G.world.spawn;
    let d = false;
    const both = () => {
      a.at(qa.x, qa.z);
      b.at(s.x, s.z, d ? { state: "dead", hp: 0 } : {});
    };
    run(h, 1, both);
    assert.equal(w.aware, true);
    assert.equal(h.S.px.get(2).inBoss, false);
    w.hp = w.def.hp * 0.4;
    d = true;
    run(h, 0.5, both);
    assert.equal(w.hp, w.def.hp * 0.4, "fed from outside");
    assert.equal(fed(a).length + fed(b).length, 0);
  }
  // the boss asleep
  {
    const { h, a, b } = forTwo(),
      w = warden(h),
      qb = spot(h, w, 8),
      s = h.G.world.spawn;
    run(h, 0.5, () => a.at(s.x, s.z));
    assert.equal(w.aware, false);
    w.hp = w.def.hp * 0.4;
    run(h, 1 / 60, () => {
      a.at(s.x, s.z);
      b.at(qb.x, qb.z, { state: "dead", hp: 0 });
    });
    assert.equal(h.S.px.get(2).inBoss, true);
    assert.equal(w.hp, w.def.hp * 0.4, "fed asleep");
    assert.equal(fed(a).length + fed(b).length, 0);
  }
  // a cave built for one
  {
    const h = cave(),
      a = fakeClient(h, 1, "fighter"),
      b = fakeClient(h, 2, "mage"),
      { w, both, dead } = atBoss(h, a, b);
    w.hp = w.def.hp * 0.4;
    dead(true);
    run(h, 0.5, both);
    assert.equal(w.hp, w.def.hp * 0.4, "fed in a cave for one");
    assert.equal(fed(a).length + fed(b).length, 0);
  }
});
check("a wipe keeps the tuning", () => {
  const { h, a, b } = forTwo(),
    s = h.G.world.spawn,
    sp = h.G.world.spawns.map((q) => ({ ...q })),
    n = h.G.enemies.length;
  let d = false;
  const both = () => {
    a.at(s.x, s.z, d ? { state: "dead", hp: 0 } : {});
    b.at(s.x + 1, s.z, d ? { state: "dead", hp: 0 } : {});
  };
  run(h, 0.5, both);
  const e = lone(h);
  hit(a, e, 100);
  assert.equal(e.dead, true);
  d = true;
  run(h, 1 / 60, both);
  const r = named(a, "reset");
  assert.equal(r.length, 1);
  assert.equal(r[0][1].enemies.length, n);
  assert.deepEqual(h.G.world.spawns, sp);
  assert.equal(h.G.enemies.length, n);
  for (const e of h.G.enemies) {
    const v = scaled(h, e.type);
    assert.equal(e.def.hp, v.hp, e.type);
    assert.equal(e.def.posture, v.posture, e.type);
    assert.equal(e.hp, e.def.hp);
    assert.equal(e.dead, false);
  }
  assert.equal(h.S.n, 2);
});
check("the hall is never tuned", () => {
  const h = hall();
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  const plain = (why) => {
    assert.equal(h.S.n, 1, why);
    assert.equal(h.NET.two, false, why);
    assert.equal(h.G.edef, null, why);
    assert.equal(h.G.enemies.length, 1, why);
    assert.equal(h.G.enemies[0].def, h.EDEF.dummy, why);
    assert.equal(h.G.enemies[0].hp, h.EDEF.dummy.hp, why);
  };
  plain("the first hall");
  assert.equal(a.join.n, 1);
  assert.equal(b.join.n, 1);
  // out to a cave for two and back
  a.ev("travel", "E", 99);
  assert.equal(h.S.n, 2);
  a.ev("travel", "hub");
  plain("the hall after a cave for two");
  assert.equal(worlds(b).at(-1).n, 1);
});
// ---- the big cave: a cave built for two ----
check("a cave built for two is the big cave", () => {
  const { h, a, b } = forTwo();
  for (const c of [a, b]) {
    const d = worlds(c).at(-1);
    assert.equal(d.n, 2, "client " + c.pid);
    assert.equal(d.sum, h.sum(h.G.world));
  }
  assert.equal(h.S.n, 2);
  assert.equal(h.G.world.big, true);
  assert.equal(h.G.world.nodes.length, 36);
  assert.notEqual(h.sum(h.G.world), SMALL99);
  // started alone: the small cave
  const one = cave();
  assert.equal(one.S.n, 1);
  assert.equal(one.G.world.big, false);
  assert.equal(one.G.enemies.length, 47);
  assert.equal(one.sum(one.G.world), SMALL99);
  assert.equal(lone(one).id, 37);
  // big is for grade E only: a sewer for two is the sewer, with n 2
  const sw = loadHost();
  sw.start({ seed: 5, grade: "D", two: true });
  assert.ok(sw.G.world.sewer, "not the sewer");
  assert.equal(sw.G.world.big, false);
  assert.equal(sw.S.n, 2);
});
check("a friend who joins a cave for one gets the small cave", () => {
  const h = hall(),
    a = fakeClient(h, 1, "fighter");
  a.ev("travel", "E", 99);
  assert.equal(worlds(a).at(-1).n, 1);
  const b = fakeClient(h, 2, "mage");
  assert.equal(b.join.n, 1);
  assert.equal(b.join.sum, SMALL99);
  assert.equal(b.join.enemies.length, 47);
  assert.equal(h.G.world.big, false);
  assert.equal(h.S.n, 1);
});
check("it stays big", () => {
  const { h, a, b } = forTwo(),
    w0 = h.G.world,
    sum = h.sum(w0),
    n = h.G.enemies.length,
    s = w0.spawn;
  let d = false;
  const both = () => {
    a.at(s.x, s.z, d ? { state: "dead", hp: 0 } : {});
    b.at(s.x + 1, s.z, d ? { state: "dead", hp: 0 } : {});
  };
  run(h, 0.5, both);
  // both dead: a wipe makes the enemies again in the same world
  d = true;
  run(h, 1 / 60, both);
  assert.equal(named(a, "reset").length, 1, "no wipe");
  assert.equal(h.G.world, w0);
  assert.equal(h.sum(h.G.world), sum);
  assert.equal(h.G.world.big, true);
  assert.equal(h.G.enemies.length, n);
  assert.equal(h.S.n, 2);
  // the friend leaves: still the big cave, and a lone wipe keeps it
  d = false;
  run(h, 0.2, both);
  h.leave(2);
  run(h, 0.5, () => a.at(s.x, s.z));
  assert.equal(h.G.world, w0);
  assert.equal(h.sum(h.G.world), sum);
  assert.equal(h.G.world.big, true);
  run(h, 1 / 60, () => a.at(s.x, s.z, { state: "dead", hp: 0 }));
  assert.equal(named(a, "reset").length, 2, "no lone wipe");
  assert.equal(h.G.world, w0);
  assert.equal(h.G.world.big, true);
  assert.equal(h.G.enemies.length, n);
  assert.equal(h.S.n, 2);
});
check("a friend who joins the big cave under way", () => {
  const { h, a } = forTwo(),
    sum = h.sum(h.G.world),
    n = h.G.enemies.length,
    s = h.G.world.spawn;
  assert.equal(h.G.world.big, true);
  run(h, 0.2, () => a.at(s.x, s.z));
  h.leave(2);
  // joining again: the big cave and its whole list
  const b = fakeClient(h, 2, "mage");
  assert.equal(b.join.n, 2);
  assert.equal(b.join.sum, sum);
  assert.equal(b.join.enemies.length, n);
  b.join.enemies.forEach(([id, type], i) => {
    assert.equal(id, i);
    assert.equal(type, h.G.enemies[i].type);
  });
  // again, and an enemy killed and a wipe before its at
  h.leave(2);
  const c = fakeClient(h, 2, "mage", { at: false });
  assert.equal(c.join.n, 2);
  assert.equal(c.join.sum, sum);
  const e = h.G.enemies.find((q) => q.type === "husk");
  hit(a, e, 100);
  assert.equal(e.dead, true, "the husk did not die");
  run(h, 1 / 60, () => a.at(s.x, s.z, { state: "dead", hp: 0 }));
  assert.equal(named(a, "reset").length, 1, "a lone dead player is a wipe");
  assert.equal(named(c, "reset").length, 0, "a reset to a player not there");
  c.arrive();
  const r = named(c, "reset");
  assert.equal(r.length, 1, "no reset on arrival");
  assert.equal(r[0][1].enemies.length, n);
  assert.deepEqual(r[0][1].dead, []);
  assert.ok(h.G.enemies.every((q) => !q.dead), "an enemy still dead");
});
check("extras in the big cave", () => {
  const { h } = forTwo(),
    w = h.G.world,
    own = ownSpawns(w),
    extras = w.spawns.slice(own.length),
    g = packs(h, own),
    per = new Map();
  assert.equal(w.big, true);
  assert.equal(own.at(-1).type, "warden");
  assert.ok(extras.length > 0, "no extras");
  for (const x of extras) {
    assert.notEqual(x.node, -1, "an extra on a tunnel post");
    assert.ok(!h.EDEF[x.type].boss, "an extra boss");
    const pack = g.get(x.node);
    assert.ok(pack, "an extra in no pack room");
    assert.ok(pack.some((s) => s.type === x.type), "an extra of a type not in its pack");
    per.set(x.node, (per.get(x.node) || 0) + 1);
  }
  let deep = 0;
  for (const [node, list] of g) {
    const k = list.filter((s) => s.type === "brute").length >= 2 ? 2 : 1;
    if (k === 2) deep++;
    assert.equal(per.get(node) || 0, k, "room " + node + ": " + list.map((s) => s.type).join());
  }
  assert.ok(deep > 0, "no room with two brutes");
  // a pack larger than brute, brute, spit is deep too
  assert.ok(
    [...g.values()].some((l) => l.length > 3 && l.filter((s) => s.type === "brute").length >= 2),
    "no larger two-brute pack in cave 99",
  );
});
check("the enemy count for two", () => {
  const h = loadHost(),
    counts = [];
  for (const seed of [...Array.from({ length: 20 }, (_, i) => i + 1), 99]) {
    h.start({ seed, grade: "E", two: true });
    assert.equal(h.G.world.big, true, "seed " + seed);
    const k = h.G.enemies.length;
    assert.ok(k >= 140 && k <= 215, "seed " + seed + ": " + k);
    counts.push(k);
  }
  const mean = counts.reduce((x, y) => x + y, 0) / counts.length;
  console.log(
    "     enemies for two, seeds 1 to 20 and 99: least " + Math.min(...counts) + ", mean " +
      mean.toFixed(1) + ", most " + Math.max(...counts) + "; seed 99 " + counts.at(-1),
  );
});
check("the host builds the big cave quickly", () => {
  const h = loadHost();
  const t0 = performance.now();
  h.start({ seed: 11, grade: "E", two: true });
  const ms = performance.now() - t0;
  assert.equal(h.G.world.big, true);
  assert.ok(ms < 1000, ms.toFixed(0) + " ms");
  // the host skipped the sight lines: the time alone cannot tell
  assert.ok(h.G.world.pieces.length > 0);
  assert.ok(h.G.world.pieces.every((q) => q.sees.length === 0));
  console.log("     a host build of big cave 11: " + ms.toFixed(0) + " ms");
});
check("a minute in the big cave", () => {
  const { h, a, b } = forTwo(),
    w = h.G.world,
    s = w.spawn,
    r = w.nodes[w.path[5]];
  assert.equal(w.big, true);
  let steps = 0;
  const t0 = performance.now();
  run(h, 60, () => {
    a.at(s.x, s.z);
    b.at(r.x, r.z);
    steps++;
  });
  const ms = (performance.now() - t0) / steps;
  assert.equal(steps, 3600);
  assert.ok(ms < 4, "a step costs " + ms.toFixed(2) + " ms");
  console.log("     a host step in big cave 99 with two players: " + ms.toFixed(3) + " ms");
});
// ---- the Worker driver, with a stand-in for the Worker's global ----
// sc.advance(sec) moves the clock on and fires the interval once, as a
// Worker whose timer stalled for that long would.
function scope() {
  const sc = { posted: [], timers: [], now: 0, socks: [] };
  sc.postMessage = (m) => sc.posted.push(m);
  sc.setInterval = (fn) => sc.timers.push(fn);
  sc.clearInterval = (id) => (sc.timers[id - 1] = null);
  sc.performance = { now: () => sc.now };
  sc.WebSocket = function (url) {
    const so = {
      url, readyState: 0, bufferedAmount: 0, sent: [], closed: null,
      send(b) { so.sent.push(new Uint8Array(b)); },
      close(code) { so.readyState = 3; so.closed = code; },
      open() { so.readyState = 1; so.onopen(); },
      hear(bytes) { so.onmessage({ data: Uint8Array.from(bytes).buffer }); },
    };
    sc.socks.push(so);
    return so;
  };
  sc.advance = (sec) => {
    sc.now += sec * 1000;
    for (const f of sc.timers) if (f) f();
  };
  sc.msg = (data) => sc.onmessage({ data });
  sc.live = () => sc.timers.some(Boolean);
  return sc;
}
// a Worker host with the page joined (pid 1) and there: started in the hall
// as the page starts a room, or with start ({ seed, grade }) in that cave
function workerHost(start = { hub: true }) {
  const h = loadHost(),
    sc = scope();
  h.worker(sc);
  sc.msg({ start: { ...start, relay: "ws://relay.test/", code: "ABCDEF" } });
  sc.msg(h.wire.eventEncode(["hello", 0, h.v, "fighter", h.build]));
  sc.msg(h.wire.eventEncode(["at", 1, h.S.epoch]));
  return { h, sc, so: sc.socks[0] };
}
const evs = (h, list) =>
  list.filter((b) => b instanceof ArrayBuffer && h.wire.type(b) === 3).map((b) => h.wire.eventDecode(b));
const snaps = (h, list) => list.filter((b) => b instanceof ArrayBuffer && h.wire.type(b) === 1).length;

check("the Worker driver starts the room in the hall, opens the room as its host and joins the page", () => {
  const { h, sc, so } = workerHost();
  assert.equal(h.S.kind, "hub");
  assert.equal(h.G.zone, "hub");
  assert.equal(h.S.epoch, 1);
  assert.equal(h.G.enemies.length, 1);
  assert.equal(h.G.enemies[0].type, "dummy");
  assert.equal(sc.socks.length, 1);
  assert.equal(so.url, "ws://relay.test/room/ABCDEF");
  assert.equal(so.binaryType, "arraybuffer");
  const j = evs(h, sc.posted).find((e) => e[0] === "join");
  assert.ok(j, "the page's join was posted to it");
  assert.equal(j[1].pid, 1);
  assert.equal(j[1].kind, "hub");
  assert.equal(j[1].e, 1);
  assert.ok(sc.live(), "a timer runs");
  so.open();
  assert.deepEqual(sc.posted.filter((m) => !(m instanceof ArrayBuffer)), [{ relay: "open" }]);
  // a second start is ignored
  sc.msg({ start: { seed: 5, grade: "E", relay: "ws://relay.test", code: "ZZZZZZ" } });
  assert.equal(h.S.kind, "hub");
  assert.equal(h.S.epoch, 1);
  assert.equal(sc.socks.length, 1);
  // the page's player steps into E: the Worker takes the room to the cave
  sc.msg(h.wire.eventEncode(["travel", 2, "E", 99]));
  const w = evs(h, sc.posted).at(-1);
  assert.equal(w[0], "world");
  assert.equal(w[1].kind, "cave");
  assert.equal(h.G.seed, 99);
  assert.equal(h.G.enemies.length, 47);
});

check("a Worker started with a seed and a grade still starts in that cave", () => {
  const { h, sc } = workerHost({ seed: 99, grade: "E" });
  assert.equal(h.S.kind, "cave");
  assert.equal(h.G.seed, 99);
  assert.equal(h.G.enemies.length, 47);
  const j = evs(h, sc.posted).find((e) => e[0] === "join");
  assert.equal(j[1].kind, "cave");
  assert.equal(j[1].seed, 99);
});

check("the Worker hands the host at most 0.25 s a call, so a stall drops time", () => {
  const { h, sc } = workerHost();
  sc.advance(1 / 60);
  const s0 = h.S.step,
    n0 = sc.posted.length;
  sc.advance(5);
  const steps = h.S.step - s0;
  assert.ok(steps >= 14 && steps <= 15, "steps after a 5 s stall: " + steps);
  assert.ok(snaps(h, sc.posted.slice(n0)) <= 5, "snapshots in one call");
  // and in real time it keeps pace
  const s1 = h.S.step;
  for (let i = 0; i < 60; i++) sc.advance(1 / 60);
  assert.ok(Math.abs(h.S.step - s1 - 60) <= 1, "steps in a second: " + (h.S.step - s1));
});

check("the friend's frames come and go through the relay with its pid byte; notices never reach the host", () => {
  const { h, sc, so } = workerHost();
  so.open();
  // a friend frame before the relay says it is in is dropped
  so.hear([2, ...new Uint8Array(h.wire.eventEncode(["hello", 0, h.v, "tanker", h.build]))]);
  assert.equal(h.S.px.has(2), false);
  so.hear([0, 1, 2]);
  so.hear([0, 9, 9]);
  so.hear([2]);
  assert.equal(h.S.px.size, 1, "a notice joined nobody");
  so.hear([2, ...new Uint8Array(h.wire.eventEncode(["hello", 0, h.v, "tanker", h.build]))]);
  assert.equal(h.S.px.get(2).clsId, "tanker");
  const toFriend = so.sent.map((b) => b.slice(1).buffer);
  assert.ok(so.sent.every((b) => b[0] === 2), "every frame to the relay is addressed to pid 2");
  assert.equal(evs(h, toFriend)[0][0], "join");
  // the page hears of the friend, with no address byte
  assert.deepEqual(evs(h, sc.posted).at(-1), ["peer", 2, "tanker"]);
  // the friend's state moves its proxy, once it has said it is in the cave
  so.hear([2, ...new Uint8Array(h.wire.eventEncode(["at", 1, h.S.epoch]))]);
  assert.equal(h.S.px.get(2).here, true);
  so.hear([2, ...new Uint8Array(h.wire.stateEncode({ x: 3, z: 4, yaw: 0, vx: 0, vz: 0, state: "free", t: 0, move: null, hp: 1, maxHp: 1, speed: 0, guardT: 0, sprint: false }))]);
  assert.equal(h.S.px.get(2).x, 3);
  // snapshots go to both
  const p0 = sc.posted.length,
    f0 = so.sent.length;
  for (let i = 0; i < 6; i++) sc.advance(1 / 60);
  assert.equal(snaps(h, sc.posted.slice(p0)), 2);
  assert.equal(snaps(h, so.sent.slice(f0).map((b) => b.slice(1).buffer)), 2);
  // a backed-up socket gets events but no snapshots
  so.bufferedAmount = 1e6;
  const f1 = so.sent.length;
  for (let i = 0; i < 6; i++) sc.advance(1 / 60);
  h.leave(1);
  const late = so.sent.slice(f1).map((b) => b.slice(1).buffer);
  assert.equal(snaps(h, late), 0, "no snapshot was queued");
  assert.deepEqual(evs(h, late), [["peer", 1, null]]);
  so.bufferedAmount = 0;
  // the relay says the friend left
  sc.msg(h.wire.eventEncode(["hello", 0, h.v, "fighter", h.build]));
  so.hear([0, 2, 2]);
  assert.equal(h.S.px.has(2), false);
  assert.deepEqual(evs(h, sc.posted).at(-1), ["peer", 2, null]);
  const f2 = so.sent.length;
  for (let i = 0; i < 6; i++) sc.advance(1 / 60);
  assert.equal(so.sent.length, f2, "nothing for a friend who is not there");
});

check("a relay socket that closes leaves the run going for the page", () => {
  const { h, sc, so } = workerHost();
  so.open();
  so.hear([0, 1, 2]);
  so.hear([2, ...new Uint8Array(h.wire.eventEncode(["hello", 0, h.v, "tanker", h.build]))]);
  so.readyState = 3;
  so.onerror();
  so.onclose({ code: 1006 });
  const notes = sc.posted.filter((m) => !(m instanceof ArrayBuffer));
  assert.deepEqual(notes, [{ relay: "open" }, { relay: "error" }, { relay: "closed" }]);
  assert.equal(h.S.px.has(2), false, "the friend left with the socket");
  const s0 = h.S.step,
    p0 = sc.posted.length;
  for (let i = 0; i < 30; i++) sc.advance(1 / 60);
  assert.ok(h.S.step - s0 >= 29, "the host steps on");
  assert.ok(snaps(h, sc.posted.slice(p0)) >= 9, "the page still gets snapshots");
  // a relay that cannot be reached at all
  const h2 = loadHost(),
    sc2 = scope();
  sc2.WebSocket = function () {
    throw new SyntaxError("bad url");
  };
  h2.worker(sc2);
  sc2.msg({ start: { seed: 99, grade: "E", relay: "nonsense", code: "ABCDEF" } });
  assert.deepEqual(sc2.posted, [{ relay: "error" }, { relay: "closed" }]);
  assert.ok(sc2.live());
});

check("stop closes the socket, stops the timer and hears nothing more; the gate does not", () => {
  const { h, sc, so } = workerHost();
  so.open();
  sc.msg({ stop: true });
  assert.equal(so.closed, 1000);
  assert.equal(sc.live(), false);
  assert.deepEqual(sc.posted.at(-1), { stopped: true });
  assert.equal(h.S.px.size, 0, "the page left");
  const n = sc.posted.length;
  sc.msg(h.wire.eventEncode(["hello", 0, h.v, "fighter", h.build]));
  assert.equal(sc.posted.length, n);
  // the gate once the boss is dead takes the party to the hall, and the
  // Worker runs on
  const b = workerHost({ seed: 99, grade: "E" });
  b.so.open();
  b.h.G.bossDead = true;
  b.sc.msg(b.h.wire.eventEncode(["gate", 2]));
  const last = evs(b.h, b.sc.posted).at(-1);
  assert.equal(last[0], "world");
  assert.equal(last[1].kind, "hub");
  assert.equal(b.h.S.kind, "hub");
  const s0 = b.h.S.step;
  b.sc.advance(1 / 60);
  assert.equal(b.so.closed, null, "the socket closed");
  assert.equal(b.sc.live(), true, "the timer stopped");
  assert.equal(b.h.S.step, s0 + 1);
});
done();
