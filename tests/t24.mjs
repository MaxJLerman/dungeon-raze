// D enemies batch 2: shared support for bound types (water, wall), hidden and safe enemies, ambush types.
// Run with: SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke
// Test types (__w, __b, __a) are registered inside each step and deleted at its end.
const TYPES = `const dropTypes = () => { for (const k of ["__w", "__b", "__a"]) { delete DF.EDEF[k]; delete DF.EBEH[k]; } };`;
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; ${TYPES} try { ${body} } finally { dropTypes(); } })()`,
});
// a real sewer pool (D, seed 5): a bound enemy "__w" at the deepest point of the largest pool, and
// `P`, dry floor three metres past the shore along the nearest heading with such a spot
const pool = (name, body, cls = "fighter", T = "__w") =>
  step(name, `DF.setClass("${cls}"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
  const p = G.player, w = G.world; G.enemies = []; G.projs = [];
  if ("${T}" === "__w") { DF.EDEF.__w = { ...DF.EDEF.rat, bound: "water", hp: 9999 }; DF.EBEH.__w = { foot: DF.waterFoot }; }
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  const big = w.bodies.filter((b) => w.nodes[b.room] && w.nodes[b.room].kind === "pool").sort((a, b) => b.n - a.n)[0];
  if (!big) return { pass: false, why: "no pool body" };
  let at = null, bd = -1;
  for (let x = big.x - 25; x <= big.x + 25; x += 0.5) for (let z = big.z - 25; z <= big.z + 25; z += 0.5) {
    if (w.waterAt(x, z) !== 1 || w.bodyAt(x, z) !== big.id || w.fieldAt(x, z) < 1) continue;
    let m = 99; for (let k = 0; k < 8; k++) { let d = 0; while (d < 12 && w.waterAt(x + Math.sin(k * 0.785) * d, z + Math.cos(k * 0.785) * d) >= 0.5) d += 0.5; m = Math.min(m, d); }
    if (m > bd) { bd = m; at = { x, z }; } }
  if (!at) return { pass: false, why: "no deep point" };
  const e = DF.makeEnemy({ type: "${T}", x: at.x, z: at.z, yaw: 0, node: -1 }); e.hx = e.x; e.hz = e.z; G.enemies.push(e);
  // the shore along the nearest heading with open dry floor three metres past it, in sight
  let sh = null;
  for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a); let s = 0;
    while (s < 30 && w.waterAt(e.x + sx * s, e.z + sz * s) >= 0.5) s += 0.25;
    const P = { x: e.x + sx * (s + 3), z: e.z + sz * (s + 3) };
    if (w.waterAt(P.x, P.z) === 0 && w.fieldAt(P.x, P.z) >= 1 && w.los(e.x, e.z, P.x, P.z) && (!sh || s < sh.s)) sh = { a, s, P }; }
  if (!sh) return { pass: false, why: "no dry spot past the shore" };
  p.x = sh.P.x; p.z = sh.P.z; cam.px = p.x; cam.pz = p.z;
  const D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), foot = () => DF.waterFoot(e, e.x, e.z);
  ${body}`);
// cave 99 with the class set, one helper to place a type of enemy d metres from the player, in front of it
const cls = (name, id, body) =>
  step(name, `DF.setClass("${id}"); DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world;
  DF.EDEF.__b = { ...DF.EDEF.husk, bound: "water" };
  const K = (a) => { DF.taps[DF.BIND[a]] = true; };
  const h0 = G.enemies.find((q) => q.type === "husk");
  const mk = (type, dist) => { const e = DF.makeEnemy({ type, x: h0.x, z: h0.z, yaw: h0.yaw, node: -1 });
    G.enemies = [e]; G.projs = []; e.state = "idle"; const a = e.yaw; p.x = e.x + Math.sin(a) * dist; p.z = e.z + Math.cos(a) * dist; w.resolve(p, 0.6);
    p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw; cam.px = p.x; cam.pz = p.z; p.state = "free"; p.hp = p.maxHp; return e; };
  ${body}`);
// a husk or rat on an open cave 99 spot dist metres from the player, other enemies gone
const field = (name, body) =>
  step(name, `DF.setClass("fighter"); DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world; G.enemies = [];
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  const spot = (dist, from = 0, min = 1) => { for (let a = from; a < from + 6.3; a += 0.3) { const x = p.x + Math.sin(a) * dist, z = p.z + Math.cos(a) * dist;
    if (w.fieldAt(x, z) >= min && w.los(p.x, p.z, x, z)) return { x, z, a }; } return null; };
  ${body}`);
// the push checks of "a water-bound body stays in its own pool", shared with the bloater
const STAYS = `
    const out = {}, a = sh.a;
    out.start = foot();
    DF.eStep(e, Math.sin(a), Math.cos(a), 10, 1); out.step = foot();
    // taken to the shore and a little over it: the step that would leave the water is refused
    e.x = at.x; e.z = at.z; DF.eStep(e, Math.sin(a), Math.cos(a), 1, sh.s * 2); out.over = foot();
    e.x = at.x; e.z = at.z; e.okx = e.x; e.okz = e.z; e.kx = 40 * Math.sin(a); e.kz = 40 * Math.cos(a); DF.sim(0.3, keep); out.kick = foot();
    e.x = at.x; e.z = at.z; e.okx = e.x; e.okz = e.z; e.kx = 40; e.kz = 0; DF.sim(0.3, keep); out.kickX = foot();
    // a second enemy pushed into it
    for (const first of [true, false]) {
      e.x = at.x; e.z = at.z; e.okx = e.x; e.okz = e.z; e.kx = e.kz = 0;
      const o = DF.makeEnemy({ type: "husk", x: e.x + Math.sin(sh.a) * 0.5, z: e.z + Math.cos(sh.a) * 0.5, yaw: 0, node: -1 });
      G.enemies = first ? [e, o] : [o, e]; const x0 = e.x, z0 = e.z; DF.separate(); const moved = D(e, { x: x0, z: z0 });
      DF.sim(1 / 60, keep); out["push" + first] = foot() && moved < 0.01; out["moved" + first] = moved; }
    // the player is shoved with weight 1: the enemy keeps its place
    G.enemies = [e]; e.x = at.x; e.z = at.z; p.x = e.x + 0.3; p.z = e.z; p.state = "free"; const p0 = D(p, e); DF.separate();
    out.player = D(e, at) < 0.01 && D(p, e) >= e.r + p.r - 0.01 && D(p, e) > p0;
    return { pass: out.start && out.step && out.over && out.kick && out.kickX && out.pushtrue && out.pushfalse && out.player, out, shore: sh.s, deep: bd };`;
// the eel's pool: B is another body of the same room; spotA(d) and spotB(d) are free water points of the two bodies,
// the nearest to d metres from the eel (from the middle of B), 0.9 m or more from the ones already taken
const EELSET = `
  const B = w.bodies.find((q) => q.room === big.room && q.id !== big.id);
  if (!B) return { pass: false, why: "no second body" };
  const taken = [], mkr = (type, s) => { const q = DF.makeEnemy({ type, x: s.x, z: s.z, yaw: 0, node: -1 }); q.hx = q.x; q.hz = q.z; return q; };
  const spot = (b, ox, oz, d) => { let best = null, bs = 1e9;
    for (let x = b.x - 25; x <= b.x + 25; x += 0.5) for (let z = b.z - 25; z <= b.z + 25; z += 0.5) {
      if (w.waterAt(x, z) !== 1 || w.bodyAt(x, z) !== b.id || w.fieldAt(x, z) < 1 || taken.some((q) => Math.hypot(q.x - x, q.z - z) < 0.9)) continue;
      const s = Math.abs(Math.hypot(x - ox, z - oz) - d); if (s < bs) { bs = s; best = { x, z }; } }
    if (best) taken.push(best); return best; };
  const spotA = (d) => spot(big, e.x, e.z, d), spotB = (d) => spot(B, B.x, B.z, d);
  const aggro = (q) => { DF.alertE(q, true); q.aware = true; q.state = "chase"; };
