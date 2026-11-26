// The Warden for two: the boss of a cave built for two co-op players, run
// by the host copy in Node with two scripted players.
// Run with: node build.mjs && node tests/coop-warden.mjs
import assert from "node:assert/strict";
import { loadHost, fakeClient, run, check, done } from "./lib/coop.mjs";

const named = (c, name) => c.events.filter((ev) => ev[0] === name);
const warden = (h) => h.G.enemies.find((e) => e.def.boss);
// A host on big cave 99 built for two, with both players in it (the fake
// clients arrive by themselves). boss is the Warden.
function duo(seed = 99) {
  const h = loadHost();
  h.start({ seed, grade: "E", two: true });
  const a = fakeClient(h, 1, "fighter"),
    b = fakeClient(h, 2, "mage");
  return { h, a, b, boss: warden(h) };
}
// A host on cave 99 built for one, with one player in it.
function solo(seed = 99) {
  const h = loadHost();
  h.start({ seed, grade: "E" });
  const a = fakeClient(h, 1, "fighter");
  return { h, a, boss: warden(h) };
}
// A walkable point d metres from the boss chamber's centre, searching round
// from angle ang, with room for a body and a clear line to the centre.
function inChamber(h, d, ang = 0) {
  const w = h.G.world,
    bc = w.boss;
  for (let i = 0; i < 72; i++) {
    const a = ang + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 36,
      x = bc.x + Math.sin(a) * d,
      z = bc.z + Math.cos(a) * d;
    if (w.fieldAt(x, z) > 0.8 && w.los(bc.x, bc.z, x, z)) return { x, z, a };
  }
  throw new Error("no spot " + d + " m from the chamber's centre");
}
// Each client standing at its point in the chamber, a state each call:
// pass it to run so neither goes away.
function stand(h, cs, d = 6) {
  const qs = cs.map((c, i) => inChamber(h, d, (i * 2 * Math.PI) / cs.length));
  const each = () => cs.forEach((c, i) => c.at(qs[i].x, qs[i].z));
  each();
  return each;
}
// A melee hit of dmg from client c on the boss, as a page proposes it.
const strike = (c, boss, dmg) =>
  c.ev("hit", boss.id, dmg, 0, 0, "melee", null, null, boss.state, boss.an);
// Strikes until the boss's health is to, in hits under COOP.MAX_DMG.
function strikeTo(c, boss, to) {
  for (let i = 0; i < 8 && boss.hp > to; i++) strike(c, boss, Math.min(480, boss.hp - to));
  assert.ok(Math.abs(boss.hp - to) < 1e-6, "health " + boss.hp + ", not " + to);
}

