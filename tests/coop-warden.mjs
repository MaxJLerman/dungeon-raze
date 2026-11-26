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

// The grab (WARDEN2.seize): from phase 3 the Warden seizes one player and
// only the other can break the hold (docs/notes/coop.md).
// A duo at phase 3 with its roar over, both players in the chamber. The
// Warden is put in the act of its seize, facing a, which stands d metres in
// front of it; b stands 6 m from the centre on the other side. keep(extra)
// sends a's state (extra over it, "held" by default) and b's, as pages do:
// pass it to run so neither goes away.
function seizeOn(d = 3, s = duo()) {
  const { h, a, b } = s,
    boss = warden(h),
    each = stand(h, [a, b]);
  run(h, 0.2, each);
  assert.equal(h.phase(3), boss);
  run(h, 1.4, each);
  assert.notEqual(boss.state, "roar");
  const qa = { x: boss.x + Math.sin(boss.yaw) * d, z: boss.z + Math.cos(boss.yaw) * d },
    qb = inChamber(h, 6, Math.atan2(boss.x - qa.x, boss.z - qa.z));
  // extra null: a's page sends nothing
  const keep = (extra = { state: "held" }) => {
    if (extra) a.at(qa.x, qa.z, extra);
    b.at(qb.x, qb.z);
  };
  keep({});
  Object.assign(boss, { state: "act", atk: boss.def.atks.seize, t: 0, an: (boss.an + 1) & 255, hitDone: false });
  return { ...s, boss, keep, qa, qb };
}
// a's page reports that the seize landed on it
const seized = (c, boss, an = boss.an) => c.ev("seized", boss.id, an);
// Ticks until the Warden leaves "hold", for at most sec seconds; returns
// the seconds it took, or -1.
function untilFree(h, boss, sec, each) {
  let n = -1;
  run(h, sec, (i) => {
    if (each) each(i);
    if (boss.state !== "hold") {
      n = i;
      return false;
    }
  });
  return n < 0 ? -1 : n / 60;
}

