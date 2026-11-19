// Old Sluicejaw, the crocodile boss of D's cavern, and the shared seams for a boss with its own
// rules: the atkOk hook, def.arena, def.ownPhases, def.fell.
// Run with: SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke
// The test type __k (a copy of the Warden) is registered inside each step and deleted at its end.
const draw = `const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`;
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam } = DF; G.manual = true; ${draw}
  const drop = () => { delete DF.EDEF.__k; delete DF.EBEH.__k; };
  const reg = (extra) => { DF.EDEF.__k = { ...DF.EDEF.warden, ...extra }; };
  try { ${body} } finally { drop(); } })()`,
});
// a D run (seed 5) with the player and the cavern's centre to hand
const dRun = `DF.setClass("fighter"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
  const p = G.player, w = G.world, B = w.boss; G.enemies = []; G.projs = [];`;
// the crocodile on the cavern's dry ring, 16 m from the centre, three-quarters on to a camera
// 6.5 m off whose player is hidden; the camera distance is put back by a later step
const croc = `window.__cd0 = window.__cd0 || cam.dist;
  const e = DF.makeEnemy({ type: "croc", x: B.x, z: B.z, yaw: 0, node: B.id }); G.enemies = [e]; e.aware = true;
  let a = 0; for (let k = 0; k < 32; k++) { const q = (k / 32) * Math.PI * 2, x = B.x + Math.sin(q) * 16, z = B.z + Math.cos(q) * 16;
    if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 3 && w.fieldAt(B.x + Math.sin(q) * 9, B.z + Math.cos(q) * 9) >= 3) { a = q; break; } }
  e.x = B.x + Math.sin(a) * 16; e.z = B.z + Math.cos(a) * 16; e.hx = e.x; e.hz = e.z;
  const ca = a + Math.PI + 0.55; p.x = e.x + Math.sin(ca) * 6.5; p.z = e.z + Math.cos(ca) * 6.5; w.resolve(p, 0.6);
  p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.pitch = 0.28; cam.px = p.x; cam.pz = p.z; cam.dist = 2;
  e.yaw = cam.yaw + Math.PI + 1.0; p.fig.root.s = [0.0001, 0.0001, 0.0001];`;
const base = [
  step("atkOk leaves refused attacks out", `
  DF.newRun(99); DF.show("play"); G.state = "play"; G.enemies = [];
  reg({});
  const mk = () => DF.makeEnemy({ type: "__k", x: G.player.x + 4, z: G.player.z, yaw: 0, node: -1 });
  const e = mk(), c1 = e.def.atks.c1, c = { p: G.player, w: G.world, dx: 4, dz: 0, dist: 4, toP: 0, alive: true };
  let plain = 0; for (let i = 0; i < 200; i++) if (DF.chooseAtk(e, 4, c) === c1) plain++;
  let seen = 0, other = 0, called = 0;
  DF.EBEH.__k = { atkOk: (q, a, cc) => { if (cc === c) called++; return a !== q.def.atks.c1; } };
  for (let i = 0; i < 200; i++) { const a = DF.chooseAtk(e, 4, c); if (a === c1) seen++; else if (a) other++; }
  const out = { plain, seen, other, called };
  return { pass: plain > 0 && seen === 0 && called > 0, ...out };`),
  step("an arena boss holds while the player is in the cavern", `
  ${dRun}
  const run = (extra) => {
    reg(extra); G.enemies = [];
    const e = DF.makeEnemy({ type: "__k", x: B.x - 20, z: B.z, yaw: 0, node: -1 });
    e.hx = e.x - 35; e.hz = e.z; e.aware = true; e.state = "chase"; e.hp = e.def.hp; G.enemies.push(e);
    p.x = B.x + 20; p.z = B.z; p.hp = p.maxHp; p.state = "free"; cam.px = p.x; cam.pz = p.z; G.inBoss = true;
    return e;
  };
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  // arena, player in the cavern 40 m off: it holds
  let e = run({ arena: true }); DF.sim(0.5, keep); const held = e.state, inBoss = G.inBoss;
  // the player leaves the cavern: G.inBoss turns false and it gives up
  p.x = B.x + B.r + DF.PURSUIT.bossPad + 4; p.z = B.z; DF.sim(0.5, keep); const left = e.state, inBossOut = G.inBoss;
  // a plain boss copy gives up at 40 m, as today
  e = run({}); DF.sim(0.5, keep); const plain = e.state;
  return { pass: held === "chase" && inBoss === true && left === "return" && inBossOut === false && plain === "return", held, inBoss, left, inBossOut, plain };`),
  step("own phases skip the half-health roar", `
  DF.newRun(99); DF.show("play"); G.state = "play"; G.enemies = [];
  const hit = (type, extra) => {
    if (extra) reg(extra);
    const e = DF.makeEnemy({ type, x: G.player.x + 3, z: G.player.z, yaw: 0, node: -1 }); G.enemies = [e]; e.aware = true;
    e.hp = e.def.hp * 0.52; DF.hitEnemy(e, e.def.hp * 0.07, 0, { src: "melee" });
    return { phase: e.phase, state: e.state, hp: e.hp / e.def.hp };
  };
  const own = hit("__k", { ownPhases: true });
  const wd = hit("warden");
  return { pass: own.phase === 1 && own.state !== "roar" && wd.phase === 2 && wd.state === "roar", own, wd };`),
  step("a boss names its own fall", `
  ${dRun}
  const fall = async (type, extra) => {
    if (extra) reg(extra);
    G.msgs = []; G.bossDead = false;
    const e = DF.makeEnemy({ type, x: B.x, z: B.z, yaw: 0, node: -1 }); G.enemies = [e];
    DF.kill(e); await draw();
    return document.getElementById("msgs").textContent;
  };
  try {
    const own = await fall("__k", { fell: "TEST FALLS" });
    const wd = await fall("warden");
    return { pass: own.includes("TEST FALLS") && !own.includes("WARDEN") && wd.includes("THE WARDEN FALLS"), own, wd };
  } finally { DF.resetCleared(); G.bossDead = false; }`),
  // ---- Old Sluicejaw's body and place ----
  step("the cavern holds the crocodile, not the Warden", `const bad = [], d = DF.EDEF.croc;
  const def = !!d && d.name === "Old Sluicejaw" && d.boss && d.arena && d.ownPhases && d.fell === "OLD SLUICEJAW FALLS" && d.threat === 2 && d.hp === 800;
  for (let s = 1; s <= 12; s++) { const w = DF.genSewer(s), b = w.boss, c = w.spawns.filter((q) => q.type === "croc"), wd = w.spawns.filter((q) => q.type === "warden").length;
    if (c.length !== 1 || wd || c[0].kind !== "boss" || c[0].node !== b.id || Math.hypot(c[0].x - b.x, c[0].z - b.z) > b.r - 2) bad.push({ s, n: c.length, wd, c: c[0] }); }
  DF.newRun(99); const cave = G.world.spawns.filter((q) => q.type === "warden").length === 1 && G.enemies.some((e) => e.type === "warden") && !G.enemies.some((e) => e.type === "croc");
  return { pass: def && bad.length === 0 && cave, def, cave, bad: bad.slice(0, 4) };`),
  step("the crocodile's body in every state", `${dRun}
  ${croc}
  const f = e.fig, finite = () => { let ok = true; (function rec(n) { for (const v of [...n.p, ...n.r, ...n.s]) if (!Number.isFinite(v)) ok = false; n.ch.forEach(rec); })(f.root); return ok; };
  const set = (st, an, k) => { e.state = st; e.atk = an ? e.def.atks[an] : null; e.t = an && e.atk[st] ? e.atk[st] * k : k; e.speed = st === "chase" ? e.def.speed : 0; e.walk = 1.3; };
  let threw = null, finiteAll = true, n = 0;
  for (const st of ["idle", "alert", "chase", "search", "return", "hit", "recoil", "stagger", "roar", "hold", "dead"]) for (const k of [0, 0.3, 1.5]) {
    set(st, null, k); try { DF.poseEnemy(e); n++; if (!finite()) finiteAll = false; } catch (x) { threw = st + " " + x.message; } await draw(); }
  for (const an of Object.keys(e.def.atks)) for (const st of ["wind", "act", "rec"]) for (const k of [0, 0.3, 0.7, 1]) {
    set(st, an, k); try { DF.poseEnemy(e); n++; if (!finite()) finiteAll = false; } catch (x) { threw = st + " " + an + " " + x.message; } }
  await draw();
  // the head against the trunk: level at rest, well above it in the rear's act
  const up = async (st, an, k) => { set(st, an, k); await draw(); return DF.R.nodePos(f.headN)[1] - DF.R.nodePos(f.body)[1]; };
  const idle = await up("idle", null, 0), rear = await up("act", "rear", 0.3);
  // the jaw opens for a bite and the roll turns the body about its long axis
  set("wind", "b1", 1); DF.poseEnemy(e); const jaw = f.jaw.r[0];
  set("act", "roll", 0.5); DF.poseEnemy(e); const roll = Math.abs(f.spin.r[2]);
  set("dead", null, 2); DF.poseEnemy(e); const back = Math.abs(Math.cos(f.spin.r[2]) + 1) < 0.05;
  const parts = { jaw: !!f.jaw, body: !!f.body, spin: !!f.spin, rim: Array.isArray(f.rim), eye: Array.isArray(f.eye), legs: f.legs && f.legs.length === 4, tail: f.tail && f.tail.length >= 5 };
  return { pass: threw === null && finiteAll && n > 50 && Object.values(parts).every(Boolean) && Math.abs(idle) < 0.5 && rear > 1 && jaw > 0.5 && roll > 1 && back, threw, finiteAll, n, parts, idle, rear, jaw, roll, back };`),
  // the tail sweep a third of the way round, head to the camera and the tail's curve across the view
  ...[["idle", "idle", null, 0], ["rear", "act", "rear", 0.3], ["bite", "wind", "b1", 0.9], ["tail", "act", "tail", 0.35, 0.45], ["roll", "act", "roll", 0.4]].map(([nm, st, an, k, pitch]) => ({
    ...step("the crocodile " + nm + ", for looking at", `${dRun}
  ${croc}
  ${pitch ? `cam.pitch = ${pitch};` : ""} e.state = "${st}"; e.atk = ${an ? `e.def.atks.${an}` : "null"}; e.t = e.atk ? e.atk["${st}"] * ${k} : 0; e.speed = 0; e.walk = 1.3; return { pass: true };`), wait: 500, shot: "t25-croc-" + nm })),
  step("the camera and the player are put back", `cam.dist = window.__cd0 || cam.dist; G.player.fig.root.s = [1, 1, 1]; DF.newRun(99); return { pass: true };`),
  { name: "a sewer frame stays in budget", eval: `(async () => { const { G, cam } = DF; G.manual = true; ${draw}
  DF.newRun(99); const cap = G.world.pos.length / 9;
  ${dRun}
  ${croc}
  // what the figure draws: the renderer counts the world's triangles only
  const T = { box: 12, cone: 12, cyl: 32, oct: 8, sph: 128 }; let fig = 0; for (const m of e.fig.meshes) fig += T[m.prim];
  p.fig.root.s = [1, 1, 1]; cam.dist = window.__cd0 || cam.dist;
  let most = 0; for (let k = 0; k < 8; k++) { cam.yaw = p.yaw + k * Math.PI / 4; await draw(); most = Math.max(most, DF.R.stats.tris); }
  cam.yaw = p.yaw; await draw(); const seen = e.vis;
  return { pass: seen && most + fig <= cap && fig < 12000, most, fig, cap, seen }; })()` },
];
// ---- under, rising and on land ----
// A D run (seed 5) with the cavern's own crocodile alone in it, fresh from makeEnemy, and helpers:
// ringAt(r) a dry point r m from the centre, out a walkable point just outside the cavern, put(q)
// the player there, keep() the player whole, until(f, sec) the steps simulated before f holds.
const fight = `${dRun}
  const s0 = w.spawns.find((q) => q.type === "croc"), C = DF.CROC; let e = DF.makeEnemy(s0); G.enemies = [e];
  const ringAt = (r, a0 = 0) => { for (let k = 0; k < 64; k++) { const q = a0 + (k / 64) * Math.PI * 2, x = B.x + Math.sin(q) * r, z = B.z + Math.cos(q) * r;
    if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 2) return { x, z, a: q }; } return null; };
  const out = (() => { for (let k = 0; k < 256; k++) { const q = (k / 256) * Math.PI * 2, r = B.r + DF.PURSUIT.bossPad + 3, x = B.x + Math.sin(q) * r, z = B.z + Math.cos(q) * r;
    if (w.fieldAt(x, z) >= 0.8) return { x, z }; } return null; })();
  const put = (q) => { p.x = q.x; p.z = q.z; p.vx = p.vz = p.kx = p.kz = 0; p.state = "free"; cam.px = p.x; cam.pz = p.z; };
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  const until = (f, sec, each) => DF.sim(sec, () => { if (f()) return false; keep(); if (each) each(); });
  const bar = async () => { await draw(); return document.getElementById("boss").classList.contains("show"); };
  const ring = ringAt(14);
  // into the fight: a step outside (it settles into wait), then onto the ring
  const begin = (q = ring) => { put(out); DF.sim(0.1, keep); put(q); DF.sim(1 / 60, keep); };`;
const cstep = (name, body) => step(name, `${fight}\n${body}`);
const crocSteps = [
  cstep("it waits under until the player enters the cavern", `
  put(out); DF.sim(0.5, keep);
  const before = { mode: e.mode, hidden: e.hidden, aware: e.aware, bar: await bar(), inBoss: G.inBoss };
  put(ring); DF.sim(0.2, keep);
  const after = { mode: e.mode, hidden: e.hidden, aware: e.aware, bar: await bar(), inBoss: G.inBoss };
  return { pass: !!out && before.mode === "wait" && before.hidden && !before.aware && !before.bar && !before.inBoss &&
    after.inBoss && after.aware && after.bar && after.mode === "under" && after.hidden, before, after };`),
  cstep("under it cannot be locked, hit or aimed at", `
  begin(); const mode = e.mode, hp = e.hp;
  p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z); const d = Math.hypot(e.x - p.x, e.z - p.z), base = cam.yaw + 0.3;
  const lock = DF.pickLock(); DF.hitEnemy(e, 50, 0, {}); const aim = DF.aimYaw(base, d + 2, 1.2), hpAfter = e.hp;
  // the same calls find it once it is up
  e.hidden = false; const lockUp = DF.pickLock(), aimUp = DF.aimYaw(base, d + 2, 1.2); e.hidden = true;
  return { pass: mode === "under" && lock !== e && hpAfter === hp && aim === base && lockUp === e && aimUp !== base, mode, d, lockNull: lock === null, hp, hpAfter, aim, base };`),
  cstep("it surfaces at a new shore spot with a warning", `
  // the player beside the moat, where the nearest shore is too near to come up at
  const q = ringAt(19.5); put(out); DF.sim(0.1, keep);
  put(q); const c = { p, w }, last = DF.crocPickSpot(e, c); e.lastSpot = last; DF.sim(1 / 60, keep);
  const under = e.mode; until(() => e.mode === "rise", 25);
  const s = e.spot, sp = s && { x: s.x, z: s.z, water: w.waterAt(s.x, s.z), fromLast: Math.hypot(s.x - last.x, s.z - last.z), fromP: Math.hypot(s.x - p.x, s.z - p.z) };
  let hid = true; const n = until(() => e.mode !== "rise", 3, () => { if (!e.hidden) hid = false; });
  const up = { mode: e.mode, hidden: e.hidden, state: e.state, rear: e.atk === e.def.atks.rear };
  until(() => e.state !== "wind" && e.state !== "act", 3);
  const dry = w.waterAt(e.x, e.z), st = e.state;
  return { pass: under === "under" && !!s && sp.water >= 0.5 && sp.fromLast >= C.minNew && sp.fromP >= C.near && hid && Math.abs(n - C.warn * 60) <= 1 &&
    up.mode === "land" && !up.hidden && up.state === "wind" && up.rear && dry < 0.5 && st === "rec", sp, n, hid, up, dry, st };`),
  cstep("standing on the spot hurts and pushes clear", `
  begin(); until(() => e.mode === "rise", 25);
  const s = e.spot; put(s); p.yaw = 0; until(() => e.mode !== "rise", 3, () => { put(s); keep(); });
  const lost = p.maxHp - p.hp, mode = e.mode; DF.sim(0.5);
  const gap = Math.hypot(p.x - e.x, p.z - e.z);
  return { pass: mode === "land" && Math.abs(lost - C.burst) < 0.01 && gap >= e.r + p.r, lost, gap, need: e.r + p.r, pstate: p.state };`),
  cstep("the rearing slam lands on its warning ring", `
  // the player beside the ring as the act starts, across the way it faces, so that turning to
  // them would move the hit: just outside is not hit, just inside is
  const run = (inside) => {
    e = DF.makeEnemy(s0); G.enemies = [e]; begin(); until(() => e.mode === "land", 25);
    until(() => e.state !== "wind", 3);
    const st = e.state, hx = e.rhx, hz = e.rhz, r = e.atk.radius;
    const warn = G.rings.find((g) => g.kind === "warn" && Math.abs(g.x - hx) < 1e-9 && Math.abs(g.z - hz) < 1e-9);
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), d = inside ? r - 0.4 : r + 0.4, q = { x: hx - fz * d, z: hz + fx * d };
    put(q); p.iframe = 0; let lost = 0, h = p.hp;
    DF.sim(e.atk.act + 0.1, () => { put(q); if (p.hp < h) lost += h - p.hp; p.hp = p.maxHp; h = p.hp; if (e.state !== "act") return false; });
    return { st, ring: !!warn, at: Math.hypot(q.x - hx, q.z - hz), r, lost, done: e.state !== "act" };
  };
  const outside = run(false), inn = run(true);
  return { pass: outside.st === "act" && outside.ring && outside.done && outside.at > outside.r && outside.lost === 0 &&
    inn.st === "act" && inn.ring && inn.done && inn.at < inn.r && Math.abs(inn.lost - e.def.atks.rear.dmg) < 0.01, outside, inn };`),
  cstep("the centre pool is no safe spot", `
  // a player standing still in the middle of the centre pool, for one cycle: under, up, under
  const q = { x: B.x, z: B.z }; begin(q);
  const wet = w.waterAt(p.x, p.z);
  let lost = 0, h = p.hp, up = 0, land = 0, cyc = false;
  const n = DF.sim(30, () => { if (p.hp < h) lost += h - p.hp; p.hp = p.maxHp; h = p.hp; p.stam = p.maxStam;
    if (e.mode === "land") land++; if (land && e.mode === "under") { cyc = true; return false; } });
  const one = { lost, land: land / 60, cyc };
  // and over a minute it keeps coming up at them
  lost = 0; h = p.hp; let ups = 0, was = e.mode;
  DF.sim(60, () => { if (p.hp < h) lost += h - p.hp; p.hp = p.maxHp; h = p.hp; p.stam = p.maxStam;
    if (e.mode === "land" && was !== "land") ups++; was = e.mode; });
  return { pass: wet >= 0.5 && one.cyc && one.lost > 0 && one.land < C.land && ups >= 3 && lost >= 2 * C.burst, wet, one, minute: { lost, ups } };`),
  cstep("a sticky bomb on it drops off as it goes under", `
  begin(); until(() => e.mode === "land", 25); until(() => e.state === "chase", 3);
  // a bomb on its back with the fuse held off, then it dives
  G.bombs = [{ x: e.x, y: 1.1, z: e.z, e, ox: 0, oz: 0, t: 60 }]; const b = G.bombs[0];
  DF.sim(0.2, keep); const rode = b.e === e && Math.hypot(b.x - e.x, b.z - e.z) < 1e-6;
  e.landT = 0; until(() => e.hidden, 6); DF.sim(1 / 60, keep);
  const at = { x: b.x, z: b.z }, off = { e: b.e, y: b.y, hidden: e.hidden };
  DF.sim(1, keep); const still = Math.hypot(b.x - at.x, b.z - at.z), moved = Math.hypot(e.x - at.x, e.z - at.z);
  G.bombs = [];
  return { pass: rode && off.hidden && off.e === null && off.y === 0.4 && still === 0 && moved > 0.5, rode, off: { ...off, e: !!off.e }, still, moved };`),
  cstep("land lasts CROC.land and a stagger keeps it up", `
  // a passive player out of reach of harm: whole and untouchable
  const safe = () => { p.iframe = 1; };
  begin(); until(() => e.mode === "land", 25);
  const n1 = until(() => e.mode !== "land", C.land + 3, safe), m1 = e.mode;
  e = DF.makeEnemy(s0); G.enemies = [e]; begin(); until(() => e.mode === "land", 25);
  let n2 = until(() => false, 5, safe); DF.stagger(e); const stag = e.state;
  n2 += until(() => e.mode !== "land", C.land + C.stagBonus + 6, safe);
  return { pass: n1 >= C.land * 60 - 1 && n1 <= (C.land + 3) * 60 && (m1 === "dive" || m1 === "under") && stag === "stagger" && n2 >= (C.land + C.stagBonus) * 60 && e.mode !== "land",
    n1: n1 / 60, m1, n2: n2 / 60, m2: e.mode };`),
  cstep("it turns its tail on a player behind it", `
  begin(); until(() => e.mode === "land", 25); until(() => e.state === "chase", 3);
  const at = (ang) => { put({ x: e.x + Math.sin(e.yaw + ang) * 3.5, z: e.z + Math.cos(e.yaw + ang) * 3.5 });
    const dx = p.x - e.x, dz = p.z - e.z; return { p, w, dx, dz, dist: Math.hypot(dx, dz), toP: Math.atan2(dx, dz), alive: true }; };
  const count = (c) => { const n = {}; for (let i = 0; i < 200; i++) { const a = DF.chooseAtk(e, c.dist, c); const k = a ? Object.keys(e.def.atks).find((x) => e.def.atks[x] === a) : "none"; n[k] = (n[k] || 0) + 1; } return n; };
  const behind = count(at(Math.PI)), front = count(at(0));
  // and from behind it starts the sweep without first turning round
  at(Math.PI); e.state = "chase"; e.plan = null; e.cd = 0; let started = null;
  until(() => e.state === "wind", 0.5); started = e.state === "wind" ? Object.keys(e.def.atks).find((x) => e.def.atks[x] === e.atk) : e.state;
  return { pass: behind.tail === 200 && !front.tail && started === "tail", behind, front, started };`),
  cstep("a long swim still surfaces in its time under", `
  begin(); const n0 = e.mode === "under" ? 1 : -1;
  // in the moat, with its spot on the far side of the moat
  const sh = DF.crocShores(e, w), far = sh.reduce((a, q) => Math.hypot(q.x - B.x, q.z - B.z) > Math.hypot(a.x - B.x, a.z - B.z) ? q : a);
  const moat = sh.filter((q) => q.body === far.body && Math.hypot(q.x - B.x, q.z - B.z) > B.r - 6);
  const from = moat[0]; e.x = from.x; e.z = from.z;
  const to = moat.reduce((a, q) => Math.hypot(q.x - from.x, q.z - from.z) > Math.hypot(a.x - from.x, a.z - from.z) ? q : a);
  e.spot = to; e.path = null; const t0 = e.modeT;
  DF.sim(1 / 60, keep); let len = 0; for (let i = 0, x = from.x, z = from.z; i < e.path.length; i++) { len += Math.hypot(e.path[i].x - x, e.path[i].z - z); x = e.path[i].x; z = e.path[i].z; }
  const n = 2 + until(() => e.mode === "rise", C.under[1] + 2);
  return { pass: n0 === 1 && len > 40 && e.mode === "rise" && Math.hypot(e.x - to.x, e.z - to.z) < 0.01 && n <= C.under[1] * 60 + 1 && e.spot === to,
    len, t0, n: n / 60, cap: C.under[1], mode: e.mode };`),
  cstep("leaving the cavern resets it", `
  begin(); until(() => e.mode === "land", 25); e.hp = e.def.hp * 0.7;
  put(out); const n = until(() => e.mode === "wait", 1);
  const left = { n, mode: e.mode, hp: e.hp, hidden: e.hidden, aware: e.aware, bar: await bar(), x: Math.hypot(e.x - e.hx, e.z - e.hz) };
  put(ring); DF.sim(0.1, keep); const again = { mode: e.mode, aware: e.aware, bar: await bar() };
  // a respawn mid-fight builds a fresh one
  until(() => e.mode === "land", 25); e.hp = e.def.hp * 0.7; DF.respawn(); G.manual = true;
  // it is set up on its first step near the cavern: from just outside, it waits
  const f = G.enemies.find((o) => o.type === "croc"); put(out); DF.sim(0.1, keep);
  const re = { mode: f.mode, hp: f.hp, hidden: f.hidden, bar: await bar() };
  put(ring); DF.sim(0.1, keep); const re2 = { mode: f.mode, aware: f.aware };
  return { pass: n < 60 && left.mode === "wait" && left.hp === e.def.hp && left.hidden && !left.aware && !left.bar && left.x < 0.01 &&
    again.mode === "under" && again.aware && again.bar && re.mode === "wait" && re.hp === f.def.hp && re.hidden && !re.bar && re2.mode === "under" && re2.aware,
    left, again, re, re2 };`),
  cstep("it never surfaces into rubble", `
  // rubble over the shores of every other eighth of the cavern, and over the ring beside them
  const sh = DF.crocShores(e, w), ids = [], sect = (q) => Math.floor(((Math.atan2(q.x - B.x, q.z - B.z) + Math.PI) / (Math.PI * 2)) * 8) % 2;
  for (const q of sh) if (sect(q) === 0) ids.push(w.addRock(q.x, q.z, q.x + (B.x - q.x) * 0.1, q.z + (B.z - q.z) * 0.1, 1.0));
  const bad = []; let n = 0;
  try {
    for (let k = 0; k < 30; k++) {
      const q = ringAt(8 + Math.random() * 12, Math.random() * 7); if (!q) continue; put(q);
      e.lastSpot = Math.random() < 0.5 ? sh[(Math.random() * sh.length) | 0] : null;
      const s = DF.crocPickSpot(e, { p, w }); n++;
      let dry = false;
      if (s) for (let x = -3; x <= 3 && !dry; x += 0.5) for (let z = -3; z <= 3 && !dry; z += 0.5)
        if (Math.hypot(x, z) <= 3 && w.waterAt(s.x + x, s.z + z) < 0.5 && w.fieldAt(s.x + x, s.z + z) >= e.r) dry = true;
      if (!s || w.fieldAt(s.x, s.z) < e.r || !dry) bad.push({ k, s, f: s && w.fieldAt(s.x, s.z), dry });
    }
  } finally { w.clearRocks(); }
  return { pass: sh.length > 20 && n === 30 && bad.length === 0, shores: sh.length, rocks: ids.length, n, bad: bad.slice(0, 4) };`),
  // for looking at: the wake in the moat, and the warning at a shore
  { ...cstep("the wake under the moat, for looking at", `
  const q = ringAt(17); begin(q); e.mode = "under"; e.hidden = true;
  // in the moat beside the player, swimming round it
  const a = Math.atan2(q.x - B.x, q.z - B.z), mx = B.x + Math.sin(a) * 23.3, mz = B.z + Math.cos(a) * 23.3;
  e.x = mx; e.z = mz; e.spot = { x: B.x + Math.sin(a + 1.2) * 23.3, z: B.z + Math.cos(a + 1.2) * 23.3, body: w.bodyAt(mx, mz) }; e.modeT = 9; e.path = null;
  DF.sim(0.4, keep); const moat = w.waterAt(e.x, e.z);
  // the player stood aside (hidden) and the camera over the ring looking along the wake
  p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z) - 0.25; cam.pitch = 0.55; p.fig.root.s = [0.0001, 0.0001, 0.0001];
  return { pass: e.mode === "under" && moat >= 0.5 && e.speed > 1, moat, speed: e.speed };`), wait: 500, shot: "t25-wake" },
  { ...cstep("the warning at a shore, for looking at", `
  begin(); until(() => e.mode === "rise", 25); DF.sim(C.warn * 0.55, keep);
  const s = e.spot, b = Math.atan2(p.x - s.x, p.z - s.z); put({ x: s.x + Math.sin(b) * 5, z: s.z + Math.cos(b) * 5 }); w.resolve(p, p.r);
  p.yaw = cam.yaw = Math.atan2(s.x - p.x, s.z - p.z); cam.pitch = 0.5; p.fig.root.s = [0.0001, 0.0001, 0.0001];
  return { pass: e.mode === "rise" && e.hidden, mode: e.mode };`), wait: 500, shot: "t25-rise" },
];
// ---- the death roll ----
// On the ring 4.5 m in from the moat (seed 5's moat starts about 22 m out), the crocodile up on
// land and winding up its roll at a player 3 m further out: place() sets it all up, grab() runs
// the wind and act until the player is held and returns the steps it took.
const rolling = `begin(); until(() => e.mode === "land", 25); until(() => e.state === "chase", 3);
  const H = DF.HOLD, a0 = ringAt(17.5).a, at = (r, s = 0) => ({ x: B.x + Math.sin(a0) * r + Math.cos(a0) * s, z: B.z + Math.cos(a0) * r - Math.sin(a0) * s });
  const place = () => { const q = at(17.5);
    Object.assign(e, { x: q.x, z: q.z, okx: q.x, okz: q.z, wet: false, landT: 20, cd: 0, plan: null, token: false, hitDone: false, rollCD: 0 });
    put(at(20.5)); p.hp = p.maxHp; p.iframe = 0; G.grabGrace = 0;
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z); e.state = "wind"; e.atk = e.def.atks.roll; e.t = 0; };
  const grab = () => DF.sim(e.atk.wind + e.atk.act + 0.2, () => { if (p.state === "held") return false; });`;
const rstep = (name, body) => cstep(name, `${rolling}\n${body}`);
const rollSteps = [
  rstep("the death roll drags the player into the water", `
  place(); const n = grab(), by = p.hold && p.hold.by === e, hold = p.hold && { dps: p.hold.dps, speed: p.hold.speed }, wet = e.wet;
  const h0 = p.hp; DF.sim(1); const water = w.waterAt(p.x, p.z), lost = h0 - p.hp, still = p.state;
  return { pass: n <= (e.def.atks.roll.wind + e.def.atks.roll.act) * 60 + 1 && by && hold.dps === C.rollDps && hold.speed === C.dragSpeed && wet === true &&
    still === "held" && water >= 0.5 && Math.abs(lost - C.rollDps) <= C.rollDps * H.tick + 0.01, n, by, hold, wet, water, lost, still };`),
  rstep("mashing dodge breaks the roll", `
  place(); grab(); const held = p.state;
  const n = DF.sim(H.max, (i) => { if (p.state !== "held") return false; if (i % 6 === 0) DF.taps[DF.BIND.dodge] = true; });
  const cd = e.rollCD, st = e.state;
  const c = { p, w, dx: Math.sin(e.yaw) * 3.5, dz: Math.cos(e.yaw) * 3.5, dist: 3.5, toP: e.yaw, alive: true };
  const roll = e.def.atks.roll, count = () => { let k = 0; for (let i = 0; i < 200; i++) if (DF.chooseAtk(e, 3.5, c) === roll) k++; return k; };
  const during = count(); DF.sim(1, keep); const cd1 = e.rollCD, later = count();
  e.rollCD = 0; const after = count();
  return { pass: held === "held" && n < H.max * 60 - 10 && p.state !== "held" && st !== "hold" && Math.abs(cd - C.rollCD) < 0.05 && Math.abs(cd1 - (C.rollCD - 1)) < 0.05 &&
    during === 0 && later === 0 && after > 0, held, n, cd, cd1, st, during, later, after };`),
  rstep("it climbs back out and fights on", `
  place(); const L0 = e.landT; let steps = grab(), wentIn = false;
  const track = () => { if (w.waterAt(e.x, e.z) >= 0.5) wentIn = true; };
  steps += DF.sim(H.max + 0.2, () => { if (p.state !== "held") return false; track(); });
  const ended = p.state, cd = e.rollCD;
  const n = until(() => !e.wet && w.waterAt(e.x, e.z) < 0.5, 3, track); steps += n;
  const res = { n: n / 60, wet: e.wet, water: w.waterAt(e.x, e.z), mode: e.mode, landT: e.landT, want: L0 - steps / 60, state: e.state };
  return { pass: ended !== "held" && cd > 0 && wentIn && n < 3 * 60 && res.wet === false && res.water < 0.5 && res.mode === "land" && Math.abs(res.landT - res.want) < 0.02,
    ended, wentIn, ...res };`),
  rstep("a roll beside a wall or rubble", `
  // rubble across the way from the player straight out to the moat: 6 m long (the way round is
  // too long for one hold) and 2 m long (dragged round it)
  const run = (half) => {
    w.addRock(at(21.6, -half).x, at(21.6, -half).z, at(21.6, half).x, at(21.6, half).z, 0.4);
    try {
      place(); const g = { x: p.x, z: p.z }, n = grab(), held = p.state === "held";
      const t = held ? { x: p.hold.tx, z: p.hold.tz } : null, own = !!t && Math.hypot(t.x - g.x, t.z - g.z) < 0.01;
      const tw = t && { water: w.waterAt(t.x, t.z), field: w.fieldAt(t.x, t.z), sight: w.los(g.x, g.z, t.x, t.z) };
      DF.sim(H.max + 0.2, () => { if (p.state !== "held") return false; });
      const f = { x: p.x, z: p.z }, field = w.fieldAt(f.x, f.z), toT = t && Math.hypot(f.x - t.x, f.z - t.z), toG = Math.hypot(f.x - g.x, f.z - g.z);
      const okT = held && (own || (tw.water >= 0.5 && tw.field >= p.r && tw.sight));
      const L = t ? Math.hypot(t.x - g.x, t.z - g.z) : 0;
      // the target, or the player's own spot, and never inside rock
      const ok = held && okT && L <= H.max * C.dragSpeed && field >= p.r * 0.9 && (own ? toG < 0.35 : toT < 0.35);
      return { ok, held, own, tw, field, L, toT, toG };
    } finally { w.clearRocks(); }
  };
  const long = run(3), short = run(1);
  return { pass: long.ok && short.ok && long.own && !short.own, long, short, pr: p.r };`),
  rstep("dying in the roll resets it", `
  place(); grab(); const held = p.state; p.hp = 1; DF.sim(1); const dead = p.state;
  DF.respawn(); G.manual = true; const f = G.enemies.find((o) => o.type === "croc"); put(out); DF.sim(0.1, keep);
  const re = { mode: f.mode, hidden: f.hidden, hp: f.hp === f.def.hp, hold: p.hold, pstate: p.state, fstate: f.state, rolling: !!f.rolling };
  return { pass: held === "held" && dead === "dead" && re.mode === "wait" && re.hidden && re.hp && re.hold === null && re.pstate !== "held" && re.fstate !== "hold", held, dead, re };`),
  { ...rstep("mid-roll, for looking at", `
  place(); grab(); DF.sim(0.6);
  // across the drag, the crocodile beside the player and the moat beyond; it turns over as G.t runs
  DF.poseEnemy(e); const r0 = e.fig.spin.r[2]; G.t += 0.1; DF.poseEnemy(e); const r1 = e.fig.spin.r[2];
  p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z) - 0.9; cam.pitch = 0.4; cam.px = p.x; cam.pz = p.z;
  return { pass: p.state === "held" && e.state === "hold" && Math.abs(r1 - r0) > 0.5, pstate: p.state, estate: e.state, r0, r1 };`), wait: 500, shot: "t25-roll" },
];
// ---- the 25% marks ----
// up on land and done with its rearing slam, the player in front of it
const landed = `begin(); until(() => e.mode === "land", 25); until(() => e.state === "chase", 3);
  const H = DF.HOLD, front = (d) => put({ x: e.x + Math.sin(e.yaw) * d, z: e.z + Math.cos(e.yaw) * d });`;
const mstep = (name, body) => cstep(name, `${landed}\n${body}`);
const markSteps = [
  mstep("no hit passes a mark", `
  const post0 = e.posture; DF.hitEnemy(e, 500, 30, { heavy: true }); const melee = e.hp, post = e.posture - post0;
  e.hp = 601; DF.hitEnemy(e, 50, 0, { dot: true }); const dot = e.hp;
  e.hp = 601; DF.explode(e.x, e.z, 3, 50, 0, [1, 1, 1]); const blast = e.hp;
  // a multiplier after the hook (berserk) still stops at the mark
  e.hp = 601; p.buff = "berserk"; DF.hitEnemy(e, 50, 0, { src: "melee" }); p.buff = null; const berserk = e.hp;
  // a shot
  e.hp = 601; DF.hitEnemy(e, 50, 0, { src: "proj", sx: p.x, sz: p.z }); const shot = e.hp;
  return { pass: melee === 600 && dot === 600 && blast === 600 && berserk === 600 && shot === 600 && post === 30 && !e.dead,
    melee, dot, blast, berserk, shot, post };`),
  mstep("a mark breaks off and leaps", `
  front(3); p.iframe = 0; e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
  e.state = "wind"; e.atk = e.def.atks.b1; e.t = e.atk.wind * 0.6; e.cd = 0;
  DF.hitEnemy(e, 300, 0, {}); const hp = e.hp; DF.sim(1 / 60);
  const next = { marks: e.marks, mode: e.mode, state: e.state, atk: e.atk, aloft: e.aloft, safe: e.safe };
  const h0 = p.hp; let lost = 0;
  DF.sim(C.leapT + 0.5, () => { lost = Math.max(lost, h0 - p.hp); if (e.mode === "tunnel") return false; });
  return { pass: hp === 600 && next.marks === 1 && next.mode === "leap" && next.atk === null && next.aloft && next.safe && lost === 0 && e.mode === "tunnel",
    hp, next, lost, mode: e.mode };`),
  rstep("a mark ends the death roll", `
  place(); grab(); const held = p.state;
  e.hp = 601; DF.hitEnemy(e, 50, 0, {}); DF.sim(1 / 60);
  const r = { pstate: p.state, hold: p.hold, iframe: p.iframe, grace: G.grabGrace, marks: e.marks, mode: e.mode, estate: e.state, rolling: e.rolling, rollCD: e.rollCD };
  return { pass: held === "held" && r.pstate !== "held" && r.hold === null && r.iframe >= H.safe - 2 / 60 && r.grace > H.grace - 2 / 60 &&
    r.marks === 1 && r.mode === "leap" && r.estate !== "hold" && !r.rolling && Math.abs(r.rollCD - C.rollCD) < 0.05, held, ...r };`),
  mstep("a mark's tunnel phase passes no second mark", `
  // a mark reached on land: it leaps, and hits all through the phase stop at the cap below it
  DF.hitEnemy(e, 300, 0, {}); DF.sim(1 / 60, keep);
  const m0 = { marks: e.marks, mode: e.mode, hp: e.hp };
  const seen = [], modes = {}; let n = 0;
  if (e.mode === "leap") { DF.hitEnemy(e, 500, 0, { heavy: true }); seen.push(e.hp); n++; }
  DF.sim(40, () => { keep(); if (e.mode === "under") return false; modes[e.mode] = 1;
    // hidden and safe would refuse the hits before the floor is read: lifted for them
    const sf = e.safe, hd = e.hidden; e.safe = e.hidden = false;
    DF.hitEnemy(e, 150, 0, {}); seen.push(e.hp); n++;
    DF.hitEnemy(e, 50, 0, { dot: true }); seen.push(e.hp); DF.hitEnemy(e, 50, 0, { src: "proj", sx: p.x, sz: p.z }); seen.push(e.hp);
    e.safe = sf; e.hidden = hd; if (e.marks !== 1) seen.push("marks " + e.marks); });
  const under = { mode: e.mode, marks: e.marks, hp: e.hp };
  // up again, the next mark is open
  until(() => e.mode === "land", 25); DF.hitEnemy(e, 500, 0, { heavy: true }); const next = e.hp;
  const lo = 600 - C.tunCap;
  return { pass: m0.marks === 1 && m0.mode === "leap" && m0.hp === 600 && n >= 1 && seen.every((v) => v >= lo) && seen.includes(lo) && modes.leap && modes.tunnel && modes.drop &&
    under.mode === "under" && under.marks === 1 && under.hp === lo && next === 400, m0, n, modes, bad: seen.filter((v) => !(v >= lo)).slice(0, 4), under, next };`),
  mstep("the marks fall at 75, 50 and 25 and then it can die", `
  const got = [];
  try {
    for (let k = 0; k < 3; k++) {
      if (k) { until(() => e.mode === "under", 40); until(() => e.mode === "land", 25); }
      const up = e.mode === "land" && !e.hidden;
      DF.hitEnemy(e, 500, 0, { heavy: true }); const hp = e.hp; DF.sim(1 / 60, keep);
      got.push({ up, hp, marks: e.marks, mode: e.mode });
    }
    until(() => e.mode === "under", 40); until(() => e.mode === "land", 25);
    G.msgs = []; const hp = e.hp; DF.hitEnemy(e, 500, 0, { heavy: true }); await draw();
    const text = document.getElementById("msgs").textContent;
    const end = { hp, dead: !!e.dead, bossDead: G.bossDead, cleared: DF.gradeCleared("D"), fell: text.includes("OLD SLUICEJAW FALLS"), gate: text.includes("new gate") };
    const want = [600, 400, 200];
    const ok = got.length === 3 && got.every((q, k) => q.up && q.hp === want[k] && q.marks === k + 1 && q.mode === "leap");
    return { pass: ok && end.hp === 200 && end.dead && end.bossDead && end.cleared && end.fell && !end.gate, got, end };
  } finally { DF.resetCleared(); G.bossDead = false; }`),
  mstep("an execution at a mark", `
  front(2.5); e.hp = 610; DF.stagger(e); DF.startExecute(e);
  let early = false, n = 0, hpIn = null;
  DF.sim(2, () => { if (p.state !== "execute") return false; n++; keep(); if (p.exDone && hpIn === null) hpIn = e.hp; if (e.marks !== 0 || e.mode !== "land") early = true; });
  const done = p.exDone, hp = e.hp; DF.sim(1 / 60, keep);
  return { pass: done && hpIn === 600 && hp === 600 && !early && n >= 0.62 * 60 && e.marks === 1 && e.mode === "leap",
    done, hpIn, hp, early, n: n / 60, marks: e.marks, mode: e.mode };`),
];
// ---- the tunnel phase ----
// Up on land, as for the marks. W is the cavern's wall tunnels, mouthPt(i) mouth i pulled CROC.mouthIn
// toward the centre, leap() hits it to its next mark and runs the leap, plates() the plates in
// flight, two(n0, n1) makes the phase visit at least two mouths with n0 and n1 plates at the first
// two, view(i) a dry spot in front of mouth i and look(i) the hidden player there looking up at it.
// bolt() fires a player's shot into it from 4 m toward the centre; back(i) the same as a parried
// plate thrown from mouth i.
const tunnel = `${landed}
  // no ceiling falls in these steps (a heap between a mouth and the player is cover from its plates);
  // the ceiling has its own steps below
  e.fallT = 1e9;
  const W = w.wallTunnels, mouthPt = (i) => { const m = W[i]; return { x: m.x + Math.sin(m.yaw) * C.mouthIn, z: m.z + Math.cos(m.yaw) * C.mouthIn, y: m.y }; };
  const leap = () => { DF.hitEnemy(e, 300, 0, {}); return until(() => e.mode === "tunnel", C.leapT + 0.5); };
  const plates = () => G.projs.filter((q) => q.src === e && q.plate);
  const two = (n0 = 1, n1 = 1) => { const T = e.tun; if (T.list.length < 2) T.list = [T.list[0], (T.list[0] + 1) % W.length]; T.n = [n0, n1, ...T.n.slice(2, T.list.length)]; };
  const view = (i, d0 = 11) => { const m = W[i]; for (let d = d0; d < 24; d += 0.5) { const x = m.x + Math.sin(m.yaw) * d, z = m.z + Math.cos(m.yaw) * d;
    if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 1) return { x, z }; } return null; };
  const bolt = (dmg = 10, post = 5, extra = {}) => { const toC = Math.atan2(B.x - e.x, B.z - e.z), pr = { x: e.x + Math.sin(toC) * 4, y: 1.2, z: e.z + Math.cos(toC) * 4,
    vx: -Math.sin(toC) * 30, vz: -Math.cos(toC) * 30, life: 2, own: "p", dmg, post, kind: "bolt", c: [1, 1, 1], ...extra }; G.projs.push(pr); return pr; };
  const back = (mouth) => bolt(30, 30, { kind: "reflect", heavy: true, plate: true, mouth, src: e });
  const look = (i, side = 0.25, pitch = -0.22) => { const m = W[i]; put(view(i)); p.yaw = cam.yaw = Math.atan2(m.x - p.x, m.z - p.z) + side; cam.pitch = pitch; cam.px = p.x; cam.pz = p.z; p.fig.root.s = [0.0001, 0.0001, 0.0001]; };`;
const tstep = (name, body) => cstep(name, `${tunnel}\n${body}`);
const tunnelSteps = [
  tstep("a mark leaps into a tunnel", `
  DF.hitEnemy(e, 300, 0, {}); DF.sim(1 / 60, keep);
  const first = { mode: e.mode, aloft: e.aloft, safe: e.safe, hp: e.hp };
  const n = 1 + until(() => e.mode === "tunnel", C.leapT + 0.5);
  const T = e.tun, i = T && T.list[T.k], q = i !== undefined ? mouthPt(i) : null, d = q ? Math.hypot(e.x - q.x, e.z - q.z) : null;
  return { pass: W.length >= 3 && first.mode === "leap" && first.aloft === true && first.safe === true && first.hp === 600 && e.mode === "tunnel" && n <= (C.leapT + 0.1) * 60 &&
    T.k === 0 && T.sub === "show" && d < 0.05 && e.y === q.y && e.aloft === true && !e.safe && !e.hidden,
    mouths: W.length, first, n: n / 60, d, y: e.y, aloft: e.aloft, sub: T && T.sub };`),
  tstep("plates per tunnel follow the mark", `
  const W4 = Math.min(4, W.length), bad = [], seen = { 1: {}, 2: {}, 3: {} }, lens = {};
  for (const m of [1, 2, 3]) {
    e.marks = m; const top = m === 1 ? 2 : 4;
    for (let i = 0; i < 200; i++) {
      const q = DF.crocMouthPlan(e, w);
      const ok = q.list.length >= 1 && q.list.length <= W4 && new Set(q.list).size === q.list.length && q.list.every((k) => Number.isInteger(k) && k >= 0 && k < W.length) &&
        q.n.length === q.list.length && q.n.every((v) => Number.isInteger(v) && v >= 1 && v <= top);
      if (!ok) bad.push({ m, q }); for (const v of q.n) seen[m][v] = 1; lens[q.list.length] = 1;
    }
  }
  e.marks = 0;
  const all = (o, k) => { for (let v = 1; v <= k; v++) if (!o[v]) return false; return true; };
  return { pass: bad.length === 0 && all(seen[1], 2) && !seen[1][3] && all(seen[2], 4) && all(seen[3], 4) && all(lens, W4), mouths: W.length, seen, lens, bad: bad.slice(0, 3) };`),
  tstep("it throws real plates at the player", `
  // a passive player on the ring pinned to the spot, then the same player guarding through the next phase
  const run = (guard) => {
    const q = { x: p.x, z: p.z }; leap();
    const total = e.tun.n.reduce((a, b) => a + b, 0), mouthY = W[e.tun.list[0]].y, got = new Map(), drops = [];
    let h = p.hp, parried = 0, gT = 1e9;
    // through the phase and until its last plate is gone, before it can come up again
    DF.sim(45, () => {
      if (p.hp < h) { drops.push(h - p.hp); if (guard) gT = Math.min(gT, p.guardT); }
      p.hp = p.maxHp; p.stam = p.maxStam; h = p.hp;
      if (e.mode === "under" && plates().length === 0) return false;
      p.x = q.x; p.z = q.z; p.kx = p.kz = 0;
      if (guard) { DF.keys[DF.BIND.guard] = true; p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z); }
      for (const pr of G.projs) {
        if (pr.src !== e) continue;
        if (!got.has(pr)) got.set(pr, { own: pr.own, kind: pr.kind, plate: pr.plate, dmg: pr.dmg, speed: Math.hypot(pr.vx, pr.vz), y0: pr.y, y1: pr.y, fell: true });
        else { const g = got.get(pr); if (pr.y > g.y1 + 1e-9) g.fell = false; g.y1 = pr.y; }
        if (pr.kind === "reflect") parried++;
      }
    });
    DF.keys[DF.BIND.guard] = false;
    const all = [...got.values()];
    const shape = all.every((g) => g.own === "e" && g.kind === "plate" && g.plate === true && g.dmg === C.plateDmg && Math.abs(g.speed - C.plateSpeed) < 1e-6 &&
      g.y0 <= mouthY + 1e-6 && g.y0 > mouthY - 1 && g.fell && g.y1 >= 1 && g.y1 < 1.6);
    return { total, thrown: all.length, shape, drops: drops.map((v) => +v.toFixed(3)), parried, gT, mode: e.mode, ys: all.slice(0, 2).map((g) => [+g.y0.toFixed(2), +g.y1.toFixed(2)]) };
  };
  const open = run(false);
  until(() => e.mode === "land", 25); until(() => e.state === "chase", 3);
  const guard = run(true), chip = C.plateDmg * p.cls.chip;
  const ok = (r, v) => r.thrown === r.total && r.shape && r.drops.length === r.total && r.drops.every((d) => Math.abs(d - v) < 0.01) && r.parried === 0;
  return { pass: ok(open, C.plateDmg) && ok(guard, chip) && guard.gT > p.parryWin, open, guard, chip };`),
  tstep("the next mouth warns first", `
  leap(); two(1, 1); const sub0 = e.tun.sub;
  until(() => e.tun.sub === "warn", 10);
  const at = { k: e.tun.k, hidden: e.hidden, d: Math.hypot(e.x - mouthPt(e.tun.list[1]).x, e.z - mouthPt(e.tun.list[1]).z) };
  let threw = null; try { DF.drawMouths(); } catch (x) { threw = x.message; } await draw();
  let hid = true; const n = 1 + DF.sim(3, () => { if (e.tun.sub !== "warn") return false; if (!e.hidden) hid = false; keep(); });
  const shown = { k: e.tun.k, sub: e.tun.sub, hidden: e.hidden, plates: e.tun.plates };
  return { pass: sub0 === "show" && at.k === 1 && at.hidden && at.d < 0.05 && threw === null && hid && Math.abs(n - C.mouthWarn * 60) <= 1 && shown.k === 1 && shown.sub === "show" && !shown.hidden,
    sub0, at, threw, n: n / 60, hid, shown };`),
  tstep("no parry: it drops back unhurt", `
  DF.hitEnemy(e, 300, 0, {}); const hp0 = e.hp;
  let total = null, last = null, dropN = 0, atDrop = null; const seq = [], seen = new Set();
  DF.sim(45, () => { keep(); if (e.mode === "under") return false;
    if (total === null && e.tun) total = e.tun.n.reduce((a, b) => a + b, 0);
    for (const pr of plates()) seen.add(pr);
    if (e.mode !== last) { seq.push(e.mode); last = e.mode; if (e.mode === "drop") atDrop = seen.size; }
    if (e.mode === "drop") dropN++; });
  const end = { mode: e.mode, hp: e.hp, aloft: e.aloft, y: e.y, hidden: e.hidden, safe: e.safe, tun: e.tun, water: w.waterAt(e.x, e.z) };
  return { pass: seq.join() === "land,leap,tunnel,drop" && atDrop === total && total >= 1 && Math.abs(dropN - C.dropT * 60) <= 1 &&
    end.mode === "under" && end.hp === hp0 && hp0 === 600 && end.aloft === false && end.y === 0 && end.hidden && !end.safe && end.tun === null && end.water >= 0.5,
    seq, total, atDrop, dropN: dropN / 60, end: { ...end, tun: !!end.tun } };`),
  tstep("nothing but shots reaches it up there", `
  leap(); e.tun.t = 99; const q = mouthPt(e.tun.list[0]);
  // the player in the fall pool under the mouth, facing it
  let pool = null, bd = 1e9;
  for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) { const x = q.x + i * 0.5, z = q.z + j * 0.5, d = Math.hypot(x - q.x, z - q.z);
    if (d < bd && w.waterAt(x, z) >= 0.5 && w.fieldAt(x, z) >= 0.7) { bd = d; pool = { x, z }; } }
  put(pool); const face = () => { p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z); };
  const hp0 = e.hp, at = { x: e.x, z: e.z };
  let flashed = false, locked = false, swung = false;
  const clean = () => { e.flash = 0; e.posture = 0; flashed = false; };
  const watch = () => { keep(); e.tun.t = 99; if (e.flash > 0) flashed = true; if (p.lock === e) locked = true; if (p.state === "attack") swung = true; };
  const touched = () => flashed || e.flash > 0 || e.hp !== hp0 || e.posture !== 0 || Math.hypot(e.x - at.x, e.z - at.z) > 1e-6 || e.state === "fall" || e.state === "stagger";
  const r = {};
  clean(); face(); DF.taps[DF.BIND.light] = true; DF.sim(0.8, watch); r.melee = touched();
  clean(); DF.explode(e.x, e.z, 3, 50, 30, [1, 1, 1]); r.blast = touched();
  p.lock = null; face(); r.grapple = DF.grappleTarget() === e; r.lock = DF.pickLock() === e;
  const base = cam.yaw + 0.3; r.aim = DF.aimYaw(base, 6, 1.2) !== base;
  const st0 = e.state; e.state = "stagger"; r.exec = DF.nearestStaggered() === e; e.state = st0;
  p.lock = e; DF.sim(1 / 60, watch); r.lockKept = p.lock === e; locked = false;
  clean(); DF.startDrop(e.x, e.z); DF.sim(DF.DROP.fuse + 0.4, watch); r.drop = touched(); G.holes = [];
  clean(); DF.plantMine(e.x, e.z); DF.sim(DF.MINE.arm + 0.5, watch); r.mine = touched() || G.mines.some((m) => m.fuse !== null); G.mines = [];
  clean(); DF.startCaveIn(e.x, e.z); DF.sim(DF.CAVEIN.fuse + 0.3, watch); r.cavein = touched(); w.clearRocks(); G.caveins = [];
  put(pool); p.x = e.x; p.z = e.z + 0.4; const b = { x: p.x, z: p.z }; DF.separate(); r.pushed = Math.hypot(p.x - b.x, p.z - b.z) > 1e-6;
  // but a shot does: aimRanged finds it and a player's bolt into it lands
  put(pool); face(); const ar = Math.abs(DF.angDiff(DF.aimRanged(), Math.atan2(e.x - p.x, e.z - p.z))) < 0.05;
  clean(); const toC = Math.atan2(w.boss.x - e.x, w.boss.z - e.z), sx = e.x + Math.sin(toC) * 4, sz = e.z + Math.cos(toC) * 4;
  G.projs.push({ x: sx, y: 1.2, z: sz, vx: -Math.sin(toC) * 30, vz: -Math.cos(toC) * 30, life: 2, own: "p", dmg: 10, post: 5, kind: "bolt", c: [1, 1, 1] });
  DF.sim(0.3, watch); const shot = flashed;
  const reached = Object.keys(r).filter((k) => r[k]);
  return { pass: reached.length === 0 && !locked && swung && ar && shot && e.mode === "tunnel" && e.aloft, reached, r, locked, swung, ar, shot, gap: Math.hypot(p.x - e.x, p.z - e.z), mode: e.mode };`),
  tstep("leaving mid phase resets it", `
  leap(); until(() => plates().length > 0, 10);
  const fly = plates()[0], had = plates().length;
  put(out); const n = until(() => e.mode === "wait", 1);
  const r = { n, mode: e.mode, aloft: e.aloft, y: e.y, tun: e.tun, hidden: e.hidden, safe: e.safe, flies: G.projs.includes(fly), only: G.projs.length === had && G.projs.every((q) => q.plate && q.src === e) };
  let hurt = 0, h = p.hp, more = 0; const known = new Set(G.projs);
  DF.sim(4, () => { if (p.hp < h) hurt += h - p.hp; h = p.hp; for (const pr of G.projs) if (!known.has(pr)) more++; });
  return { pass: n < 60 && r.mode === "wait" && r.aloft === false && r.y === 0 && r.tun === null && r.hidden && !r.safe && r.flies && r.only && hurt === 0 && more === 0 && G.projs.length === 0,
    r: { ...r, tun: !!r.tun }, hurt, more, left: G.projs.length };`),
  tstep("shots hurt it at a mouth", `
  leap(); two(1, 1); e.tun.t = 99; const hp0 = e.hp, post0 = e.posture, pr = bolt();
  DF.sim(0.3, () => { keep(); e.tun.t = 99; });
  const at = { hp: e.hp, post: e.posture, gone: !G.projs.includes(pr), stagger: e.state === "stagger" };
  // hidden at the next mouth, the same shot passes on
  e.tun.t = 0; until(() => e.tun.sub === "warn", 3); e.tun.t = 99;
  const hp1 = e.hp, wpr = bolt(); let minD = 1e9;
  DF.sim(0.3, () => { keep(); e.tun.t = 99; if (wpr.life > 0) minD = Math.min(minD, Math.hypot(wpr.x - e.x, wpr.z - e.z)); });
  return { pass: at.hp === hp0 - 10 && at.gone && at.post === post0 && !at.stagger && e.tun.sub === "warn" && e.hidden && e.hp === hp1 && minD < 1,
    hp0, at, hp1, hp: e.hp, minD };`),
  tstep("a tunnel phase takes at most tunCap", `
  // berserk on and a shot into it every step, through two whole phases
  const phase = () => {
    leap(); const hp0 = e.hp, next = e.def.hp * (1 - 0.25 * (e.marks + 1)), post0 = e.posture;
    let lo = e.hp, postUp = 0, stag = false; const modes = {};
    DF.sim(45, () => { keep(); p.buff = "berserk"; if (e.mode === "under") return false; modes[e.mode] = 1;
      bolt(); lo = Math.min(lo, e.hp); postUp = Math.max(postUp, e.posture - post0); if (e.state === "stagger") stag = true; });
    p.buff = null;
    return { hp0, lost: hp0 - lo, lo, next, postUp, stag, modes: Object.keys(modes).join(), end: e.mode };
  };
  try {
    const a = phase(); until(() => e.mode === "land", 25); until(() => e.state === "chase", 3);
    const b = phase();
    const ok = (r) => r.lost === C.tunCap && r.lo >= r.next && r.postUp === 0 && !r.stag && r.modes === "tunnel,drop" && r.end === "under";
    return { pass: ok(a) && ok(b) && a.hp0 === 600 && b.hp0 === 400, a, b };
  } finally { p.buff = null; }`),
  tstep("a plate reaches a player right under the mouth", `
  leap(); e.tun.n[0] = 1;
  // the player as near under it as the floor lets them stand, nearer than a plate starts out
  let q = null, bd = 1e9;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const x = e.x + i * 0.25, z = e.z + j * 0.25, d = Math.hypot(x - e.x, z - e.z);
    if (d < bd && w.fieldAt(x, z) >= p.r) { bd = d; q = { x, z }; } }
  put(q); let hurt = 0, hits = 0, h = p.hp;
  DF.sim(3, () => { p.x = q.x; p.z = q.z; p.kx = p.kz = 0; if (p.hp < h) { hurt += h - p.hp; hits++; } p.hp = p.maxHp; h = p.hp;
    if (e.tun && e.tun.plates >= 1 && plates().length === 0) return false; });
  return { pass: bd < e.r + 0.3 && hits === 1 && Math.abs(hurt - C.plateDmg) < 0.01, bd, hits, hurt };`),
  tstep("a parried plate knocks it down", `
  leap(); const i0 = e.tun.list[0]; e.tun.n[0] = 1; const q = view(i0); put(q);
  const hp0 = e.hp; let rf = null, tR = 0, ys = [], landN = 0;
  DF.keys[DF.BIND.guard] = true;
  DF.sim(8, () => { keep(); p.x = q.x; p.z = q.z; p.kx = p.kz = 0; p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z); p.guardT = 0;
    if (!rf) rf = G.projs.find((pr) => pr.src === e && pr.plate && pr.own === "p") || null;
    if (rf) { tR++; if (rf.life > 0 && G.projs.includes(rf)) ys.push(rf.y); }
    if (e.mode === "land") return false; });
  DF.keys[DF.BIND.guard] = false;
  const rose = ys.length > 2 && ys.every((y, k) => !k || y >= ys[k - 1] - 1e-9) && ys[ys.length - 1] > 3;
  const T = e.tun, r = { mode: e.mode, state: e.state, y: e.y, aloft: e.aloft, safe: e.safe, hidden: e.hidden, knocked: T && T.knocked, landT: e.landT,
    water: w.waterAt(e.x, e.z), field: w.fieldAt(e.x, e.z), fromC: Math.hypot(e.x - B.x, e.z - B.z), lost: hp0 - e.hp };
  return { pass: !!rf && rf.kind === "reflect" && rf.plate === true && rf.mouth === i0 && tR <= 2 * 60 && rose &&
    r.mode === "land" && r.state === "stagger" && r.y === 0 && !r.aloft && !r.safe && !r.hidden && r.knocked === true && r.landT === C.land &&
    r.water < 0.5 && r.field >= e.r && r.fromC < B.r && r.lost > 0 && r.lost <= C.tunCap,
    rf: rf && { kind: rf.kind, plate: rf.plate, mouth: rf.mouth, i0 }, tR: tR / 60, rose, ys: ys.filter((_, k) => k % 6 === 0).map((y) => +y.toFixed(2)), r };`),
  tstep("one knock-down per phase and only at its mouth", `
  leap(); two(1, 1); const i0 = e.tun.list[0], i1 = e.tun.list[1];
  e.tun.t = 0; until(() => e.tun.k === 1 && e.tun.sub === "show", 5); e.tun.t = 99;
  // a parried plate from the mouth it has left reaches it at the next: a hit, no knock-down
  const hp0 = e.hp; back(i0); DF.sim(0.3, () => { keep(); e.tun.t = 99; });
  const other = { mode: e.mode, knocked: e.tun.knocked, lost: hp0 - e.hp, aloft: e.aloft };
  // one from this mouth knocks it down
  back(i1); DF.sim(0.3, () => { keep(); e.tun.t = 99; if (e.mode !== "tunnel") return false; });
  const T = e.tun, fall = { mode: e.mode, knocked: T.knocked, px: T.px, pz: T.pz, modeT: e.modeT };
  // a second in the fall changes nothing (safe lifted so the hook sees it)
  e.safe = false; DF.hitEnemy(e, 30, 30, { src: "reflect", heavy: true, plate: true, mouth: i1 }); e.safe = true;
  const fall2 = { mode: e.mode, px: T.px, pz: T.pz, modeT: e.modeT };
  until(() => e.mode === "land", 2);
  // nor once it is down
  const down = { t: e.t, x: e.x, z: e.z, state: e.state };
  DF.hitEnemy(e, 30, 30, { src: "reflect", heavy: true, plate: true, mouth: i1 }); DF.sim(1 / 60, keep);
  const after = { mode: e.mode, state: e.state, dt: e.t - down.t, moved: Math.hypot(e.x - down.x, e.z - down.z), y: e.y, aloft: e.aloft };
  return { pass: other.mode === "tunnel" && other.knocked === false && other.lost === 30 && other.aloft &&
    fall.mode === "drop" && fall.knocked === true && fall2.mode === "drop" && fall2.px === fall.px && fall2.pz === fall.pz && fall2.modeT === fall.modeT &&
    down.state === "stagger" && after.mode === "land" && after.state === "stagger" && Math.abs(after.dt - 1 / 60) < 1e-6 && after.moved < 1e-6 && after.y === 0 && !after.aloft,
    other, fall, fall2, down, after };`),
  tstep("it waits at its mouth for a plate parried back from it", `
  leap(); two(1, 1); const i0 = e.tun.list[0];
  // its last plate here thrown and about to move on, a parried one 20 m out on its way back
  e.tun.plates = e.tun.n[0]; e.tun.t = 1 / 60;
  const toC = Math.atan2(B.x - e.x, B.z - e.z), far = (d, a) => ({ x: e.x + Math.sin(toC) * d, y: 1.25, z: e.z + Math.cos(toC) * d, vx: Math.sin(a) * 24, vz: Math.cos(a) * 24,
    life: 2, own: "p", dmg: 30, post: 30, kind: "reflect", heavy: true, plate: true, mouth: i0, src: e, c: [1, 1, 1] });
  G.projs.push(far(20, toC + Math.PI)); let stayed = true;
  DF.sim(1.5, () => { keep(); if (e.mode !== "tunnel") return false; if (e.tun.k !== 0 || e.tun.sub !== "show") stayed = false; });
  const hit = { mode: e.mode, knocked: e.tun.knocked, stayed };
  // a plate of its own from here that never arrives holds it no longer than CROC.plateWait past the linger
  until(() => e.mode === "land", 2); until(() => e.state === "chase", 6); until(() => e.mode === "under", 30); until(() => e.mode === "land", 25);
  leap(); two(1, 1); e.tun.plates = e.tun.n[0]; e.tun.t = 1 / 60; const j0 = e.tun.list[0];
  const slow = { ...far(2, toC), vx: Math.sin(toC) * 0.5, vz: Math.cos(toC) * 0.5, life: 99, own: "e", kind: "plate", mouth: j0 }; G.projs.push(slow); let left = 0;
  DF.sim(C.plateWait + 1, () => { keep(); left++; if (e.tun.k === 1) return false; });
  return { pass: hit.stayed && hit.mode === "drop" && hit.knocked === true && e.tun.k === 1 && !e.tun.knocked && G.projs.includes(slow) && Math.abs(left / 60 - C.plateWait) < 0.05,
    hit, k: e.tun.k, left: left / 60 };`),
  tstep("a real parry from across the cavern knocks it down", `
  leap(); const i0 = e.tun.list[0], m = W[i0]; e.tun.n[0] = 1;
  // the player about 30 m from the mouth on dry floor, guarding with a fresh parry as its one plate arrives
  let q = null; for (let d = 30; d < 46 && !q; d += 0.5) for (const da of [0, 0.15, -0.15, 0.3, -0.3]) { const x = m.x + Math.sin(m.yaw + da) * d, z = m.z + Math.cos(m.yaw + da) * d;
    if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 1 && w.los(x, z, mouthPt(i0).x, mouthPt(i0).z)) { q = { x, z }; break; } }
  put(q); const dist = Math.hypot(q.x - m.x, q.z - m.z);
  let rf = null, stayed = true, thrown = 0;
  DF.keys[DF.BIND.guard] = true;
  DF.sim(10, () => { keep(); p.x = q.x; p.z = q.z; p.kx = p.kz = 0; p.yaw = cam.yaw = Math.atan2(e.x - p.x, e.z - p.z); p.guardT = 0;
    thrown = Math.max(thrown, e.tun ? e.tun.plates : 0);
    if (e.mode === "tunnel" && (e.tun.k !== 0 || e.tun.sub !== "show")) stayed = false;
    if (!rf) rf = G.projs.find((pr) => pr.src === e && pr.plate && pr.own === "p") || null;
    if (e.mode === "land") return false; });
  DF.keys[DF.BIND.guard] = false;
  return { pass: dist >= 28 && thrown === 1 && !!rf && rf.kind === "reflect" && rf.mouth === i0 && stayed && e.mode === "land" && e.state === "stagger" && e.tun.knocked === true && e.y === 0,
    dist, thrown, rf: !!rf, stayed, mode: e.mode, state: e.state };`),
  tstep("knocked down, the land fight carries on", `
  leap(); const i0 = e.tun.list[0]; e.tun.t = 99; back(i0);
  until(() => e.mode === "land", 2);
  const knocked = e.mode === "land" && e.state === "stagger";
  // open to an execution: the player beside it finds it
  let side = null; for (let k = 0; k < 32 && !side; k++) { const a = (k / 32) * Math.PI * 2, x = e.x + Math.sin(a) * (e.r + 1.2), z = e.z + Math.cos(a) * (e.r + 1.2);
    if (w.fieldAt(x, z) >= p.r && w.los(e.x, e.z, x, z)) side = { x, z }; } put(side);
  const near = Math.hypot(p.x - e.x, p.z - e.z), exec = DF.nearestStaggered() === e;
  // the stagger ends and it fights on, then dives on its land clock
  put(view(i0, 14)); const n0 = until(() => e.state !== "stagger", 6);
  const fought = { state: e.state, mode: e.mode };
  let leapt = false; const n1 = until(() => e.mode === "dive" || e.mode === "under", 30, () => { if ((e.mode === "leap" || e.mode === "tunnel" || e.mode === "drop")) leapt = true; });
  return { pass: knocked && exec && fought.mode === "land" && fought.state !== "stagger" && (e.mode === "dive" || e.mode === "under") && !leapt && e.marks === 1 && !e.aloft,
    knocked, near, exec, stag: n0 / 60, fought, toDive: n1 / 60, mode: e.mode, marks: e.marks, landT: e.landT, outT: e.outT };`),
  // for looking at: the warning at a mouth, and it at a mouth mid whip with a plate in the air
  { ...tstep("the warning at a mouth, for looking at", `
  leap(); two(1, 1); until(() => e.tun.sub === "warn", 10); DF.sim(C.mouthWarn * 0.6, keep);
  look(e.tun.list[1]);
  return { pass: e.tun.sub === "warn" && e.hidden, sub: e.tun.sub };`), wait: 500, shot: "t25-mouth-warn" },
  { ...tstep("at a mouth mid whip, for looking at", `
  leap(); e.tun.n[0] = 3; look(e.tun.list[0]);
  until(() => plates().length > 0, 3); DF.sim(0.1, keep);
  // its poses up there are all finite
  const f = e.fig, finite = () => { let ok = true; (function rec(n) { for (const v of [...n.p, ...n.r, ...n.s]) if (!Number.isFinite(v)) ok = false; n.ch.forEach(rec); })(f.root); return ok; };
  let fin = true; const T = e.tun, keepT = T.t;
  for (const t of [C.throwWind, C.throwWind * 0.5, 0.01, C.throwGap - 0.1]) { T.t = t; DF.poseEnemy(e); if (!finite()) fin = false; }
  T.t = keepT; DF.poseEnemy(e);
  return { pass: fin && e.mode === "tunnel" && T.sub === "show" && plates().length === 1, fin, plates: plates().length, y: plates()[0] && plates()[0].y };`), wait: 500, shot: "t25-mouth-throw" },
  { ...tstep("knocked down mid fall, for looking at", `
  leap(); const i0 = e.tun.list[0]; e.tun.t = 99; look(i0, 0.1, -0.12); back(i0);
  until(() => e.mode === "drop", 1); DF.sim(C.dropT * 0.45, keep);
  const f = e.fig, finite = () => { let ok = true; (function rec(n) { for (const v of [...n.p, ...n.r, ...n.s]) if (!Number.isFinite(v)) ok = false; n.ch.forEach(rec); })(f.root); return ok; };
  let fin = true; const m0 = e.modeT; for (const t of [C.dropT, C.dropT * 0.5, 0]) { e.modeT = t; DF.poseEnemy(e); if (!finite()) fin = false; } e.modeT = m0; DF.poseEnemy(e);
  return { pass: fin && e.mode === "drop" && e.tun.knocked === true, fin, y: e.y };`), wait: 500, shot: "t25-knock" },
  step("the player is put back", `G.player.fig.root.s = [1, 1, 1]; DF.newRun(99); return { pass: true };`),
];
// ---- the falling ceiling ----
// Up on land, as for the marks. drop(x, z) brings a chunk down there (DF.crocDropChunk), fall(k)
// runs the steps until it has landed and returns them, crossD(x, z) is how far a point is from
// the entrance crossing (the dry gap in the moat where the one tunnel comes in, worked out here
// from the tunnel's own points), away() sends the crocodile under at the far side to wait, dryIn(x,
// z) is true when no water is within CROC.rockR on a 0.1 m lattice, and footAt(x, z) the dry
// footing nearest a point within 3 m, as the crocodile's own check finds it.
const ceiling = `${landed}
  const drop = (x, z) => DF.crocDropChunk(x, z), fall = (k) => DF.sim(C.fallWarn + 0.5, () => { if (k.id) return false; });
  const L = w.path.length, ent = w.edges.find((q) => (q.a === B.id && q.b === w.path[L - 2]) || (q.b === B.id && q.a === w.path[L - 2]));
  const ep = ent.a === B.id ? ent.pts.slice().reverse() : ent.pts; let mo = ep[0];
  for (const q of ep) if (Math.hypot(q.x - B.x, q.z - B.z) >= B.r) mo = q; else break;
  const ea = Math.atan2(mo.x - B.x, mo.z - B.z), ex = Math.sin(ea), ez = Math.cos(ea), S = DF.SEWER;
  const crossD = (x, z) => { const dx = x - B.x, dz = z - B.z, al = dx * ex + dz * ez, ac = Math.abs(dx * ez - dz * ex);
    return Math.hypot(Math.max(0, B.r - S.moatW - al, al - B.r), Math.max(0, ac - S.crossW / 2)); };
  const away = () => { const sh = DF.crocShores(e, w); let f = sh[0], fd = 0; for (const q of sh) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d > fd) (fd = d), (f = q); }
    Object.assign(e, { mode: "under", hidden: true, modeT: 1e6, spot: f, path: null, state: "chase", atk: null, plan: null, wet: false, rolling: false }); };
  const dryIn = (x, z) => { for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) if (Math.hypot(i, j) * 0.1 <= C.rockR && w.waterAt(x + i * 0.1, z + j * 0.1) !== 0) return false; return true; };
  const footAt = (x, z) => { let b = null, bd = 1e9; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const qx = x + i * 0.5, qz = z + j * 0.5, d = Math.hypot(i, j) * 0.5;
    if (d <= 3 && d < bd && w.waterAt(qx, qz) < 0.5 && w.fieldAt(qx, qz) >= e.r && w.los(x, z, qx, qz)) (bd = d), (b = { x: qx, z: qz }); } return b; };`;
const kstep = (name, body) => cstep(name, `${ceiling}\n${body}`);
const ceilingSteps = [
  step("it finds the entrance crossing", `const bad = [], S = DF.SEWER;
  for (let s = 1; s <= 12; s++) { const w = DF.genSewer(s), B = w.boss, L = w.path.length;
    const ent = w.edges.find((q) => (q.a === B.id && q.b === w.path[L - 2]) || (q.b === B.id && q.a === w.path[L - 2]));
    const ep = ent.a === B.id ? ent.pts.slice().reverse() : ent.pts; let mo = ep[0];
    for (const q of ep) if (Math.hypot(q.x - B.x, q.z - B.z) >= B.r) mo = q; else break;
    const ea = Math.atan2(mo.x - B.x, mo.z - B.z), X = DF.crocCrossing({}, w), a = X && Math.atan2(X.bx - B.x, X.bz - B.z);
    const off = X ? Math.abs(Math.atan2(Math.sin(a - ea), Math.cos(a - ea))) : null;
    if (!X || off > 0.02 || X.hw < S.crossW / 2 || X.hw > S.crossW / 2 + 1.5 || Math.abs(Math.hypot(X.bx - X.ax, X.bz - X.az) - S.moatW) > 1e-6) bad.push({ s, off, hw: X && X.hw }); }
  return { pass: bad.length === 0, bad };`),
  kstep("no ceiling before half health", `
  const list = Array.isArray(G.chunks); let most = 0;
  e.marks = 0; DF.sim(30, () => { keep(); most = Math.max(most, G.chunks ? G.chunks.length : 0); });
  e.marks = 1; e.hp = 600; DF.sim(30, () => { keep(); most = Math.max(most, G.chunks ? G.chunks.length : 0); });
  return { pass: list && most === 0 && e.marks === 1 && e.mode !== "wait", list, most, marks: e.marks, mode: e.mode };`),
  kstep("chunks fall on the dry ring with a warning", `
  e.marks = 2; e.hp = 400;
  // the player stands about the ring, a while beside the crossing's inner end
  const at = [ringAt(14), { x: B.x + ex * (B.r - S.moatW - 2.5), z: B.z + ez * (B.r - S.moatW - 2.5) }, ringAt(10, 2), ringAt(18, 4)];
  const seen = new Map(); let most = 0;
  DF.sim(60, (i) => { keep();
    for (const k of G.chunks) { if (!seen.has(k)) seen.set(k, { at: i, x: k.x, z: k.z, f: w.fieldAt(k.x, k.z), d: Math.hypot(k.x - p.x, k.z - p.z) });
      const s = seen.get(k); if (k.id && s.land === undefined) { s.land = i; s.f1 = w.fieldAt(k.x, k.z); } }
    most = Math.max(most, G.chunks.filter((k) => k.id).length);
    if (i % 900 === 0) put(at[(i / 900) % at.length]); });
  const all = [...seen.values()], bad = [];
  for (const s of all) {
    const why = [];
    if (!dryIn(s.x, s.z)) why.push("wet");
    if (Math.hypot(s.x - B.x, s.z - B.z) > B.r) why.push("out");
    if (s.f < C.rockR + 0.5 - 1e-6) why.push("tight");
    if (crossD(s.x, s.z) < 4 - 1e-6) why.push("crossing");
    if (s.d < 3 - 1e-6 || s.d > 8 + 1e-6) why.push("far");
    // one that appeared too near the end to have landed yet is only checked for where it is
    const late = s.at > 3600 - (C.fallWarn + 0.1) * 60;
    if (!late && (s.land === undefined || Math.abs(s.land - s.at - C.fallWarn * 60) > 2)) why.push("warn");
    if (!late && !(s.f1 < 0)) why.push("rock");
    if (why.length) bad.push({ ...s, why });
  }
  return { pass: all.length >= 4 && bad.length === 0 && most <= C.rockCap, n: all.length, most, bad: bad.slice(0, 4), near: Math.min(...all.map((s) => crossD(s.x, s.z))) };`),
  kstep("a chunk hurts the player, not the crocodile", `
  e.marks = 0; away(); p.buff = null; G.grabGrace = 0;
  const hurt = (setup) => { p.hp = p.maxHp; p.iframe = 0; p.state = "free"; setup(); const k = drop(p.x + 0.3, p.z + 0.2), h0 = p.hp; fall(k);
    const r = { lost: h0 - p.hp, clear: w.fieldAt(p.x, p.z), rock: w.fieldAt(k.x, k.z) }; DF.keys[DF.BIND.guard] = false; DF.sim(0.5, keep); return r; };
  const open = hurt(() => {});
  // a dodge's invulnerability avoids it; a guard does not
  const dodge = hurt(() => { p.iframe = 9; });
  p.iframe = 0;
  const guard = hurt(() => { const k0 = { x: p.x + 0.3, z: p.z + 0.2 }; p.yaw = Math.atan2(k0.x - p.x, k0.z - p.z); DF.keys[DF.BIND.guard] = true; DF.sim(0.2); });
  // one beside the crocodile up on land: it is not hurt and not left in the rock
  begin(); until(() => e.mode === "land", 25); until(() => e.state === "chase", 3); e.landT = 30; e.hp = 700;
  // the chunk follows it until it lands, so it lands on it wherever it goes
  const k = drop(e.x, e.z), hp0 = e.hp; let worst = 1e9;
  DF.sim(C.fallWarn + 1, () => { keep(); if (!k.id) { k.x = e.x + Math.sin(e.yaw) * 0.6; k.z = e.z + Math.cos(e.yaw) * 0.6; } else worst = Math.min(worst, w.fieldAt(e.x, e.z)); });
  const croc = { hp: e.hp, hp0, worst, mode: e.mode, rock: w.fieldAt(k.x, k.z) };
  return { pass: open.lost === C.fallDmg && open.clear >= p.r - 0.1 && open.rock < 0 && dodge.lost === 0 && dodge.clear >= p.r - 0.1 && guard.lost === C.fallDmg &&
    croc.hp === hp0 && croc.rock < 0 && croc.worst >= e.r - 1e-3, open, dodge, guard, croc };`),
  kstep("a landing moves only what it reaches", `
  e.marks = 0; away();
  // a rat and the player each leaning on the cavern's wall, a little under their radius as resolve
  // leaves a body there, and a chunk landing well away from both
  const lean = (a, r) => { for (let d = B.r - 6; d < B.r + 3; d += 0.005) { const x = B.x + Math.sin(a) * d, z = B.z + Math.cos(a) * d; if (w.fieldAt(x, z) < r - 0.02) return { x, z }; } return null; };
  const a0 = Math.atan2(p.x - B.x, p.z - B.z), rr = DF.EDEF.rat.r, rq = lean(a0 + 0.4, rr), pq = lean(a0 - 0.4, p.r);
  const rat = DF.makeEnemy({ type: "rat", x: rq.x, z: rq.z, yaw: 0, node: -1 }); rat.x = rq.x; rat.z = rq.z; G.enemies.push(rat);
  put(pq); const q = ringAt(10, a0 + Math.PI), k = drop(q.x, q.z);
  // the landing itself, on bodies just where they were put
  const r0 = { x: rat.x, z: rat.z }, p0 = { x: p.x, z: p.z }; DF.crocChunkLand(w, k);
  const rm = Math.hypot(rat.x - r0.x, rat.z - r0.z), pm = Math.hypot(p.x - p0.x, p.z - p0.z);
  const far = { rat: Math.hypot(rat.x - k.x, rat.z - k.z), p: Math.hypot(p.x - k.x, p.z - k.z) }, lean0 = { rat: w.fieldAt(r0.x, r0.z) - rr, p: w.fieldAt(p0.x, p0.z) - p.r };
  G.enemies = G.enemies.filter((o) => o !== rat);
  return { pass: !!k.id && far.rat > 8 && far.p > 8 && lean0.rat < 0 && lean0.p < 0 && rm === 0 && pm === 0, landed: !!k.id, far, lean0, rm, pm };`),
  kstep("at most rockCap heaps", `
  e.marks = 0; away();
  const a0 = Math.atan2(p.x - B.x, p.z - B.z), spots = [];
  for (let k = 0; k < 8; k++) spots.push(ringAt(15, a0 + 0.5 + k * 0.55));
  const base = spots.map((q) => w.fieldAt(q.x, q.z)), ks = [], log = []; let most = 0;
  for (let k = 0; k < 8; k++) { ks.push(drop(spots[k].x, spots[k].z)); fall(ks[k]); DF.sim(0.1, keep);
    const up = G.chunks.filter((q) => q.id); most = Math.max(most, up.length);
    log.push({ up: up.length, rocks: spots.map((q, i) => w.fieldAt(q.x, q.z) < 0 ? 1 : 0).join("") }); }
  const stand = G.chunks.filter((q) => q.id), last5 = stand.length === 5 && stand.every((q, i) => q === ks[i + 3]);
  const gone = [0, 1, 2].every((i) => Math.abs(w.fieldAt(spots[i].x, spots[i].z) - base[i]) < 1e-6), up = [3, 4, 5, 6, 7].every((i) => w.fieldAt(spots[i].x, spots[i].z) < 0);
  // the sixth took the first, and only the first
  const sixth = log[5].rocks === "01111100";
  return { pass: most === C.rockCap && last5 && gone && up && sixth, most, last5, gone, up, sixth, log };`),
  rstep("rubble never traps it", `
  ${ceiling.slice(landed.length)}
  e.marks = 2; e.hp = 400; place(); grab(); const held = p.state === "held";
  const forced = { spot: 0, foot: 0, roll: 0, climb: 0, on: 0 }, bad = [], pbad = []; let lastSpot = null, lastHold = null, climbFor = null, onT = 0, ups = 0, was = e.mode;
  DF.sim(60, (i) => { keep();
    if (e.mode === "under" && e.spot && e.spot !== lastSpot) { lastSpot = e.spot;
      if (forced.spot <= forced.foot) { drop(e.spot.x, e.spot.z); forced.spot++; } else { const q = footAt(e.spot.x, e.spot.z); if (q) { drop(q.x, q.z); forced.foot++; } } }
    if (p.state === "held" && p.hold && p.hold.by === e && p.hold !== lastHold) { lastHold = p.hold; drop(p.hold.tx, p.hold.tz); drop((p.x + p.hold.tx) / 2, (p.z + p.hold.tz) / 2); forced.roll++; }
    if (e.mode === "land" && e.wet && !e.rolling && !["wind", "act", "hold", "stagger"].includes(e.state) && climbFor !== e.lastSpot) { climbFor = e.lastSpot;
      const q = footAt(e.x, e.z); if (q) { drop(q.x, q.z); forced.climb++; } }
    if (e.mode === "land" && !e.hidden && i - onT > 7 * 60) { onT = i; drop(e.x, e.z); forced.on++; }
    if (was !== "land" && e.mode === "land") ups++; was = e.mode;
    const near = (o) => G.chunks.map((k) => ({ d: +Math.hypot(k.x - o.x, k.z - o.z).toFixed(2), id: k.id, t: +k.t.toFixed(2), wat: +w.waterAt(k.x, k.z).toFixed(2) })).filter((k) => k.d < 5);
    if ((e.mode === "land" || e.mode === "dive") && !e.hidden && w.fieldAt(e.x, e.z) < e.r - 1e-3) bad.push({ i, mode: e.mode, state: e.state, f: w.fieldAt(e.x, e.z), wet: e.wet, wat: w.waterAt(e.x, e.z), ok: DF.footOk(e, e.x, e.z), okk: DF.footOk(e, e.okx, e.okz), near: near(e) });
    // the player: never inside rock, and a landing leaves them room (in a pocket between heaps
    // resolve can leave a body short of its radius, as in any gap narrower than it)
    const landed = G.chunks.some((k) => k.id && !k.seen && (k.seen = 1)), pf = w.fieldAt(p.x, p.z);
    if (pf < 0 || (landed && pf < p.r - 0.1)) pbad.push({ i, f: pf, landed, state: p.state, near: near(p), held: !!p.hold });
    // the player keeps near it, so it keeps fighting
    if (i % 240 === 0 && e.mode === "land" && Math.hypot(p.x - e.x, p.z - e.z) > 6) { const a = Math.atan2(p.x - e.x, p.z - e.z), q = { x: e.x + Math.sin(a) * 3.5, z: e.z + Math.cos(a) * 3.5 };
      if (w.fieldAt(q.x, q.z) >= 1) put(q); } });
  return { pass: held && bad.length === 0 && pbad.length === 0 && forced.spot >= 1 && forced.foot >= 1 && forced.roll >= 1 && forced.climb >= 1 && forced.on >= 1 && ups >= 2,
    held, forced, ups, bad: bad.slice(0, 4), pbad: pbad.slice(0, 4) };`),
  kstep("leaving clears the rubble", `
  e.marks = 0; away();
  const a0 = Math.atan2(p.x - B.x, p.z - B.z), spots = [0, 1, 2].map((k) => ringAt(15, a0 + 0.6 + k * 0.6)), base = spots.map((q) => w.fieldAt(q.x, q.z));
  // a rock that is not the ceiling's (a cave-in's, say) stands elsewhere and is left alone
  const o = ringAt(12, a0 + 3), other = w.addRock(o.x, o.z, o.x + 0.5, o.z, 1);
  try {
    for (const q of spots) fall(drop(q.x, q.z));
    const before = { n: G.chunks.length, rocks: spots.every((q) => w.fieldAt(q.x, q.z) < 0) };
    put(out); const n = until(() => e.mode === "wait", 1);
    const after = { n: G.chunks.length, back: spots.every((q, i) => Math.abs(w.fieldAt(q.x, q.z) - base[i]) < 1e-6), other: w.fieldAt(o.x, o.z) < 0 };
    // a respawn clears the list too
    put(ring); DF.sim(0.2, keep); fall(drop(spots[0].x, spots[0].z)); const n1 = G.chunks.length; DF.respawn(); G.manual = true;
    const re = { n1, n: G.chunks.length, back: Math.abs(w.fieldAt(spots[0].x, spots[0].z) - base[0]) < 1e-6 };
    return { pass: before.n === 3 && before.rocks && n < 60 && after.n === 0 && after.back && after.other && re.n1 === 1 && re.n === 0 && re.back, before, after, re };
  } finally { w.removeRock(other); }`),
  kstep("its death leaves the heaps that have landed", `
  e.marks = 3; e.hp = 50; e.landT = 30;
  const a0 = Math.atan2(p.x - B.x, p.z - B.z), spots = [0, 1, 2].map((k) => ringAt(15, a0 + 0.6 + k * 0.6));
  try {
    fall(drop(spots[0].x, spots[0].z)); fall(drop(spots[1].x, spots[1].z)); const k2 = drop(spots[2].x, spots[2].z);
    DF.hitEnemy(e, 500, 0, { heavy: true }); const dead = !!e.dead; DF.sim(3, keep);
    const r = { dead, n: G.chunks.length, landed: G.chunks.every((q) => q.id), rocks: [0, 1].every((i) => w.fieldAt(spots[i].x, spots[i].z) < 0), pending: w.fieldAt(spots[2].x, spots[2].z) >= 0, k2: k2.id };
    return { pass: r.dead && r.n === 2 && r.landed && r.rocks && r.pending && !r.k2, ...r };
  } finally { DF.resetCleared(); G.bossDead = false; }`),
  { ...kstep("a dust warning and a landed heap, for looking at", `
  e.marks = 0; away();
  const q = ringAt(13), a = Math.atan2(B.x - q.x, B.z - q.z) + 0.9; put(q);
  const pt = (d, s) => ({ x: p.x + Math.sin(a) * d + Math.cos(a) * s, z: p.z + Math.cos(a) * d - Math.sin(a) * s });
  const h = pt(8, 1.5); fall(drop(h.x, h.z));
  const wv = pt(5.5, -1.8), fv = pt(9, -3.5); const kw = drop(wv.x, wv.z), kf = drop(fv.x, fv.z);
  DF.sim(C.fallWarn * 0.45, keep); kf.t = 0.07;
  p.yaw = cam.yaw = a; cam.pitch = 0.32; cam.px = p.x; cam.pz = p.z; p.fig.root.s = [0.0001, 0.0001, 0.0001];
  return { pass: !!h && G.chunks.length === 3 && !kw.id && !kf.id, n: G.chunks.length };`), wait: 500, shot: "t25-ceiling" },
  step("the player is put back again", `G.player.fig.root.s = [1, 1, 1]; DF.newRun(99); return { pass: true };`),
];
export default [...base, ...crocSteps, ...rollSteps, ...markSteps, ...tunnelSteps, ...ceilingSteps];