check("the Warden for two has 1,550 health, 210 posture and three marks", () => {
  const { boss } = duo();
  assert.equal(boss.def.hp, 1550);
  assert.equal(boss.def.posture, 210);
  assert.equal(boss.hp, 1550);
  assert.equal(boss.def.duo, true);
  assert.deepEqual(boss.def.marks, [0.75, 0.5, 0.25]);
});
check("the solo definition is untouched", () => {
  const { h, boss } = duo(),
    W = h.EDEF.warden;
  assert.equal(W.hp, 620);
  for (const k of ["duo", "marks", "roarT"]) assert.ok(!(k in W), k + " in EDEF.warden");
  const solo = Object.keys(W.atks),
    two = Object.keys(boss.def.atks);
  assert.deepEqual(two.slice(0, solo.length), solo);
  // the same attack objects, so the snapshot's attack index finds them
  for (const k of solo) assert.equal(boss.def.atks[k], W.atks[k], k);
});
check("a cave for one has today's Warden", () => {
  const { h, a, boss } = solo(),
    each = stand(h, [a]);
  assert.equal(boss.def, h.EDEF.warden);
  run(h, 0.2, each);
  strike(a, boss, boss.hp - 300);
  assert.equal(boss.phase, 2);
  const r = named(a, "roar");
  assert.equal(r.length, 1);
  assert.equal(r[0][1], boss.id);
  assert.equal(typeof r[0][2], "number");
  assert.equal(r[0][3], 2);
  strike(a, boss, boss.hp - 10);
  assert.equal(boss.phase, 2);
  assert.equal(named(a, "roar").length, 1);
});
check("it roars once at each mark", () => {
  const { h, a, b, boss } = duo(),
    each = stand(h, [a, b]);
  run(h, 0.2, each);
  // the marks are at 1,162.5, 775 and 387.5
  const marks = [
    [1163, 1],
    [1160, 2],
    [776, 2],
    [770, 3],
    [388, 3],
    [380, 4],
  ];
  for (const [to, ph] of marks) {
    strikeTo(a, boss, to);
    assert.equal(boss.phase, ph, "phase at " + to);
  }
  for (const c of [a, b]) {
    const r = named(c, "roar");
    assert.equal(r.length, 3, "client " + c.pid + " got " + r.length);
    r.forEach((ev, i) => {
      assert.equal(ev.length, 4);
      assert.equal(ev[1], boss.id);
      assert.equal(typeof ev[2], "number");
      assert.equal(ev[3], i + 2);
    });
  }
});
check("one hit across two marks roars once", () => {
  const { h, a, b, boss } = duo(),
    each = stand(h, [a, b]);
  run(h, 0.2, each);
  boss.hp = 1170;
  strike(a, boss, 480);
  assert.equal(boss.hp, 690);
  assert.equal(boss.phase, 3);
  for (const c of [a, b]) {
    const r = named(c, "roar");
    assert.equal(r.length, 1, "client " + c.pid + " got " + r.length);
    assert.equal(r[0][3], 3);
  }
});
check("a phase does not go back", () => {
  const { h, a, b, boss } = duo(),
    each = stand(h, [a, b]);
  run(h, 0.2, each);
  strikeTo(a, boss, 700);
  assert.equal(boss.phase, 3);
  boss.hp = boss.def.hp;
  strike(a, boss, 5);
  assert.equal(boss.phase, 3);
  assert.equal(named(a, "roar").length, 2);
});
check("the phase 4 roar lasts 2.2 s", () => {
  const { h, a, b, boss } = duo(),
    each = stand(h, [a, b]);
  run(h, 0.2, each);
  strikeTo(a, boss, 380);
  assert.equal(boss.phase, 4);
  assert.equal(boss.state, "roar");
  run(h, 2.1, each);
  assert.equal(boss.state, "roar", "over before 2.1 s");
  run(h, 0.2, each);
  assert.notEqual(boss.state, "roar", "still roaring at 2.3 s");
  // the phase 2 roar is today's 1.2 s
  const two = duo(),
    each2 = stand(two.h, [two.a, two.b]);
  run(two.h, 0.2, each2);
  strikeTo(two.a, two.boss, 1160);
  assert.equal(two.boss.phase, 2);
  assert.equal(two.boss.state, "roar");
  run(two.h, 1.3, each2);
  assert.notEqual(two.boss.state, "roar", "still roaring at 1.3 s");
});
check("host.phase(n) is a hit across the mark", () => {
  const { h, a, b, boss } = duo();
  assert.equal(h.phase(3), boss);
  assert.equal(boss.phase, 3);
  assert.equal(boss.state, "roar");
  assert.ok(boss.hp < 775 && boss.hp > 770, "health " + boss.hp);
  for (const c of [a, b]) {
    const r = named(c, "roar");
    assert.equal(r.length, 1, "client " + c.pid + " got " + r.length);
    assert.equal(r[0][3], 3);
  }
  // a phase it has passed, or none of the Warden's, is nothing
  assert.equal(h.phase(2), null);
  assert.equal(h.phase(5), null);
  assert.equal(h.phase(4), boss);
  assert.equal(boss.phase, 4);
  assert.ok(boss.hp < 387.5 && boss.hp > 382, "health " + boss.hp);
  // a cave for one has no Warden for two
  assert.equal(solo().h.phase(2), null);
});

done();
