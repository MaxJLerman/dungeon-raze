// The Sapper's cave-in: rock in the walkable field, and the cave-in in play.
// Run with: SCRIPT=$PWD/tests/t20.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.

// a corridor 21 m long and 8 m wide along X, walls at z 0 and z 8
const field = (name, body) => ({
  name,
  eval: `(() => {
  const mk = () => { const F = new Float32Array(22 * 9);
    for (let j = 0; j <= 8; j++) for (let i = 0; i <= 21; i++) F[j * 22 + i] = j === 0 || j === 8 ? -1 : Math.min(j, 8 - j) - 0.5;
    return DF.fieldFns(F, 0, 0, 21, 8); };
  ${body} })()`,
});

// the Sapper in cave 99, with helpers to find a tunnel and place bodies
const game = (name, body) => ({
  name,
  eval: `(() => { DF.setClass("sapper"); DF.newRun(99); const { G, cam } = DF; G.manual = true; DF.show("play"); G.state = "play";
  const w = G.world, p = G.player, D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const put = (o, q) => { o.x = q.x; o.z = q.z; w.resolve(o, o.r || 0.6); cam.px = p.x; cam.pz = p.z; };
  const len = (R) => { let l = 0, a = R[0]; for (const b of R) { l += D(a, b); a = b; } return l; };
  // the point d metres along the tunnel's route from its middle
  const at = (t, d) => { const R = t.R; let i = t.i, left = Math.abs(d), s = Math.sign(d) || 1, a = R[i];
    while (left > 0) { const j = i + s; if (j < 0 || j >= R.length) break; const b = R[j], l = D(a, b);
      if (l >= left) return { x: a.x + (b.x - a.x) * left / l, z: a.z + (b.z - a.z) * left / l }; left -= l; a = b; i = j; }
    return { x: a.x, z: a.z }; };
  // the width of the walkable cross-section at q, across yaw
  const width = (q, yaw) => { let n = 0; for (const sg of [-1, 1]) { let d = 0; while (d < 12 && w.fieldAt(q.x - Math.cos(yaw) * d * sg, q.z + Math.sin(yaw) * d * sg) > 0) d += 0.25; n += d; } return n; };
  // a point in a tunnel on the way to the boss: 5 to 10 m wide, 12 m from either room
  const tunnel = () => { for (let k = 0; k + 1 < w.path.length; k++) { const a = w.nodes[w.path[k]], b = w.nodes[w.path[k + 1]];
      const r = w.route(a.x, a.z, b.x, b.z, 0.6); if (!r) continue; const R = [{ x: a.x, z: a.z }];
      for (const q of r) { const l = D(R[R.length - 1], q), n = Math.ceil(l / 0.5); const o = R[R.length - 1];
        for (let i = 1; i <= n; i++) R.push({ x: o.x + (q.x - o.x) * i / n, z: o.z + (q.z - o.z) * i / n }); }
      for (let i = 20; i < R.length - 20; i++) { const yaw = Math.atan2(R[i + 1].x - R[i - 1].x, R[i + 1].z - R[i - 1].z), wd = width(R[i], yaw);
        if (D(R[i], a) < 12 || D(R[i], b) < 12 || wd < 5 || wd > 10) continue;
        // straight enough to see 6 m each way, so a sealed line of sight means something
        const t = { x: R[i].x, z: R[i].z, yaw, R, i, wd }, A = at(t, -6), B = at(t, 6); if (w.los(A.x, A.z, B.x, B.z)) return t; } }
    return null; };
  // the enemy of that type nearest to q moved there and left idle
  const spawnAt = (type, q) => { const e = G.enemies.filter((e) => !e.dead && (type === "warden" ? e.def.boss : e.type === type))
      .sort((a, b) => D(a, q) - D(b, q))[0]; put(e, q); e.hx = e.x; e.hz = e.z; e.state = "idle"; e.aware = false; e.route = null; return e; };
  ${body} })()`,
});