`;
// the player 2.5 m short of the bloater at `at` and to its right, the camera behind the player looking down on both
const SHOTCAM = `const a = 2.4, fx = Math.sin(a), fz = Math.cos(a), rx = -fz, rz = fx; cam.yaw = a; cam.pitch = 0.5;
    p.x = at.x - fx * 2.5 + rx * 1.4; p.z = at.z - fz * 2.5 + rz * 1.4; w.resolve(p, 0.6); p.yaw = a; p.state = "free"; cam.px = p.x; cam.pz = p.z; DF.sim(0.3);`;
const draw = `const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`;

// cave 99, the Fighter, a husk (set to state "hold" by hand) as the holder; `mk(dx)` stands the player dx metres in front of it
const hold = (name, body) =>
  step(name, `DF.setClass("fighter"); DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world; G.projs = [];
  const h0 = G.enemies.find((q) => q.type === "husk");
  const mk = (dx = 2) => { const e = DF.makeEnemy({ type: "husk", x: h0.x, z: h0.z, yaw: h0.yaw, node: -1 }); G.enemies = [e]; e.state = "idle";
    p.x = e.x + Math.sin(e.yaw) * dx; p.z = e.z + Math.cos(e.yaw) * dx; w.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.px = p.x; cam.pz = p.z;
    p.state = "free"; p.hp = p.maxHp; p.stam = p.maxStam; p.iframe = 0; p.kx = p.kz = 0; G.grabGrace = 0; return e; };
  const grab = (e, o) => { e.state = "hold"; return DF.grabPlayer(e, { dps: 0, tx: p.x, tz: p.z, speed: 0, ...o }); };
  ${body}`);

export default [
  // ---- the helpers themselves ----
  step("bound is read from the definition, wallFoot holds the post", `
    const w = { ...DF.EDEF.husk, bound: "wall" };
    const a = { def: w }, b = { def: DF.EDEF.husk }, c = { hx: 3, hz: 4 };
    const c1 = { bound: DF.bound(a), plain: !DF.bound(b), boss: !DF.bound({ def: DF.EDEF.warden }),
      post: DF.wallFoot(c, 3, 4) === true, near: DF.wallFoot(c, 3.005, 4) === true, off: DF.wallFoot(c, 3.02, 4) === false && DF.wallFoot(c, 3, 3.98) === false };
    return { pass: Object.values(c1).every(Boolean) && typeof DF.waterGoal === "function" && typeof DF.waterFoot === "function", c1 };`),
  pool("a water-bound body stays in its own pool", STAYS),
  pool("a cave-in across its pool leaves it on water outside the rubble", `
    // thrown from the dry floor through the enemy
    DF.startCaveIn(e.x, e.z); DF.sim(2, keep);
    const c = { hit: e.hp < 9999, rubble: G.caveins.some((q) => q.phase === "stand"), foot: foot(), room: w.fieldAt(e.x, e.z) >= e.r, alive: !e.dead };
    return { pass: Object.values(c).every(Boolean), c, at: [e.x, e.z] };`, "sapper"),
  pool("keepFooting puts a body whose last spot is gone on the nearest footing", `
    // rock lands on the spot it stood on: the nearest point it can stand on is used, within 4 m
    e.x = at.x; e.z = at.z; DF.keepFooting(e);
    const id = w.addRock(at.x - 0.5, at.z, at.x + 0.5, at.z, 1.2); DF.keepFooting(e);
    const c = { moved: D(e, at) > 0.2, near: D(e, at) <= 4, foot: foot(), room: w.fieldAt(e.x, e.z) >= e.r, ok: D(e, { x: e.okx, z: e.okz }) < 0.001 };
    // nothing within 4 m: it stays put
    w.clearRocks(); e.x = 1e5; e.z = 1e5; const q = { x: e.x, z: e.z }; e.okx = 1e5; e.okz = 1e5; DF.keepFooting(e); c.stays = D(e, q) < 0.001;
    return { pass: Object.values(c).every(Boolean), c };`),
  // ---- the class tools treat a bound type like the boss ----
  cls("an Enforcer grapple pulls the player to a bound type", "enforcer", `
    const run = (type) => { const e = mk(type, 9); p.focus = 100; p.lock = e; const e0 = [e.x, e.z], p0 = [p.x, p.z]; let g = false, y = false;
      K("special"); DF.sim(0.8, () => { if (p.state === "grapple") g = true; if (e.yank) y = true; });
      return { g, y, e: Math.hypot(e.x - e0[0], e.z - e0[1]), p: Math.hypot(p.x - p0[0], p.z - p0[1]), yank: e.yank || null }; };
    const b = run("__b"), h = run("husk");
    const c = { pulled: b.g && b.p > 3, still: b.e < 0.5, noYank: !b.y && b.yank === null, control: h.y && !h.g && h.e > 3 };
    return { pass: Object.values(c).every(Boolean), c, b, h };`),
  cls("a Riftwalker execution leaves a bound type where it stands", "riftwalker", `
    const run = (type) => { const e = mk(type, 2); e.state = "stagger"; e.t = 0; e.dur = 3; const at = [e.x, e.z]; let top = 0, fell = false;
      DF.startExecute(e); DF.sim(1.6, () => { top = Math.max(top, e.y); if (e.state === "fall") fell = true; p.hp = p.maxHp; });
      return { dead: e.dead, top, fell, away: Math.hypot(e.x - at[0], e.z - at[1]) }; };
    const b = run("__b"), h = run("husk");
    const c = { dead: b.dead, flat: b.top < 0.05 && !b.fell, here: b.away < 0.01, control: h.dead && h.top > 1 };
    return { pass: Object.values(c).every(Boolean), c, b, h };`),
  cls("a Drop hole under a bound type does not take it", "riftwalker", `
    const run = (type) => { const e = mk(type, 6); let fell = false; DF.startDrop(e.x, e.z);
      DF.sim(DF.DROP.fuse + 0.4, () => { if (e.state === "fall") fell = true; p.hp = p.maxHp; }); return { fell, y: e.y, state: e.state }; };
    const b = run("__b"), h = run("husk");
    return { pass: !b.fell && h.fell, b, h };`),
  cls("a rift pair across a bound type leaves it on its side", "riftwalker", `
    const run = (type) => { const e = mk(type, 6), o = DF.makeEnemy({ type: "husk", x: e.x, z: e.z, yaw: 0, node: -1 });
      const A = { x: e.x, z: e.z + 0.5, yaw: 0, t: 0, life: 20, id: 901 }, B = { x: e.x + 12, z: e.z, yaw: 0, t: 0, life: 20, id: 902 };
      G.rifts = [A, B]; const at = [e.x, e.z]; G.enemies = [e];
      DF.riftBodies({ p: [p.x, p.z], e: new Map([[e, [e.x, e.z + 1.2]]]) }); G.rifts = []; return Math.hypot(e.x - at[0], e.z - at[1]); };
    const b = run("__b"), h = run("husk");
    return { pass: b < 0.01 && h > 5, b, h };`),
  cls("a Sapper execution kicks no bound type and the charge goes off on it", "sapper", `
    const run = (type) => { const e = mk(type, 2), a = Math.atan2(p.x - e.x, p.z - e.z), o = DF.makeEnemy({ type: "husk", x: e.x + Math.sin(a) * 1.2, z: e.z + Math.cos(a) * 1.2, yaw: 0, node: -1 });
      G.enemies = [e, o]; o.state = "idle"; const o0 = o.hp; e.state = "stagger"; e.t = 0; e.dur = 3; const at = [e.x, e.z]; let kick = false;
      DF.startExecute(e); DF.sim(1, () => { if (e.kick) kick = true; p.hp = p.maxHp; });
      return { dead: e.dead, kick, away: Math.hypot(e.x - at[0], e.z - at[1]), hurt: o0 - o.hp }; };
    const b = run("__b"), h = run("husk");
    return { pass: b.dead && !b.kick && b.away < 0.01 && b.hurt > 0 && h.dead && h.kick && h.away > 1, b, h };`),
  // ---- the goal hook and routes ----
  pool("a water-bound type waits at the edge nearest the player", `
    DF.EBEH.__w.goal = DF.waterGoal; DF.EBEH.__w.canAttack = () => false;
    DF.alertE(e, true); e.state = "chase";
    let mid = null; DF.sim(6, (i) => { keep(); if (i === 299) mid = { x: e.x, z: e.z }; });
    // the footing point nearest the player, found by a finer scan than the hook's
    let best = null, bdist = 1e9;
    for (let x = e.x - 14; x <= e.x + 14; x += 0.25) for (let z = e.z - 14; z <= e.z + 14; z += 0.25) if (DF.waterFoot(e, x, z)) { const d = Math.hypot(x - p.x, z - p.z); if (d < bdist) { bdist = d; best = { x, z }; } }
    const toP = Math.atan2(p.x - e.x, p.z - e.z);
    const c = { near: D(e, best) < 1, face: Math.abs(DF.angDiff(e.yaw, toP)) < 0.3, still: !!mid && D(e, mid) < 0.2, foot: foot(), left: D(e, at) > 1 };
    return { pass: Object.values(c).every(Boolean), c, off: D(e, best), yaw: DF.angDiff(e.yaw, toP), moved: mid && D(e, mid) };`),
  pool("a goal hook leaves the attack choice alone", `
    // the player is on the enemy: it winds up an attack at once even though it steers for its goal point
    DF.EBEH.__w.goal = () => ({ x: e.x + 0.1, z: e.z });
    p.x = e.x + 1.0; p.z = e.z; DF.alertE(e, true); e.state = "chase"; e.cd = 0; let wind = false;
    DF.sim(3, () => { keep(); if (e.state === "wind") wind = true; });
    return { pass: wind, wind };`),
  step("a footed type walks routes straight", `
    DF.newRun(99); DF.show("play"); G.state = "play";
    const W = 16, H = 12, F = new Float32Array(17 * 13);
    for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) F[j * 17 + i] = j !== 6 ? 2 : i === 3 ? 0.8 : i === 12 || i === 13 ? 2 : -1;
    const f = DF.fieldFns(F, 0, 0, W, H), real = G.world;
    DF.EDEF.__w = { ...DF.EDEF.husk, bound: "water", r: 0.9 }; DF.EBEH.__w = { foot: () => true };
    const run = (type) => { G.world = f; G.routeN = 0; const e = DF.makeEnemy({ type, x: 3, z: 2, yaw: 0, node: -1 }); e.r = 0.9; const ok = DF.setRoute(e, 3, 10); G.world = real; return { ok, n: e.route.length, e }; };
    const a = run("__w"), b = run("husk");
    const c = { footed: a.ok && a.n === 1 && a.e.route[0].x === 3 && a.e.route[0].z === 10, plain: b.ok && b.n > 1 };
    return { pass: Object.values(c).every(Boolean), c, a: a.n, b: b.n };`),
  // ---- hidden, safe and ambush ----
  {
    name: "hidden enemies cannot be hit, locked, aimed at or drawn",
    eval: `(async () => { const { G, cam } = DF; G.manual = true; DF.setClass("fighter"); DF.newRun(99); DF.show("play"); G.state = "play";
    const p = G.player, w = G.world; ${draw}
    G.enemies = []; let sp = null; for (let a = 0; a < 6.3 && !sp; a += 0.3) { const x = p.x + Math.sin(a) * 4, z = p.z + Math.cos(a) * 4; if (w.fieldAt(x, z) >= 1 && w.los(p.x, p.z, x, z)) sp = { x, z, a }; }
    if (!sp) return { pass: false, why: "no spot" };
    const e = DF.makeEnemy({ type: "husk", x: sp.x, z: sp.z, yaw: sp.a + Math.PI, node: -1 }); G.enemies.push(e); cam.yaw = sp.a; p.yaw = sp.a; cam.px = p.x; cam.pz = p.z;
    const hp = e.hp; await draw(); const c = { seen: e.vis === true, lockable: DF.pickLock() === e };
    e.hidden = true; DF.hitEnemy(e, 30, 10, { src: "melee" }); DF.explode(e.x, e.z, 5, 30, 10, DF.MAGENTA);
    c.hp = e.hp === hp && e.state === "idle" && !e.aware && e.posture === 0;
    c.noLock = DF.pickLock() === null; await draw(); c.noDraw = e.vis === false;
    e.hidden = false; e.safe = true; DF.hitEnemy(e, 30, 10, { src: "melee" }); c.safeHp = e.hp === hp && !e.aware && e.posture === 0 && e.flash === 0;
    c.safeLock = DF.pickLock() === e; await draw(); c.safeDraw = e.vis === true;
    e.safe = false; DF.hitEnemy(e, 30, 10, { src: "melee" }); c.back = e.hp < hp;
    return { pass: Object.values(c).every(Boolean), c }; })()`,
  },
  field("a hidden or safe enemy is skipped by the melee loop, shots, mines, the relock and separate", `
    const q = spot(1.6); if (!q) return { pass: false, why: "no spot" };
    const mk = () => { const e = DF.makeEnemy({ type: "husk", x: q.x, z: q.z, yaw: q.a + Math.PI, node: -1 }); G.enemies = [e]; return e; };
    const out = {};
    // a swing
    let e = mk(); e.hidden = true; p.yaw = q.a; p.state = "free"; DF.taps[DF.BIND.light] = true; DF.sim(0.6, keep); out.swing = e.hp === e.def.hp;
    // a shot
    e = mk(); e.hidden = true; G.projs.push({ x: q.x - Math.sin(q.a) * 1, y: 1, z: q.z - Math.cos(q.a) * 1, vx: Math.sin(q.a) * 20, vz: Math.cos(q.a) * 20, life: 0.5, own: "p", dmg: 9, post: 5, kind: "bolt", c: [1, 1, 1] });
    DF.sim(0.3, keep); out.shot = e.hp === e.def.hp; G.projs = [];
    // a mine
    e = mk(); e.hidden = true; const m = DF.plantMine(q.x, q.z); DF.sim(1.2, keep); out.mine = G.mines.includes(m); G.mines = [];
    // separate
    e = mk(); e.hidden = true; const o = DF.makeEnemy({ type: "husk", x: q.x + 0.3, z: q.z, yaw: 0, node: -1 }); const e0 = [e.x, e.z]; out.sep = true;
    for (const order of [[e, o], [o, e]]) { G.enemies = order; DF.separate(); if (e.x !== e0[0] || e.z !== e0[1]) out.sep = false; }
    return { pass: Object.values(out).every(Boolean), out };`),
  field("a hidden enemy is not the relock target and not a staggered execution", `
    const a = spot(3), b = spot(5, 1.5); if (!a || !b) return { pass: false, why: "no spots" };
    const e1 = DF.makeEnemy({ type: "husk", x: a.x, z: a.z, yaw: 0, node: -1 }), e2 = DF.makeEnemy({ type: "husk", x: b.x, z: b.z, yaw: 0, node: -1 });
    G.enemies = [e1, e2]; e1.aware = e2.aware = true; e1.hidden = true; p.lock = e2; DF.kill(e2);
    const c = { relock: p.lock === null };
    e1.state = "stagger"; e1.t = 0; e1.dur = 3; p.x = e1.x + 1; p.z = e1.z; p.state = "free"; p.yaw = Math.atan2(e1.x - p.x, e1.z - p.z); DF.taps[DF.BIND.light] = true; DF.sim(0.3, keep);
    c.noExec = p.state !== "execute" && !e1.dead;
    return { pass: Object.values(c).every(Boolean), c, state: p.state };`),
  field("ambush types take no part in packs", `
    DF.EDEF.__a = { ...DF.EDEF.rat, ambush: true };
    const near = spot(3), far = spot(9, 3.1); if (!near || !far) return { pass: false, why: "no spots" };
    // one hunting that sees the player and one idle, out of its own sight (facing away, beyond 3 m)
    const run = (callerType, idleType) => { G.enemies = [];
      const c = DF.makeEnemy({ type: callerType, x: near.x, z: near.z, yaw: near.a + Math.PI, node: -1 }), o = DF.makeEnemy({ type: idleType, x: far.x, z: far.z, yaw: far.a, node: -1 });
      G.enemies = [c, o]; c.hx = c.x; c.hz = c.z; o.hx = o.x; o.hz = o.z; c.aware = true; c.state = "chase"; c.lost = 0; c.lsx = p.x; c.lsz = p.z; c.lvx = c.lvz = 0;
      DF.sim(1, () => { keep(); c.cd = 9; }); return { woke: o.aware || o.state !== "idle", state: o.state }; };
    const r = { control: run("rat", "rat"), amb: run("rat", "__a"), caller: run("__a", "rat") };
    return { pass: r.control.woke && !r.amb.woke && !r.caller.woke, r };`),
  field("husks and rats separate, take a hit and route as before", `
    const q = spot(6, 0, 2.5) || spot(9, 0, 2.5) || spot(12, 0, 2.5); if (!q) return { pass: false, why: "no spot" };
    const out = {}, p0 = { x: p.x, z: p.z };
    // two unbound bodies overlapping share the push equally, whichever is first
    for (const type of ["husk", "rat"]) {
      p.x = p0.x; p.z = p0.z; const a = DF.makeEnemy({ type, x: q.x, z: q.z, yaw: 0, node: -1 }), b = DF.makeEnemy({ type, x: q.x + 0.2, z: q.z, yaw: 0, node: -1 });
      G.enemies = [a, b]; const ax = a.x, bx = b.x; DF.separate();
      out[type + "Sep"] = Math.abs((a.x - ax) + (b.x - bx)) < 1e-9 && Math.abs(Math.abs(a.x - ax) - Math.abs(b.x - bx)) < 1e-9 && a.x < ax && b.x > bx;
      // the player is pushed by weight 0.6 (no poise) or 1, as the old rule gave
      const c = DF.makeEnemy({ type, x: q.x, z: q.z, yaw: 0, node: -1 }); G.enemies = [c]; p.x = c.x + 0.3; p.z = c.z; p.state = "free"; const cx = c.x; DF.separate();
      out[type + "Push"] = c.x < cx && !c.hidden && !c.safe;
      // a hit lands: damage, flash, hunt, posture
      const h = DF.makeEnemy({ type, x: q.x, z: q.z, yaw: 0, node: -1 }); G.enemies = [h]; const hp = h.hp; DF.hitEnemy(h, 5, 10, { src: "melee" });
      out[type + "Hit"] = h.hp < hp && h.flash > 0 && h.aware && h.posture > 0;
      out[type + "Flags"] = !h.hidden && !h.safe && !h.def.bound && !h.def.ambush;
    }
    // a route round a corner still has more than one point for both
    const W = 16, H = 12, F = new Float32Array(17 * 13);
    for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) F[j * 17 + i] = j !== 6 ? 2 : i === 3 ? 0.8 : i === 12 || i === 13 ? 2 : -1;
    const f = DF.fieldFns(F, 0, 0, W, H), real = G.world;
    for (const type of ["husk", "rat"]) { G.world = f; G.routeN = 0; const e = DF.makeEnemy({ type, x: 3, z: 2, yaw: 0, node: -1 }); e.r = 0.9; DF.setRoute(e, 3, 10); G.world = real; out[type + "Route"] = e.route.length > 1; }
    return { pass: Object.values(out).every(Boolean), out };`),
  // ---- being held ----
  hold("a hold lasts HOLD.max and lets go", `
    const e = mk(); const ok = grab(e, { dps: 5 });
    DF.sim(1.9); const mid = p.state, hasHold = !!p.hold && p.hold.by === e;
    DF.sim(0.2);
    const c = { ok, mid: mid === "held", hasHold, free: p.state === "free", safe: p.iframe > 0, grace: G.grabGrace > 0, gone: p.hold === null };
    return { pass: Object.values(c).every(Boolean), c, state: p.state, iframe: p.iframe, grace: G.grabGrace };`),
  hold("each dodge press cuts the hold by HOLD.mash", `
    const run = (code) => { const e = mk(); grab(e, { dps: 0 }); let dodged = false, low = p.stam;
      DF.sim(0.8, (i) => { if (i % 6 === 0 && i < 24) DF.taps[code] = true; if (p.state === "dodge") dodged = true; low = Math.min(low, p.stam); });
      return { free: p.state === "free", dodged, stam: low === p.maxStam }; };
    const k = run(DF.BIND.dodge), t = run("T:dodge");
    const c = { kFree: k.free, kDodge: !k.dodged, kStam: k.stam, tFree: t.free, tDodge: !t.dodged, tStam: t.stam };
    return { pass: Object.values(c).every(Boolean), c, k, t };`),
  hold("a hold with no mashing is not cut short by other buttons", `
    const e = mk(); grab(e, { dps: 0 });
    DF.sim(1.5, (i) => { DF.taps[DF.BIND.light] = true; DF.taps[DF.BIND.heavy] = true; DF.taps[DF.BIND.tool] = true; DF.taps[DF.BIND.heal] = true; DF.taps[DF.BIND.special] = true; });
    return { pass: p.state === "held" && p.hold.t > 1.4 && p.hold.t < 1.6, state: p.state, t: p.hold && p.hold.t };`),
  hold("a hold drags the player", `
    const e = mk(); let T = null;
    for (let a = 0; a < 6.3 && !T; a += 0.3) { const x = p.x + Math.sin(a) * 3, z = p.z + Math.cos(a) * 3;
      if (w.fieldAt(x, z) >= 1 && w.los(p.x, p.z, x, z) && Math.hypot(x - e.x, z - e.z) > 4) T = { x, z }; }
    if (!T) return { pass: false, why: "no target" };
    grab(e, { tx: T.x, tz: T.z, speed: 4 }); DF.sim(1);
    const d = Math.hypot(p.x - T.x, p.z - T.z);
    return { pass: d < 0.3 && p.state === "held", d };`),
  hold("held damage ticks through hurtPlayer and ignores guard", `
    const run = (pre) => { const e = mk(); p.state = pre; p.hp = p.maxHp; const hp0 = p.hp; const ok = grab(e, { dps: 10 }); DF.sim(2.2); return { ok, loss: hp0 - p.hp, state: p.state }; };
    const a = run("free"), b = run("guard");
    const c = { aTook: a.ok && Math.abs(a.loss - 20) <= 1, bTook: b.ok && Math.abs(b.loss - 20) <= 1, same: Math.abs(a.loss - b.loss) < 0.01 };
    return { pass: Object.values(c).every(Boolean), c, a, b };`),
  hold("a dot tick through guard and a perfect dodge window does neither", `
    const e = mk(); p.state = "guard"; p.guardT = 0; const hp0 = p.hp;
    const r = DF.hurtPlayer(4, e, { dmg: 4, dot: true });
    const c = { hit: r === "hit" && hp0 - p.hp === 4, state: p.state === "guard", kb: p.kx === 0 && p.kz === 0 };
    p.state = "dodge"; p.iframe = 0.3; p.pdUsed = false; const f0 = p.focus; const r2 = DF.hurtPlayer(4, e, { dmg: 4, dot: true });
    c.none = r2 === "none" && p.focus === f0 && !p.pdUsed;
    return { pass: Object.values(c).every(Boolean), c, r, r2 };`),
  hold("the holder's death or stagger frees the player", `
    const run = (how) => { const e = mk(); grab(e, { dps: 0 }); DF.sim(0.3); const was = p.state; how(e); DF.sim(1 / 60); return { was, now: p.state }; };
    const k = run((e) => DF.kill(e)), s = run((e) => DF.stagger(e));
    const c = { kHeld: k.was === "held", kFree: k.now === "free", sHeld: s.was === "held", sFree: s.now === "free" };
    return { pass: Object.values(c).every(Boolean), c, k, s };`),
  hold("no grab during a dodge or the grace, and one holder at a time", `
    const e = mk(), o = DF.makeEnemy({ type: "husk", x: e.x, z: e.z, yaw: 0, node: -1 }); G.enemies = [e, o];
    const c = {}; const g = (en) => { en.state = "hold"; return DF.grabPlayer(en, { dps: 0, tx: p.x, tz: p.z, speed: 0 }); };
    p.iframe = 0.3; c.iframe = g(e) === false; p.iframe = 0;
    for (const st of ["dead", "execute", "blink", "inspect", "grapple"]) { p.state = st; c[st] = g(e) === false; } p.state = "free";
    G.state = "pause"; c.pause = g(e) === false; G.state = "play";
    c.first = g(e) === true; c.second = g(o) === false && p.hold.by === e;
    DF.releaseHold(); c.grace = G.grabGrace > 0 && g(e) === false;
    DF.sim(DF.HOLD.grace + 0.1); p.iframe = 0; c.after = g(e) === true;
    return { pass: Object.values(c).every(Boolean), c };`),
  hold("a hit just before the grab leaves no knockback, and a grab may take a hit player", `
    const e = mk(); DF.hurtPlayer(10, e, { dmg: 10 }); const was = p.state, kick = Math.hypot(p.kx, p.kz);
    const ok = grab(e, { dps: 0 }); DF.sim(0.05);
    return { pass: was === "hit" && kick > 1 && ok && p.state === "held" && p.kx === 0 && p.kz === 0 && p.vx === 0 && p.vz === 0, was, kick, ok, state: p.state };`),
  hold("other hits land on a held player but do not free them", `
    const e = mk(), o = DF.makeEnemy({ type: "husk", x: e.x + 3, z: e.z, yaw: 0, node: -1 }); G.enemies = [e, o]; grab(e, { dps: 0 });
    const hp0 = p.hp; const r = DF.hurtPlayer(15, o, { dmg: 15 }); DF.sim(0.2);
    return { pass: r === "hit" && hp0 - p.hp === 15 && p.state === "held" && p.kx === 0 && p.kz === 0, r, loss: hp0 - p.hp, state: p.state };`),
  hold("dying while held ends the hold", `
    const e = mk(); p.hp = 3; grab(e, { dps: 10 }); DF.sim(0.7);
    const c = { dead: p.state === "dead", noHold: p.hold === null, rec: e.state === "rec", grace: G.grabGrace === 0 };
    DF.respawn(); c.free = p.state === "free" && p.hold === null && G.grabGrace === 0;
    return { pass: Object.values(c).every(Boolean), c, state: p.state, est: e.state };`),
  hold("a new run clears a hold", `
    const e = mk(); grab(e, { dps: 0 }); DF.sim(0.2); DF.newRun(99); const q = DF.G.player;
    return { pass: q.state === "free" && q.hold === null && DF.G.grabGrace === 0 };`),
  hold("a hold carries on through a pause menu", `
    const e = mk(); grab(e, { dps: 0 }); DF.sim(0.5); const t0 = p.hold.t;
    DF.show("pause"); DF.show("play"); G.state = "play";
    return { pass: p.state === "held" && !!p.hold && p.hold.t === t0, state: p.state, t0 };`),
  {
    name: "the prompt names the dodge input while held",
    eval: `(async () => { const { G, cam } = DF; G.manual = true; DF.setClass("fighter"); DF.newRun(99); DF.show("play"); G.state = "play";
    const p = G.player, w = G.world; ${draw}
    const h0 = G.enemies.find((q) => q.type === "husk"); const e = DF.makeEnemy({ type: "husk", x: h0.x, z: h0.z, yaw: h0.yaw, node: -1 }); G.enemies = [e];
    p.x = e.x + Math.sin(e.yaw) * 2; p.z = e.z + Math.cos(e.yaw) * 2; w.resolve(p, 0.6); cam.px = p.x; cam.pz = p.z; cam.yaw = Math.atan2(e.x - p.x, e.z - p.z);
    const el = document.getElementById("prompt"); await draw(); const before = el.textContent;
    e.state = "hold"; DF.grabPlayer(e, { dps: 0, tx: p.x, tz: p.z, speed: 0 }); DF.sim(0.2); await draw();
    const during = el.textContent, shown = el.style.display === "block", dodge = document.querySelector("#prompt kbd").textContent;
    DF.releaseHold(); DF.sim(0.1); await draw(); const after = el.textContent;
    return { pass: during.includes("Break free") && shown && dodge === DF.keyName(DF.BIND.dodge) && !before.includes("Break free") && !after.includes("Break free"), before, during, dodge, after }; })()`,
  },
  {
    name: "a held player is drawn struggling",
    eval: `(async () => { const { G, cam } = DF; G.manual = true; DF.setClass("fighter"); DF.newRun(99); DF.show("play"); G.state = "play";
    const p = G.player, w = G.world; ${draw}
    const h0 = G.enemies.find((q) => q.type === "husk"); const e = DF.makeEnemy({ type: "husk", x: h0.x, z: h0.z, yaw: h0.yaw, node: -1 }); G.enemies = [e];
    p.x = e.x + Math.sin(e.yaw) * 2; p.z = e.z + Math.cos(e.yaw) * 2; w.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z);
    cam.px = p.x; cam.pz = p.z; cam.yaw = p.yaw + Math.PI; cam.pitch = 0.25;
    e.state = "hold"; DF.grabPlayer(e, { dps: 0, tx: p.x, tz: p.z, speed: 0 }); DF.taps[DF.BIND.dodge] = true; DF.sim(0.3); await draw();
    const f = p.fig; const arms = [f.armR.r[0], f.armL.r[0]];
    const c = { armsUp: arms[0] < -1.2 && arms[1] < -1.2, held: p.state === "held" };
    return { pass: Object.values(c).every(Boolean), c, arms }; })()`,
    shot: "t24-held",
  },
  // ---- the bloater ----
  pool("a bloater stays in water", STAYS, "fighter", "bloater"),
  step("a bloater in a gutter follows the player along the tunnel without leaving it", `
    DF.setClass("fighter"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
    const p = G.player, w = G.world; G.enemies = []; G.projs = [];
    // a tunnel gutter (a body with no room) with a straight run: its water points ordered along the long axis,
    // and for each metre of the run a dry spot 2.8 m to the side
    const tries = [];
    for (const b of w.bodies.filter((q) => q.room === -1 && q.n >= 30)) {
      const pts = []; for (let x = b.x - 40; x <= b.x + 40; x += 0.5) for (let z = b.z - 40; z <= b.z + 40; z += 0.5) if (w.waterAt(x, z) >= 0.5 && w.bodyAt(x, z) === b.id) pts.push([x, z]);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI, ux = Math.sin(a), uz = Math.cos(a), nx = uz, nz = -ux;
        const us = pts.map((q) => q[0] * ux + q[1] * uz), lo = Math.min(...us);
        for (const dir of [1, -1]) {
          const path = []; let ok = true;
          for (let t = 0; t <= 6.001 && ok; t += 0.5) {
            const u = dir > 0 ? lo + 0.3 + t : Math.max(...us) - 0.3 - t, sl = pts.filter((q, i) => Math.abs(us[i] - u) <= 0.5);
            if (!sl.length) { ok = false; break; }
            const c = [sl.reduce((m, q) => m + q[0], 0) / sl.length, sl.reduce((m, q) => m + q[1], 0) / sl.length];
            let sp = null; for (const sd of [1, -1]) { const x = c[0] + nx * sd * 2.8, z = c[1] + nz * sd * 2.8; if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 0.6 && w.los(c[0], c[1], x, z)) { sp = { x, z }; break; } }
            if (!sp) ok = false; else path.push({ c, sp });
          }
          if (ok) tries.push({ b, path, pts });
        }
      }
    }
    if (!tries.length) return { pass: false, why: "no straight gutter run" };
    const run = tries[0], first = run.path[0];
    // it starts on the water point with room for its body nearest the start of the run
    const st = run.pts.filter((q) => w.fieldAt(q[0], q[1]) >= 0.5).sort((q, o) => Math.hypot(q[0] - first.c[0], q[1] - first.c[1]) - Math.hypot(o[0] - first.c[0], o[1] - first.c[1]))[0];
    const e = DF.makeEnemy({ type: "bloater", x: st[0], z: st[1], yaw: 0, node: -1 }); e.hx = e.x; e.hz = e.z; G.enemies = [e];
    const place = (i) => { const f = Math.min(1, i / 600) * (run.path.length - 1), j = Math.min(run.path.length - 2, Math.floor(f)), k = f - j, A = run.path[j].sp, B = run.path[j + 1].sp;
      p.x = A.x + (B.x - A.x) * k; p.z = A.z + (B.z - A.z) * k; p.hp = p.maxHp; p.stam = p.maxStam; };
    place(0); DF.alertE(e, true); e.state = "chase";
    let bad = 0, jump = 0, last = { x: e.x, z: e.z }, total = 0;
    DF.sim(10, (i) => { place(i); const d = Math.hypot(e.x - last.x, e.z - last.z); jump = Math.max(jump, d); total += d; last = { x: e.x, z: e.z }; if (!DF.waterFoot(e, e.x, e.z)) bad++; });
    const c = { alive: !e.dead, foot: bad === 0, moved: total >= 2, smooth: jump <= 0.5 };
    return { pass: Object.values(c).every(Boolean), c, bad, jump, total, n: run.path.length, body: run.b.id };`),
  pool("its burst leaves a cloud that hurts everyone in it", `
    // the player 1 m from the burst on one side, a rat 1 m off on the other that is stunned (so it stays in the gas) and a
    // free rat 1 m off to the side, which runs for the player and so out of the cloud after a tick
    const mkr = (x, z) => { const r = DF.makeEnemy({ type: "rat", x, z, yaw: 0, node: -1 }); r.hx = r.x; r.hz = r.z; G.enemies.push(r); return r; };
    const r = mkr(e.x - 1, e.z), f = mkr(e.x, e.z + 1);
    r.state = "stagger"; r.t = 0; r.dur = 4; r.posture = 0;
    p.x = e.x + 1; p.z = e.z; p.state = "free"; cam.px = p.x; cam.pz = p.z; p.iframe = 0;
    keep(); const hp0 = p.hp; let hurt = false; DF.kill(e);
    const made = G.clouds.length === 1 && G.clouds[0].r === DF.CLOUD.r;
    DF.sim(3, () => { r.cd = f.cd = 99; if (p.state === "hit") hurt = true; });
    const loss = hp0 - p.hp, ideal = DF.CLOUD.dmg * 6;
    DF.sim(0.2, () => { r.cd = f.cd = 99; });
    const c = { made, player: Math.abs(loss - ideal) <= DF.CLOUD.dmg, never: !hurt, rat: r.dead || r.hp <= 0, free: f.hp < 18, gone: G.clouds.length === 0 };
    return { pass: Object.values(c).every(Boolean), c, loss, ideal, rat: r.hp, free: f.hp };`, "fighter", "bloater"),
  pool("the cloud ignores guard", `
    const run = (guard) => { G.enemies = []; G.clouds = []; p.x = e.x + 1; p.z = e.z; p.yaw = Math.atan2(e.x - p.x, e.z - p.z); p.state = guard ? "guard" : "free"; p.iframe = 0; p.guardT = 5; keep(); const hp0 = p.hp;
      G.clouds.push({ x: e.x, z: e.z, r: DF.CLOUD.r, t: 0, tick: 0 }); let st = true;
      DF.sim(3.2, () => { p.stam = p.maxStam; if (guard) { p.state = "guard"; p.yaw = Math.atan2(e.x - p.x, e.z - p.z); DF.keys[DF.BIND.guard] = true; } if (p.state === "hit" || p.state === "gbreak") st = false; });
      DF.keys[DF.BIND.guard] = false; return { loss: hp0 - p.hp, st }; };
    const a = run(false), b = run(true);
    const c = { took: a.loss >= DF.CLOUD.dmg * 5 && a.loss <= DF.CLOUD.dmg * 7, same: Math.abs(a.loss - b.loss) < 0.01, still: a.st && b.st };
    return { pass: Object.values(c).every(Boolean), c, a, b };`, "fighter", "bloater"),
  pool("it can be hit from the bank", `
    // the player on dry floor just past the shore, the bloater awake: it comes to the shore, in reach of a light attack
    const P2 = { x: e.x + Math.sin(sh.a) * (sh.s + 0.7), z: e.z + Math.cos(sh.a) * (sh.s + 0.7) };
    if (w.waterAt(P2.x, P2.z) !== 0 || w.fieldAt(P2.x, P2.z) < 0.6) return { pass: false, why: "no dry bank", P2 };
    p.x = P2.x; p.z = P2.z; cam.px = p.x; cam.pz = p.z; DF.alertE(e, true); e.state = "chase";
    const range = DF.MOVES[p.cls.chain].range; let t = null;
    DF.sim(10, (i) => { keep(); if (D(e, p) <= range) { t = i / 60; return false; } });
    const hp0 = e.hp; DF.hitEnemy(e, 5, 5, { src: "melee" });
    const c = { near: t !== null, hurt: e.hp < hp0, foot: foot() };
    return { pass: Object.values(c).every(Boolean), c, t, range, d: D(e, p) };`, "fighter", "bloater"),
  pool("a cloud tick is damage only: no knock, flinch, focus or hitstop for what it hurts", `
    // a husk (42 hp, held on its spot) outlasts the cloud's first ticks, so it shows what a tick does to a living enemy
    const h = DF.makeEnemy({ type: "husk", x: e.x + 1, z: e.z, yaw: 0, node: -1 }); h.hx = h.x; h.hz = h.z; G.enemies = [h]; DF.alertE(h, true);
    p.x = e.x - 8; p.z = e.z; cam.px = p.x; cam.pz = p.z; keep(); p.focus = 10; G.hitstop = 0;
    G.clouds = [{ x: h.x, z: h.z, r: DF.CLOUD.r, t: 0, tick: 0 }]; let hit = false, knock = 0, stop = 0;
    DF.sim(1.2, () => { h.cd = 99; h.x = h.hx; h.z = h.hz; keep(); if (h.state === "hit") hit = true; knock = Math.max(knock, Math.hypot(h.kx, h.kz)); stop = Math.max(stop, G.hitstop); });
    const c = { dmg: Math.abs((42 - h.hp) - DF.CLOUD.dmg * 2) <= DF.CLOUD.dmg, noHit: !hit, noKnock: knock === 0, focus: p.focus === 10, stop: stop === 0 };
    return { pass: Object.values(c).every(Boolean), c, hp: h.hp, posture: h.posture };`, "fighter", "bloater"),
  pool("a cloud can burst another bloater", `
    // the player stands 1 m the other side of the burst, so the second bloater floats through the gas toward them
    const b2 = DF.makeEnemy({ type: "bloater", x: e.x + 1, z: e.z, yaw: 0, node: -1 }); b2.hx = b2.x; b2.hz = b2.z; G.enemies.push(b2);
    p.x = e.x - 1; p.z = e.z; cam.px = p.x; cam.pz = p.z; keep(); DF.kill(e); let max = G.clouds.length;
    DF.sim(3, () => { keep(); max = Math.max(max, G.clouds.length); });
    return { pass: b2.dead && max === 2, dead: b2.dead, hp: b2.hp, max };`, "fighter", "bloater"),
  { name: "the bloater, one on the water", eval: `(() => { const { G, cam } = DF; G.manual = true; DF.setClass("fighter"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
    const p = G.player, w = G.world; G.enemies = []; G.projs = [];
    const big = w.bodies.filter((b) => w.nodes[b.room] && w.nodes[b.room].kind === "pool").sort((a, b) => b.n - a.n)[0];
    let at = null, bd = -1; for (let x = big.x - 25; x <= big.x + 25; x += 0.5) for (let z = big.z - 25; z <= big.z + 25; z += 0.5) {
      if (w.waterAt(x, z) !== 1 || w.bodyAt(x, z) !== big.id || w.fieldAt(x, z) < 1) continue;
      let m = 99; for (let k = 0; k < 8; k++) { let d = 0; while (d < 12 && w.waterAt(x + Math.sin(k * 0.785) * d, z + Math.cos(k * 0.785) * d) >= 0.5) d += 0.5; m = Math.min(m, d); }
      if (m > bd) { bd = m; at = { x, z }; } }
    const e = DF.makeEnemy({ type: "bloater", x: at.x, z: at.z, yaw: 0, node: -1 }); e.hx = e.x; e.hz = e.z; G.enemies = [e];
    ${SHOTCAM}
    e.yaw = a + 2.6; DF.sim(0.2);
    return { pass: true, at, bd }; })()`, wait: 400, shot: "t24-bloater" },
  { name: "the cloud a moment after a burst", eval: `(() => { const { G, cam } = DF; G.manual = true; DF.setClass("fighter"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
    const p = G.player, w = G.world; G.enemies = []; G.projs = [];
    const big = w.bodies.filter((b) => w.nodes[b.room] && w.nodes[b.room].kind === "pool").sort((a, b) => b.n - a.n)[0];
    let at = null, bd = -1; for (let x = big.x - 25; x <= big.x + 25; x += 0.5) for (let z = big.z - 25; z <= big.z + 25; z += 0.5) {
      if (w.waterAt(x, z) !== 1 || w.bodyAt(x, z) !== big.id || w.fieldAt(x, z) < 1) continue;
      let m = 99; for (let k = 0; k < 8; k++) { let d = 0; while (d < 12 && w.waterAt(x + Math.sin(k * 0.785) * d, z + Math.cos(k * 0.785) * d) >= 0.5) d += 0.5; m = Math.min(m, d); }
      if (m > bd) { bd = m; at = { x, z }; } }
    const e = DF.makeEnemy({ type: "bloater", x: at.x, z: at.z, yaw: 0, node: -1 }); e.hx = e.x; e.hz = e.z; G.enemies = [e];
    ${SHOTCAM}
    DF.kill(e); DF.sim(0.8, () => { p.hp = p.maxHp; });
    return { pass: G.clouds.length === 1, n: G.clouds.length }; })()`, wait: 400, shot: "t24-cloud" },
  // ---- the eel ----
  pool("an eel stays in water", STAYS, "fighter", "eel"),
  pool("the eel's shock hurts only those in its pool", EELSET + `
    // a rat and a bloater are not needed here: a rat in each pool, a second eel in A, and the player in A, in B or on dry floor
    const run = (where) => {
      taken.length = 0; const rA = mkr("rat", spotA(4)), rB = mkr("rat", spotB(0)), e2 = mkr("eel", spotA(3));
      G.enemies = [e, rA, rB, e2]; for (const q of [rA, rB, e2]) { q.hx = q.x; q.hz = q.z; }
      const s = where === "A" ? spotA(2.5) : where === "B" ? spotB(1) : sh.P;
      p.x = s.x; p.z = s.z; cam.px = p.x; cam.pz = p.z; p.state = "free"; p.iframe = 0; p.hp = p.maxHp; p.kx = p.kz = 0;
      e.shockT = 0; e.glowT = 0; G.shocks = []; aggro(e);
      e.shockT = DF.EEL.every - 0.01; let fired = false;
      DF.sim(DF.EEL.glow + 0.6, () => { for (const q of G.enemies) q.cd = 99; if (G.shocks.length) fired = true; });
      return { loss: p.maxHp - p.hp, fired, rA: rA.dead || rA.hp < DF.EDEF.rat.hp, rB: !rB.dead && rB.hp === DF.EDEF.rat.hp, e2: !e2.dead && e2.hp === DF.EDEF.eel.hp, shocks: G.shocks.length };
    };
    const a = run("A"), b = run("B"), d = run("dry");
    const c = { inA: Math.abs(a.loss - DF.EEL.dmg) < 0.01 && a.fired, inB: b.loss === 0 && b.fired, dry: d.loss === 0 && d.fired,
      ratA: a.rA && b.rA && d.rA, ratB: a.rB && b.rB && d.rB, eels: a.e2 && b.e2 && d.e2 };
    return { pass: Object.values(c).every(Boolean), c, a, b, d };`, "fighter", "eel"),
  pool("it warns first", EELSET + `
    const s = spotA(2.5); p.x = s.x; p.z = s.z; cam.px = p.x; cam.pz = p.z; p.hp = p.maxHp; p.iframe = 0; G.shocks = [];
    aggro(e); e.shockT = DF.EEL.every - 0.01; let max = 0;
    DF.sim(1.0, () => { e.cd = 99; max = Math.max(max, e.glowT || 0); });
    const c = { glowing: e.glowT > 0 && max <= DF.EEL.glow, noDmg: p.hp === p.maxHp, noShock: G.shocks.length === 0, notSafe: e.safe === false };
    DF.sim(0.5, () => { e.cd = 99; });
    c.then = p.hp < p.maxHp && G.shocks.length === 1 && e.glowT === 0 && e.shockT < 1;
    return { pass: Object.values(c).every(Boolean), c, glowT: e.glowT };`, "fighter", "eel"),
  pool("an idle eel never shocks", EELSET + `
    // the player on the bank behind it, out of its notice: it stays unaware for 20 s
    const back = () => { e.yaw = Math.atan2(p.x - e.x, p.z - e.z) + Math.PI; };
    p.hp = p.maxHp; G.shocks = []; back();
    let bad = 0; DF.sim(20, (i) => { e.cd = 99; keep(); back(); if (e.aware || e.shockT > 0 || e.glowT > 0) bad++; });
    // the player in its pool, so that a shock would hurt: still nothing while it has not noticed
    const s = spotA(3.6); p.x = s.x; p.z = s.z; cam.px = p.x; cam.pz = p.z; back();
    DF.sim(10, () => { e.cd = 99; keep(); back(); if (e.aware || e.shockT > 0 || e.glowT > 0) bad++; });
    // a hunt that ends in the middle of its count starts again from nothing
    aggro(e); e.shockT = DF.EEL.every - 0.5; DF.sim(0.1, () => { e.cd = 99; keep(); }); const mid = e.shockT > 0;
    e.aware = false; e.state = "idle"; back(); DF.sim(0.1, () => { e.cd = 99; keep(); back(); });
    const c = { none: G.shocks.length === 0 && bad === 0, p: p.hp === p.maxHp, counted: mid, reset: e.shockT === 0 && !(e.glowT > 0) };
    return { pass: Object.values(c).every(Boolean), c, shockT: e.shockT, bad };`, "fighter", "eel"),
  pool("a shock sets off a bloater", EELSET + `
    const bl = mkr("bloater", spotA(4)); G.enemies = [e, bl]; bl.hx = bl.x; bl.hz = bl.z;
    const s = spotB(0); p.x = s.x; p.z = s.z; cam.px = p.x; cam.pz = p.z; keep(); G.clouds = [];
    aggro(e); e.shockT = DF.EEL.every - 0.01; DF.sim(DF.EEL.glow + 0.4, () => { e.cd = 99; keep(); });
    const c = { dead: bl.dead, cloud: G.clouds.length === 1 || bl.dead && G.clouds.length >= 1 };
    return { pass: Object.values(c).every(Boolean), c, hp: bl.hp, clouds: G.clouds.length };`, "fighter", "eel"),
  pool("it can be hit only while surfaced", EELSET + `
    const s = spotA(2.5); p.x = s.x; p.z = s.z; cam.px = p.x; cam.pz = p.z; keep(); p.iframe = 0;
    aggro(e); e.shockT = 0; const hit = () => { const h = e.hp; DF.hitEnemy(e, 5, 5, { src: "melee" }); return e.hp < h; };
    DF.sim(0.05, () => { e.cd = 99; });
    const out = { under: e.state === "chase" && e.safe === true && !hit() };
    // glowing: the glow starts and the hit lands
    e.shockT = DF.EEL.every - 0.01; DF.sim(0.1, () => { e.cd = 99; keep(); });
    out.glow = e.glowT > 0 && e.safe === false && hit();
    // winding up a bite
    e.glowT = 0; e.shockT = 0; e.state = "wind"; e.atk = DF.EDEF.eel.atks.bite; e.t = 0; DF.sim(0.05, () => { e.cd = 99; keep(); });
    out.wind = e.state === "wind" && e.safe === false && hit();
    // flinching, recovering, staggered
    for (const st of ["rec", "hit", "recoil", "stagger"]) { e.state = st; e.t = 0; e.dur = 5; e.hitT = 5; e.atk = DF.EDEF.eel.atks.bite; e.safe = true; DF.sim(1 / 60, () => { e.cd = 99; keep(); }); out[st] = e.state === st && e.safe === false && hit(); }
    return { pass: Object.values(out).every(Boolean), out };`, "fighter", "eel"),
  pool("a water type does not shove a player standing in its pool", EELSET + `
    // the player in the eel's water, the eel alerted but never attacking: it stops short of them and waits, facing them
    const s = spotA(2.5); p.x = s.x; p.z = s.z; cam.px = p.x; cam.pz = p.z; p.state = "free"; aggro(e); const p0 = { x: p.x, z: p.z };
    let far = 0; DF.sim(4, () => { e.cd = 99; keep(); far = Math.max(far, D(p, p0)); });
    const toP = Math.atan2(p.x - e.x, p.z - e.z);
    const c = { still: far < 0.5, close: D(e, p) <= e.r + p.r + 1, notOn: D(e, p) >= e.r + p.r + 0.3, face: Math.abs(DF.angDiff(e.yaw, toP)) < 0.3, foot: foot() };
    return { pass: Object.values(c).every(Boolean), c, far, d: D(e, p), yaw: DF.angDiff(e.yaw, toP) };`, "fighter", "eel"),
  pool("a kill during the glow leaves no glow", EELSET + `
    aggro(e); e.glowT = 0.8; e.safe = false; DF.kill(e);
    return { pass: e.dead && e.glowT === 0, glowT: e.glowT };`, "fighter", "eel"),
  pool("it can be hit from the bank", EELSET + `
    // the player on dry floor 1.5 m past the shore, the eel awake: it comes to the shore and in reach of a light attack while surfaced
    const P2 = { x: e.x + Math.sin(sh.a) * (sh.s + 1.5), z: e.z + Math.cos(sh.a) * (sh.s + 1.5) };
    if (w.waterAt(P2.x, P2.z) !== 0 || w.fieldAt(P2.x, P2.z) < 0.6) return { pass: false, why: "no dry bank", P2 };
    p.x = P2.x; p.z = P2.z; cam.px = p.x; cam.pz = p.z; aggro(e);
    const range = DF.MOVES[p.cls.chain].range + e.r + p.r; let t = null, landed = false;
    DF.sim(10, (i) => { keep(); if (t === null && D(e, p) <= range && e.safe === false) { t = i / 60; const h = e.hp; DF.hitEnemy(e, 5, 5, { src: "melee" }); landed = e.hp < h; return false; } });
    const c = { near: t !== null, landed, foot: foot() };
    return { pass: Object.values(c).every(Boolean), c, t, range, d: D(e, p) };`, "fighter", "eel"),
  { ...pool("the eel, surfaced and biting at a shore", EELSET + `
    const P2 = { x: e.x + Math.sin(sh.a) * (sh.s + 1.5), z: e.z + Math.cos(sh.a) * (sh.s + 1.5) };
    p.x = P2.x; p.z = P2.z; p.state = "free"; aggro(e);
    const face = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = face - 1.3; cam.pitch = 0.3; p.yaw = face; cam.px = p.x; cam.pz = p.z;
    let seen = false; DF.sim(10, () => { keep(); p.x = P2.x; p.z = P2.z; cam.px = p.x; cam.pz = p.z; cam.yaw = face - 1.3; if (e.state === "wind" && e.t > 0.38) { seen = true; return false; } });
    return { pass: seen, st: e.state };`, "fighter", "eel"), wait: 400, shot: "t24-eel" },
  { ...pool("the shocked pool lit while the other is dark", EELSET + `
    // the player on the dry floor nearest the middle between the two pools, looking across both
    const mid = { x: (big.x + B.x) / 2, z: (big.z + B.z) / 2 }; let dry = null, dd = 1e9;
    for (let x = mid.x - 8; x <= mid.x + 8; x += 0.5) for (let z = mid.z - 8; z <= mid.z + 8; z += 0.5)
      if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 1 && Math.hypot(x - mid.x, z - mid.z) < dd) { dd = Math.hypot(x - mid.x, z - mid.z); dry = { x, z }; }
    p.x = dry.x; p.z = dry.z; p.state = "free"; aggro(e);
    e.shockT = DF.EEL.every - 0.01; let n = 0; DF.sim(4, () => { keep(); p.x = dry.x; p.z = dry.z; e.cd = 99; if (G.shocks.length && ++n > 6) return false; });
    const face = Math.atan2(B.x - big.x, B.z - big.z) + SIDE; cam.yaw = face; cam.pitch = 0.55; p.yaw = face; cam.px = p.x; cam.pz = p.z;
    return { pass: G.shocks.length === 1, n: G.shocks.length, dB: D(B, big), dry, dd };`.replace("SIDE", "-Math.PI / 2"), "fighter", "eel"), wait: 400, shot: "t24-eel-shock" },
  step("the class is put back", `DF.setClass("fighter"); return { pass: true };`),
];
