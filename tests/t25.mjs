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
export default [
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
  for (const st of ["idle", "alert", "chase", "search", "return", "hit", "recoil", "stagger", "roar", "dead"]) for (const k of [0, 0.3, 1.5]) {
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