export default [
  field("a rock across a corridor blocks route and sight, and comes out again", `
  const f = mk(), before = f.route(3, 4, 18, 4, 0.5), see0 = f.los(3, 4, 18, 4);
  const id = f.addRock(10, -1, 10, 9, 1);
  const c = { pre: !!before && see0, routeCut: f.route(3, 4, 18, 4, 0.5) === null, sightCut: !f.los(3, 4, 18, 4),
    rock: f.fieldAt(10, 4) < -0.5, near: Math.abs(f.fieldAt(12.5, 4) - 1.5) < 0.2 };
  f.removeRock(id);
  c.back = !!f.route(3, 4, 18, 4, 0.5) && f.los(3, 4, 18, 4) && Math.abs(f.fieldAt(10, 4) - 3.5) < 0.01;
  return { pass: Object.values(c).every(Boolean), c };`),
  field("overlapping rocks: taking one out leaves the other", `
  const f = mk(), a = f.addRock(10, -1, 10, 9, 1), b = f.addRock(11, -1, 11, 9, 1); f.removeRock(a);
  const c = { still: f.fieldAt(11, 4) < -0.5, cut: f.route(3, 4, 18, 4, 0.5) === null };
  f.clearRocks(); c.clear = Math.abs(f.fieldAt(11, 4) - 3.5) < 0.01 && Math.abs(f.fieldAt(10, 4) - 3.5) < 0.01;
  f.removeRock(999);
  return { pass: Object.values(c).every(Boolean), c };`),
  field("resolve pushes a body out of a rock", `
  const f = mk(); f.addRock(10, -1, 10, 9, 1); const o = { x: 10.6, z: 4 };
  for (let i = 0; i < 4; i++) f.resolve(o, 0.6);
  return { pass: f.fieldAt(o.x, o.z) >= 0.59 && o.x > 10, o };`),
  field("the cave and the hall have rock calls", `
  const w = DF.G.world, h = DF.genHub();
  const ok = (x) => ["addRock", "removeRock", "clearRocks"].every((k) => typeof x[k] === "function");
  return { pass: ok(w) && ok(h) };`),
  game("the ability throws a cave-in where the camera points", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; p.focus = 100; DF.taps[DF.BIND.special] = true; DF.sim(0.1);
  const c = G.caveins[0], ok = !!c && p.focus <= 51 && D(c, p) <= DF.CAVEIN.range && w.fieldAt(c.x, c.z) > 0.3;
  return { pass: ok, n: G.caveins.length, focus: p.focus, d: c && D(c, p) };`),
  game("a cave-in seals a tunnel and crumbles", `
  const t = tunnel(), A = at(t, -6), B = at(t, 6); put(p, A); p.yaw = cam.yaw = t.yaw;
  const r0 = !!w.route(A.x, A.z, B.x, B.z, 0.6), s0 = w.los(A.x, A.z, B.x, B.z); DF.startCaveIn(t.x, t.z); DF.sim(1.2);
  const cut = w.route(A.x, A.z, B.x, B.z, 0.6), sight = w.los(A.x, A.z, B.x, B.z);
  DF.sim(DF.CAVEIN.life + 0.2);
  const c = { sealed: cut === null || len([A, ...cut]) > 30, blind: !sight, gone: G.caveins.length === 0,
    route: !!w.route(A.x, A.z, B.x, B.z, 0.6) === r0, sight: w.los(A.x, A.z, B.x, B.z) === s0 };
  return { pass: Object.values(c).every(Boolean), c, wd: t.wd, r0, s0 };`),
  game("the crush staggers, a brute for less, the boss not at all", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; const h = spawnAt("husk", at(t, 0.4)), b = spawnAt("brute", at(t, -0.4)), s = spawnAt("spit", t);
  DF.startCaveIn(t.x, t.z); DF.sim(1);
  const c = { husk: h.dead || (h.state === "stagger" && h.dur === 3), brute: b.state === "stagger" && Math.abs(b.dur - 2.25) < 0.01,
    spit: s.dead || s.state === "stagger" };
  DF.sim(DF.CAVEIN.life + 0.5); const boss = spawnAt("warden", t); DF.startCaveIn(t.x, t.z); DF.sim(1);
  c.boss = boss.state !== "stagger";
  return { pass: Object.values(c).every(Boolean), c, bstate: b.state, bdur: b.dur, boss: boss.state };`),
  game("nobody ends inside rock, and the Sapper takes no harm", `
  const t = tunnel(); put(p, t); p.yaw = cam.yaw = t.yaw; p.iframe = 0; const hp0 = p.hp, e = spawnAt("brute", at(t, 0.3)); let worst = 9;
  DF.startCaveIn(t.x, t.z); DF.sim(1.5, () => { worst = Math.min(worst, w.fieldAt(p.x, p.z), w.fieldAt(e.x, e.z)); });
  return { pass: worst >= 0 && p.hp === hp0, worst, lost: hp0 - p.hp };`),
  game("a point-blank throw puts the Sapper on its own side", `
  const t = tunnel(); put(p, at(t, -0.02)); p.yaw = cam.yaw = t.yaw; DF.startCaveIn(t.x, t.z); DF.sim(1.2);
  const side = (p.x - t.x) * Math.sin(t.yaw) + (p.z - t.z) * Math.cos(t.yaw);
  return { pass: side < 0 && w.fieldAt(p.x, p.z) >= 0.5, side };`),
  game("an enemy routing through never stands in rock", `
  const t = tunnel(), A = at(t, -9), B = at(t, 9); put(p, B); const e = spawnAt("husk", A); DF.alertE(e, true);
  let worst = 9; DF.sim(0.5); DF.startCaveIn(t.x, t.z); DF.sim(6, () => { p.hp = p.maxHp; worst = Math.min(worst, w.fieldAt(e.x, e.z)); });
  return { pass: worst >= 0, worst, state: e.state };`),
  game("overlapping cave-ins and a respawn leave no hidden rock", `
  const t = tunnel(), q = at(t, 1); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; DF.startCaveIn(t.x, t.z); DF.sim(4); DF.startCaveIn(q.x, q.z); DF.sim(1);
  DF.sim(DF.CAVEIN.life - 3.5); const still = w.fieldAt(q.x, q.z) < 0, one = G.caveins.length === 1;
  DF.respawn(); const f0 = w.fieldAt(q.x, q.z), clean = G.caveins.length === 0 && f0 > 0.5;
  return { pass: still && one && clean, still, one, clean, f0 };`),
  game("a shot stops at rubble", `
  const t = tunnel(), A = at(t, -6); put(p, A); p.yaw = cam.yaw = t.yaw; DF.startCaveIn(t.x, t.z); DF.sim(1.2);
  const a = Math.atan2(t.x - A.x, t.z - A.z);
  G.projs.push({ x: A.x, y: 1.2, z: A.z, vx: Math.sin(a) * 30, vz: Math.cos(a) * 30, life: 1, own: "p", dmg: 1, post: 0, kind: "bullet", c: [1, 1, 1], aoe: 0, rad: 0 });
  const pr = G.projs[G.projs.length - 1]; let far = -9; DF.sim(0.6, () => { far = Math.max(far, (pr.x - t.x) * Math.sin(t.yaw) + (pr.z - t.z) * Math.cos(t.yaw)); });
  return { pass: far < DF.CAVEIN.thick, far };`),
  game("the dummy stays pinned in the rubble", `
  DF.enterHub(); const W = G.world, d = G.enemies.find((e) => e.def.dummy); p.x = d.x - 4; p.z = d.z; p.yaw = Math.PI / 2;
  DF.startCaveIn(d.x, d.z); DF.sim(1.5);
  return { pass: d.x === d.hx && d.z === d.hz && W.fieldAt(p.x, p.z) >= 0 && W.fieldAt(d.x, d.z) < 0 };`),
  game("a mine under the rubble goes off", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; DF.plantMine(t.x, t.z); const far = at(t, -4); DF.plantMine(far.x, far.z);
  DF.startCaveIn(t.x, t.z); DF.sim(1.1);
  return { pass: G.mines.length === 1 && Math.hypot(G.mines[0].x - far.x, G.mines[0].z - far.z) < 0.01, left: G.mines.length };`),
  game("a mine under the rubble sets off a mine beside it", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; DF.plantMine(t.x, t.z); const near = at(t, -2.4); DF.plantMine(near.x, near.z);
  DF.sim(1); DF.startCaveIn(t.x, t.z); DF.sim(1.3);
  return { pass: G.mines.length === 0, left: G.mines.length };`),
  game("brute filled by the crush keeps the full stagger", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; const b = spawnAt("brute", at(t, 0.3)); b.posture = b.def.posture - 5;
  DF.startCaveIn(t.x, t.z); DF.sim(0.95);
  return { pass: b.state === "stagger" && Math.abs(b.dur - 3) < 0.01, state: b.state, dur: b.dur };`),
  game("no more than three cave-ins stand at once", `
  DF.enterHub(); const W = G.world; p.x = 0; p.z = -12; p.yaw = 0; const spots = [-8, -4, 0, 4];
  for (const z of spots) { DF.startCaveIn(-6, z); DF.sim(1); }
  const n = G.caveins.length, first = W.fieldAt(-6, -8) > 0.5, last = W.fieldAt(-6, 4) < 0;
  return { pass: n === DF.CAVEIN.cap && first && last, n, first, last };`),
  game("the dummy stays pinned when the ridge passes off its centre", `
  DF.enterHub(); const d = G.enemies.find((e) => e.def.dummy); p.x = d.x - 4; p.z = d.z + 0.5; p.yaw = Math.PI / 2;
  DF.startCaveIn(d.x, d.z + 0.5); DF.sim(1.5);
  return { pass: Math.hypot(d.x - d.hx, d.z - d.hz) < 0.01, off: [d.x - d.hx, d.z - d.hz] };`),
];