check("the seize is the definition's last attack, and the solo Warden has none", () => {
  const { h, boss } = duo(),
    a = boss.def.atks.seize,
    keys = Object.keys(boss.def.atks);
  assert.equal(keys[keys.length - 1], "seize");
  assert.deepEqual(a, {
    style: "seize", kind: "seize", unb: true, from: 3, trig: 5, wind: 0.9, act: 0.25,
    rec: 0.9, reach: 4.6, arc: 1.2, dmg: 0,
  });
  assert.equal(h.EDEF.warden.atks.seize, undefined);
});
check("it does not seize before phase 3", () => {
  const { h, boss } = duo(),
    draw = () => {
      let n = 0;
      for (let i = 0; i < 300; i++) if (h.chooseAtk(boss, 3, null) === boss.def.atks.seize) n++;
      return n;
    };
  assert.equal(draw(), 0, "phase 1");
  h.phase(2);
  assert.equal(draw(), 0, "phase 2");
  h.phase(3);
  assert.ok(draw() > 0, "never at phase 3");
});
check("a seize the page reports is accepted", () => {
  const { a, b, boss } = seizeOn();
  seized(a, boss);
  assert.equal(boss.state, "hold");
  assert.equal(boss.held, a.pid);
  assert.equal(boss.t, 0);
  assert.equal(boss.holdDmg, 0);
  for (const c of [a, b]) {
    const ev = named(c, "held");
    assert.equal(ev.length, 1, "client " + c.pid + " got " + ev.length);
    assert.equal(ev[0][1], boss.id);
    assert.equal(ev[0][2], a.pid);
    assert.equal(typeof ev[0][3], "number");
  }
  // in the first 0.6 s of its recovery too
  const late = seizeOn();
  late.boss.state = "rec";
  late.boss.t = 0.55;
  seized(late.a, late.boss);
  assert.equal(late.boss.state, "hold");
});
check("a seize is refused", () => {
  const no = (s, why) => {
    assert.notEqual(s.boss.state, "hold", why);
    assert.equal(named(s.a, "held").length, 0, why);
  };
  const far = seizeOn(9);
  seized(far.a, far.boss);
  no(far, "from 9 m");
  const an = seizeOn();
  seized(an.a, an.boss, (an.boss.an + 1) & 255);
  no(an, "another swing");
  const sweep = seizeOn();
  sweep.boss.atk = sweep.boss.def.atks.c1;
  seized(sweep.a, sweep.boss);
  no(sweep, "a sweep");
  const late = seizeOn();
  late.boss.state = "rec";
  late.boss.t = 0.7;
  seized(late.a, late.boss);
  no(late, "0.7 s into its recovery");
  // a cave for one's Warden, in the act of a seize it does not have
  const one = solo(),
    sb = one.boss,
    each = stand(one.h, [one.a]);
  run(one.h, 0.2, each);
  one.a.at(sb.x + Math.sin(sb.yaw) * 3, sb.z + Math.cos(sb.yaw) * 3);
  Object.assign(sb, { state: "act", atk: duo().boss.def.atks.seize, t: 0, an: (sb.an + 1) & 255 });
  seized(one.a, sb);
  no({ ...one, boss: sb }, "a cave for one");
  // one that already holds
  const two = seizeOn();
  seized(two.a, two.boss);
  two.b.at(two.qa.x, two.qa.z);
  seized(two.b, two.boss);
  assert.equal(two.boss.held, two.a.pid);
  assert.equal(named(two.b, "held").length, 1);
});
check("80 damage from the other player breaks it", () => {
  const { h, a, b, boss, keep } = seizeOn();
  seized(a, boss);
  run(h, 0.5, () => keep());
  strike(b, boss, 40);
  strike(b, boss, 39);
  assert.equal(boss.state, "hold");
  assert.equal(boss.holdDmg, 79);
  assert.equal(named(a, "freed").length, 0);
  strike(b, boss, 1);
  assert.equal(boss.state, "stagger");
  assert.equal(boss.dur, 2);
  assert.equal(boss.held, 0);
  for (const c of [a, b]) {
    const ev = named(c, "freed");
    assert.equal(ev.length, 1, "client " + c.pid + " got " + ev.length);
    assert.equal(ev[0][1], boss.id);
    assert.equal(ev[0][2], a.pid);
    assert.equal(typeof ev[0][3], "number");
  }
  run(h, 1.9, () => keep({}));
  assert.equal(boss.state, "stagger", "over before 2 s");
  run(h, 0.2, () => keep({}));
  assert.notEqual(boss.state, "stagger", "still staggered at 2.1 s");
  assert.equal(named(a, "crush").length, 0);
});
check("the held player's own hits do not count", () => {
  const { h, a, boss, keep } = seizeOn();
  seized(a, boss);
  run(h, 0.2, () => keep());
  strike(a, boss, 100);
  assert.equal(boss.state, "hold");
  assert.equal(boss.holdDmg, 0);
});
check("a posture break while it holds counts as broken", () => {
  const { h, a, b, boss, keep } = seizeOn();
  seized(a, boss);
  run(h, 0.2, () => keep());
  b.ev("hit", boss.id, 5, 250, 0, "melee", null, null, boss.state, boss.an);
  assert.equal(boss.state, "stagger");
  assert.equal(boss.dur, 2);
  assert.equal(named(a, "freed").length, 1);
  assert.equal(named(b, "freed").length, 1);
});
check("unbroken, it crushes at four seconds", () => {
  const { h, a, b, boss, keep } = seizeOn();
  seized(a, boss);
  let at = -1;
  run(h, 4.5, (i) => {
    if (named(a, "crush").length) {
      at = i / 60;
      return false;
    }
    keep();
  });
  assert.ok(at >= 3.9 && at <= 4.1, "crushed at " + at);
  assert.equal(boss.state, "rec");
  for (const c of [a, b]) {
    const ev = named(c, "crush");
    assert.equal(ev.length, 1, "client " + c.pid + " got " + ev.length);
    assert.equal(ev[0][1], boss.id);
    assert.equal(ev[0][2], a.pid);
    assert.equal(typeof ev[0][3], "number");
  }
  assert.equal(boss.held, 0);
  assert.equal(named(a, "freed").length, 0);
});
check("it lets go when the held player dies, goes away, or is no longer held", () => {
  for (const how of ["dead", "away", "free", "never"]) {
    const { h, a, boss, keep } = seizeOn();
    seized(a, boss);
    let n = 0;
    // held for 0.3 s, then dead, quiet (away 2 s later), free again; or
    // never seen held at all
    const after = { dead: { state: "dead", hp: 0 }, away: null, free: {} }[how];
    const each = () => {
      const t = n++ / 60;
      keep(how === "never" ? {} : t < 0.3 ? { state: "held" } : after);
    };
    if (how === "never") {
      // not yet seen held, it holds for half a second
      run(h, 0.4, each);
      assert.equal(boss.state, "hold", "let go before 0.5 s");
    }
    const took = untilFree(h, boss, 3.8, each);
    assert.ok(took >= 0, how + ": still holding");
    assert.equal(boss.held, 0, how);
    assert.equal(named(a, "crush").length, 0, how + ": crushed");
    assert.equal(named(a, "freed").length, 0, how + ": freed");
    assert.ok(boss.seizeT > 13.5, how + ": seizeT " + boss.seizeT);
  }
});
check("it does not seize again for 14 seconds", () => {
  const { h, a, boss, keep } = seizeOn();
  seized(a, boss);
  run(h, 4.5, () => {
    keep();
    if (named(a, "crush").length) return false;
  });
  assert.ok(boss.seizeT > 13.9 && boss.seizeT <= 14, "seizeT " + boss.seizeT);
  for (let i = 0; i < 300; i++) assert.notEqual(h.chooseAtk(boss, 3, null), boss.def.atks.seize);
  let wound = 0;
  run(h, 13.8, () => {
    keep({});
    if (boss.state === "wind" && boss.atk && boss.atk.kind === "seize") wound++;
  });
  assert.equal(wound, 0, "seized again");
  assert.ok(boss.seizeT > 0, "seizeT " + boss.seizeT);
  run(h, 0.3, () => keep({}));
  assert.equal(boss.seizeT, 0);
  // the wind-up's end starts the count too, landed or not
  const s = seizeOn();
  Object.assign(s.boss, { state: "wind", t: 0 });
  run(s.h, 1, () => {
    s.keep({});
    if (s.boss.state !== "wind") return false;
  });
  assert.equal(s.boss.state, "act");
  assert.ok(s.boss.seizeT > 13.9, "seizeT " + s.boss.seizeT);
});

done();
