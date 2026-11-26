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
  // (but for the slam, which is a copy that carries the aftershock)
  for (const k of solo) if (k !== "slam") assert.equal(boss.def.atks[k], W.atks[k], k);
});
check("the slam for two carries an aftershock and the solo slam does not", () => {
  const { h, boss } = duo(),
    W = h.EDEF.warden;
  assert.equal(boss.def.atks.slam.after.dmg, 14);
  assert.deepEqual(boss.def.atks.slam.after, { from: 2, wait: 0.35, speed: 11, reach: 24, band: 1.2, dmg: 14 });
  assert.equal(W.atks.slam.after, undefined);
  assert.notEqual(boss.def.atks.slam, W.atks.slam);
  // the same slam otherwise, and the same place in the key order
  assert.deepEqual({ ...boss.def.atks.slam, after: undefined }, { ...W.atks.slam, after: undefined });
  assert.deepEqual(Object.keys(boss.def.atks).slice(0, Object.keys(W.atks).length), Object.keys(W.atks));
  assert.equal(Object.keys(boss.def.atks).indexOf("slam"), Object.keys(W.atks).indexOf("slam"));
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

// Attention: whom the Warden for two hunts (docs/notes/coop.md).
// Two players 6 m either side of the chamber's centre, the Warden awake
// (a hit wakes it) with no score and hunting a. Returns the setup and the
// function that keeps both there.
function attend() {
  const s = duo(),
    each = stand(s.h, [s.a, s.b]);
  run(s.h, 0.2, each);
  strike(s.a, s.boss, 1);
  run(s.h, 0.2, each);
  s.boss.heed = {};
  s.boss.heedAt = -Infinity;
  s.boss.tg = s.a.pid;
  return { ...s, each };
}
// Ticks until the Warden's target is pid, for at most sec seconds; returns
// the seconds it took, or -1.
function untilTarget(h, boss, pid, sec, each) {
  let n = 0,
    got = false;
  run(h, sec, (i) => {
    each();
    if (boss.tg === pid) {
      got = true;
      n = i;
      return false;
    }
  });
  return got ? n / 60 : -1;
}

check("it turns on the player who has hurt it more", () => {
  const { h, a, b, boss, each } = attend();
  assert.equal(boss.tg, a.pid);
  for (let i = 0; i < 6; i++) {
    strike(b, boss, 10);
    run(h, 10 / 60, each);
  }
  assert.ok(boss.heed[b.pid] > 50, "score " + boss.heed[b.pid]);
  assert.equal(boss.heed[a.pid] || 0, 0);
  const t = untilTarget(h, boss, b.pid, 2.5, each);
  assert.ok(t >= 0, "still hunting " + boss.tg);
});
check("it does not turn back inside three seconds", () => {
  const { h, a, b, boss, each } = attend();
  // the tick it first turns on b, wherever in this it happens
  let at = -1;
  const watch = () => {
    each();
    if (at < 0 && boss.tg === b.pid) at = h.S.step;
  };
  for (let i = 0; i < 6; i++) {
    strike(b, boss, 10);
    run(h, 10 / 60, watch);
  }
  run(h, 3.5 - 1, (i) => {
    watch();
    if (at >= 0) return false;
  });
  assert.ok(at >= 0, "it did not turn on b");
  strike(a, boss, 200);
  run(h, at / 60 + 2.5 - h.S.step / 60, watch);
  assert.equal(boss.tg, b.pid, "turned back at " + (h.S.step - at) / 60);
  run(h, 1.5, watch);
  assert.equal(boss.tg, a.pid, "not on a by 4 s");
});
check("it does not turn mid-swing", () => {
  const { h, a, b, boss, each } = attend(),
    atk = Object.values(boss.def.atks)[0],
    force = () => {
      each();
      boss.state = "wind";
      boss.atk = atk;
      boss.t = 0;
    };
  strike(b, boss, 100);
  run(h, 4, force);
  assert.equal(boss.tg, a.pid, "turned in a swing");
  assert.ok(boss.heed[b.pid] > 0);
  // free of it, the swing runs out and it turns: the target never changes
  // across a tick that starts in a swing
  let swing = 0,
    s0 = boss.state,
    t0 = boss.tg;
  run(h, 3, () => {
    each();
    if (s0 === "wind" || s0 === "act") {
      swing++;
      assert.equal(boss.tg, t0, "turned in a " + s0);
    }
    (s0 = boss.state), (t0 = boss.tg);
  });
  assert.ok(swing > 0, "no swing ran out");
  assert.equal(boss.tg, b.pid);
  // nor in act
  const two = attend();
  two.boss.state = "act";
  two.boss.atk = atk;
  two.boss.t = 0;
  two.boss.heed[two.b.pid] = 100;
  two.h.tick(1 / 60);
  assert.equal(two.boss.tg, two.a.pid);
});
check("a lead under 1.3 does not turn it", () => {
  const { h, a, b, boss, each } = attend();
  boss.heed[a.pid] = 100;
  boss.heed[b.pid] = 120;
  run(h, 3.5, each);
  assert.equal(boss.tg, a.pid);
  const two = attend();
  two.boss.heed[two.a.pid] = 100;
  two.boss.heed[two.b.pid] = 140;
  assert.ok(untilTarget(two.h, two.boss, two.b.pid, 2, two.each) >= 0, "a lead of 1.4 did not");
});
check("a score halves in four seconds", () => {
  const { h, a, b, boss, each } = attend(),
    hp0 = boss.hp;
  strike(b, boss, 80);
  const dealt = hp0 - boss.hp;
  assert.equal(dealt, 80);
  assert.ok(Math.abs(boss.heed[b.pid] - 80) < 1e-9);
  run(h, 4, each);
  const v = boss.heed[b.pid];
  assert.ok(v > 38 && v < 42, "score " + v);
});
check("a kill counts what was left and a score is cleared with the enemies", () => {
  const { h, a, b, boss, each } = attend();
  boss.hp = 30;
  strike(a, boss, 400);
  assert.equal(boss.dead, true);
  assert.ok(Math.abs(boss.heed[a.pid] - 30) < 1e-9, "score " + boss.heed[a.pid]);
  const two = attend();
  two.boss.heed[two.a.pid] = 50;
  two.h.S.px.get(1).state = "dead";
  two.a.at(0, 0, { state: "dead", hp: 0 });
  two.b.at(0, 0, { state: "dead", hp: 0 });
  run(two.h, 0.2);
  const again = warden(two.h);
  assert.notEqual(again, two.boss);
  assert.deepEqual(again.heed, {});
  assert.equal(again.heedAt, -Infinity);
});
check("with one player dead, away or outside it hunts the other whatever the scores", () => {
  for (const how of ["dead", "away", "outside"]) {
    const { h, a, b, boss, each } = attend(),
      bc = h.G.world.boss,
      qa = inChamber(h, 6, 0);
    boss.heed[b.pid] = 1000;
    boss.tg = b.pid;
    const keep = () => {
      a.at(qa.x, qa.z);
      if (how === "dead") b.at(bc.x, bc.z + 4, { state: "dead", hp: 0 });
      else if (how === "outside") b.at(bc.x + 60, bc.z, {});
    };
    run(h, 3.5, keep);
    assert.equal(boss.tg, a.pid, how);
  }
});
check("a husk still turns on whoever hit it", () => {
  const { h, a, b, boss } = duo(),
    w = h.G.world,
    e = h.G.enemies.find((o) => o.type === "husk" && !o.dead);
  assert.ok(e && !e.def.duo);
  const around = (d, a0) => {
    for (let i = 0; i < 72; i++) {
      const an = a0 + (i * Math.PI) / 36,
        x = e.x + Math.sin(an) * d,
        z = e.z + Math.cos(an) * d;
      if (w.fieldAt(x, z) > 0.6 && w.los(e.x, e.z, x, z)) return { x, z, an };
    }
    throw new Error("no spot");
  };
  const qa = around(4, 0),
    qb = around(6, qa.an + Math.PI),
    both = () => {
      a.at(qa.x, qa.z);
      b.at(qb.x, qb.z);
    };
  run(h, 1, both);
  assert.equal(e.aware, true, "the husk did not wake");
  assert.equal(e.tg, a.pid);
  strike(b, e, 5);
  assert.equal(e.tg, b.pid);
  assert.equal(e.heed, undefined);
});

done();
