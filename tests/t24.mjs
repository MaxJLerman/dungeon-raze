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
const pool = (name, body, cls = "fighter") =>
  step(name, `DF.setClass("${cls}"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
  const p = G.player, w = G.world; G.enemies = []; G.projs = [];
  DF.EDEF.__w = { ...DF.EDEF.rat, bound: "water", hp: 9999 }; DF.EBEH.__w = { foot: DF.waterFoot };
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  const big = w.bodies.filter((b) => w.nodes[b.room] && w.nodes[b.room].kind === "pool").sort((a, b) => b.n - a.n)[0];
  if (!big) return { pass: false, why: "no pool body" };
  let at = null, bd = -1;
  for (let x = big.x - 25; x <= big.x + 25; x += 0.5) for (let z = big.z - 25; z <= big.z + 25; z += 0.5) {
    if (w.waterAt(x, z) !== 1 || w.bodyAt(x, z) !== big.id || w.fieldAt(x, z) < 1) continue;
    let m = 99; for (let k = 0; k < 8; k++) { let d = 0; while (d < 12 && w.waterAt(x + Math.sin(k * 0.785) * d, z + Math.cos(k * 0.785) * d) >= 0.5) d += 0.5; m = Math.min(m, d); }
    if (m > bd) { bd = m; at = { x, z }; } }
  if (!at) return { pass: false, why: "no deep point" };
  const e = DF.makeEnemy({ type: "__w", x: at.x, z: at.z, yaw: 0, node: -1 }); e.hx = e.x; e.hz = e.z; G.enemies.push(e);
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
const draw = `const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`;

export default [
  // ---- the helpers themselves ----
  step("bound is read from the definition, wallFoot holds the post", `
    const w = { ...DF.EDEF.husk, bound: "wall" };
    const a = { def: w }, b = { def: DF.EDEF.husk }, c = { hx: 3, hz: 4 };
    const c1 = { bound: DF.bound(a), plain: !DF.bound(b), boss: !DF.bound({ def: DF.EDEF.warden }),
      post: DF.wallFoot(c, 3, 4) === true, near: DF.wallFoot(c, 3.005, 4) === true, off: DF.wallFoot(c, 3.02, 4) === false && DF.wallFoot(c, 3, 3.98) === false };
    return { pass: Object.values(c1).every(Boolean) && typeof DF.waterGoal === "function" && typeof DF.waterFoot === "function", c1 };`),
  pool("a water-bound body stays in its own pool", `
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
    return { pass: out.start && out.step && out.over && out.kick && out.kickX && out.pushtrue && out.pushfalse && out.player, out, shore: sh.s, deep: bd };`),
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
  step("the class is put back", `DF.setClass("fighter"); return { pass: true };`),
];
