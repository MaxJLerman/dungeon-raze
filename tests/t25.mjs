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
  // rubble across the way from the player straight out to the moat, 6 m long
  place(); const ids = [w.addRock(at(21.6, -3).x, at(21.6, -3).z, at(21.6, 3).x, at(21.6, 3).z, 0.4)];
  try {
    place(); const g = { x: p.x, z: p.z }, n = grab(), held = p.state === "held";
    const t = held ? { x: p.hold.tx, z: p.hold.tz } : null, own = t && Math.hypot(t.x - g.x, t.z - g.z) < 0.01;
    const tw = t && { water: w.waterAt(t.x, t.z), field: w.fieldAt(t.x, t.z), sight: w.los(g.x, g.z, t.x, t.z) };
    DF.sim(H.max + 0.2, () => { if (p.state !== "held") return false; });
    const f = { x: p.x, z: p.z }, field = w.fieldAt(f.x, f.z), toT = t && Math.hypot(f.x - t.x, f.z - t.z), toG = Math.hypot(f.x - g.x, f.z - g.z);
    const okT = held && (own || (tw.water >= 0.5 && tw.field >= p.r && tw.sight));
    // there, or on the straight way there when the hold ran out first: the way round is long
    const L = t ? Math.hypot(t.x - g.x, t.z - g.z) : 0, k = L > 0.01 ? Math.max(0, Math.min(1, ((f.x - g.x) * (t.x - g.x) + (f.z - g.z) * (t.z - g.z)) / (L * L))) : 0;
    const offLine = t ? Math.hypot(f.x - (g.x + (t.x - g.x) * k), f.z - (g.z + (t.z - g.z) * k)) : 0;
    return { pass: held && okT && field >= p.r * 0.9 && (own ? toG < 0.35 : toT < 0.35 || (offLine < 0.2 && L - toT > H.max * C.dragSpeed - 0.5)),
      held, own, tw, field, L, toT, toG, offLine, pr: p.r };
  } finally { w.clearRocks(); }`),
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
export default [...base, ...crocSteps, ...rollSteps];
