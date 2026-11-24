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
check("a dead player is not hunted, and with nobody the enemy goes home", () => {
  const h = cave(),
    e = husk(h, 37);
  const a = fakeClient(h, 1, "fighter");
  const q = spot(h, e, 4);
  run(h, 1, hold(a, q));
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, 1);
  run(h, 1 / 60, hold(a, q, { state: "dead", hp: 0 }));
  assert.equal(e.tg, 0);
  const w = dropsHunt(h, e, 1.6, hold(a, q, { state: "dead", hp: 0 }));
  assert.equal(w, 0, "a new swing at a dead player");
  assert.equal(e.aware, false, "still hunting: " + e.state);
  assert.equal(e.state, "return");
  // it walks home and stays unaware with the dead player in sight
  run(h, 12, hold(a, q, { state: "dead", hp: 0 }));
  assert.equal(e.aware, false);
  assert.ok(Math.hypot(e.x - e.hx, e.z - e.hz) < 1.5, "not home");
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
done();
