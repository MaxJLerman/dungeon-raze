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
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const named = (c, name) => c.events.filter((ev) => ev[0] === name);
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
  assert.equal(j.v, 1);
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
check("a hello joins a matching version and refuses another", () => {
  const h = cave(),
    got = new Map();
  h.send = (pid, buf) => {
    if (h.wire.type(buf) !== 3) return;
    if (!got.has(pid)) got.set(pid, []);
    got.get(pid).push(h.wire.eventDecode(buf));
  };
  const hello = (pid, v, cls) => h.recv(pid, h.wire.eventEncode(["hello", 0, v, cls]));
  assert.equal(typeof h.v, "number");
  hello(1, h.v, "fighter");
  assert.ok(h.S.px.has(1), "a matching hello joins");
  assert.equal(h.S.px.get(1).clsId, "fighter");
  assert.equal(got.get(1).length, 1);
  assert.equal(got.get(1)[0][0], "join");
  assert.equal(got.get(1)[0][1].pid, 1);
  // another version: told so, and no proxy
  hello(2, h.v + 1, "mage");
  assert.ok(!h.S.px.has(2), "a wrong version does not join");
  assert.deepEqual(got.get(2), [["no", "version"]]);
  // a hello from a player already in is ignored
  const px = h.S.px.get(1);
  hello(1, h.v, "mage");
  assert.equal(h.S.px.get(1), px);
  assert.equal(got.get(1).length, 1);
  // a frame that is not a hello does not join anyone
  h.recv(3, h.wire.eventEncode(["hit", 1, 37, 10, 0]));
  h.recv(3, h.wire.stateEncode({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, state: "free", t: 0, move: null, hp: 1, maxHp: 1, speed: 0, guardT: 0, sprint: false }));
  h.recv(3, new ArrayBuffer(0));
  assert.ok(!h.S.px.has(3));
  assert.equal(got.has(3), false);
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
  assert.equal(a.snap.ack, 0);
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
check("the gate ends the run only once the boss is dead", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  const both = () => {
    a.at(s.x, s.z);
    b.at(s.x + 1, s.z);
  };
  run(h, 1, both);
  b.ev("gate");
  assert.equal(named(a, "end").length, 0);
  run(h, 0.5, both);
  assert.equal(h.S.step, 90);
  killWarden(a, warden(h));
  run(h, 0.5, both);
  const seq = b.ev("gate");
  for (const c of [a, b]) {
    const e = named(c, "end");
    assert.equal(e.length, 1);
    assert.deepEqual(e[0], ["end", h.G.runT]);
  }
  assert.ok(Math.abs(h.G.runT - 2) < 0.05, "runT " + h.G.runT);
  const step = h.S.step,
    na = a.nsnap,
    ne = a.events.length;
  run(h, 1, both);
  b.ev("gate");
  hit(a, husk(h, 37), 10);
  assert.equal(h.S.step, step);
  assert.equal(a.nsnap, na);
  assert.equal(a.events.length, ne);
  assert.equal(husk(h, 37).hp, 42);
  assert.ok(seq > 0);
});
check("a player's shots and blasts go to the other player only", () => {
  const h = cave(),
    s = h.G.world.spawn;
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "fighter");
  a.ev("pshot", 1, 1.25, 2, 10, -3, 0.2, 0.5, 1);
  a.ev("pblast", 4, 5, 3.5, 1, 0.4, 0.1);
  assert.deepEqual(named(b, "pshot"), [["pshot", 1, 1, 1.25, 2, 10, -3, 0.2, 0.5, 1]]);
  assert.deepEqual(named(b, "pblast"), [["pblast", 1, 4, 5, 3.5, 1, 0.4, 0.1]]);
  assert.equal(named(a, "pshot").length + named(a, "pblast").length, 0);
  b.ev("pblast", 1, 2, 3, 0, 0, 0);
  assert.deepEqual(named(a, "pblast"), [["pblast", 2, 1, 2, 3, 0, 0, 0]]);
  run(h, 3 / 60, () => a.at(s.x, s.z));
  assert.equal(a.snap.ack, 2);
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
done();
