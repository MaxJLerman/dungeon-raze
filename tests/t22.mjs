// The sewer: water, D opening, the generator, its look and its culling.
// Run with: SCRIPT=$PWD/tests/t22.mjs node test.mjs smoke
const step = (name, body) => ({ name, eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} })()` });
// a sewer run from a seed, with D live for the test
const sewer = (name, body, seed = 5) => step(name, `DF.LIVE_GRADES.add("D"); DF.newRun(${seed}, "D"); DF.show("play"); G.state = "play";
  const w = G.world, p = G.player, D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const look = (x, z, yaw, pitch) => { p.x = x; p.z = z; p.yaw = yaw; cam.yaw = yaw; cam.pitch = pitch; cam.px = x; cam.pz = z; cam.cd = 5.6; for (const e of G.enemies) e.x += 500; return { pass: true }; };
  const routeLen = (ax, az, bx, bz) => { const r = w.route(ax, az, bx, bz, 0.6); if (!r) return Infinity; let l = 0, a = { x: ax, z: az }; for (const q of r) { l += D(a, q); a = q; } return l; };
  ${body}`);
export default [
  step("genWorld is unchanged by the refactor", `const GOLD = {"1":[746235854,114597360,"0,1,5,6,10,14,15",4096],"7":[1576213153,-448329776,"0,4,5,9,10,14,15",4560],"99":[-498320114,1281514488,"0,1,5,6,10,14,15",4464]};
  const h = (a) => { let x = 0; for (let i = 0; i < a.length; i++) x = (x * 31 + Math.round(a[i] * 1000)) | 0; return x; };
  const got = {}; for (const s of [1, 7, 99]) { DF.newRun(s); const w = G.world; got[s] = [h(w.pos), h(w.col), w.path.join(","), JSON.stringify(w.spawns).length]; }
  return { pass: JSON.stringify(got) === JSON.stringify(GOLD), got };`),
  step("every world reads water as dry", `const h = DF.genHub(); DF.newRun(99); const w = G.world;
    const ok = (x) => x.waterAt(0, 0) === 0 && x.bodyAt(0, 0) === -1 && Array.isArray(x.bodies) && Array.isArray(x.grates) && Array.isArray(x.wallTunnels) && Array.isArray(x.shafts);
    const F = new Float32Array(25).fill(1), Wt = new Float32Array(25); Wt[12] = 1; const f = DF.fieldFns(F, 0, 0, 4, 4, Wt);
    return { pass: ok(h) && ok(w) && f.waterAt(2, 2) === 1 && f.waterAt(2.5, 2) === 0.5 && f.waterAt(-5, 0) === 0 };`),
  step("water slows walking by WATER.slow", `DF.newRun(99); DF.show("play"); G.state = "play"; const w = G.world, p = G.player;
    const run = (wet) => { DF.newRun(99); const p = G.player; G.world.waterAt = () => wet; const x = p.x, z = p.z; DF.keys[DF.BIND.fwd] = true; DF.sim(0.6); DF.keys[DF.BIND.fwd] = false; return Math.hypot(p.x - x, p.z - z); };
    const dry = run(0), wet = run(1);
    return { pass: Math.abs(wet / dry - DF.WATER.slow) < 0.05, dry, wet };`),
  step("a dodge in water is shorter and lasts as long", `const go = (wet) => { DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player; G.world.waterAt = () => wet; const x = p.x, z = p.z;
      DF.keys[DF.BIND.fwd] = true; DF.taps[DF.BIND.dodge] = true; let n = 0; DF.sim(1.2, () => { if (p.state === "dodge") n++; }); DF.keys[DF.BIND.fwd] = false; return { d: Math.hypot(p.x - x, p.z - z), n }; };
    const a = go(0), b = go(1);
    return { pass: b.d < a.d * 0.75 && b.n === a.n, a, b };`),
  step("an enemy's wade factor scales its step in water", `DF.newRun(99); const e = G.enemies.find((e) => !e.def.boss);
    const stepX = (wet, wade) => { G.world.waterAt = () => wet; const old = e.def.wade; e.def.wade = wade; const x = e.x; DF.eStep(e, 1, 0, 4, 0.5); const d = e.x - x; e.x = x; e.def.wade = old; return d; };
    const base = stepX(0, 1.5), fast = stepX(1, 1.5), slow = stepX(1, undefined);
    return { pass: Math.abs(base - 2) < 1e-6 && Math.abs(fast - 3) < 1e-6 && Math.abs(slow - 2 * DF.WATER.slow) < 1e-6 };`),
  step("a sprint attack in water still starts the dash", `DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player; G.world.waterAt = () => 1;
    DF.keys[DF.BIND.fwd] = true; DF.keys[DF.BIND.sprint] = true; DF.sim(1.0);
    const sp = p.speed, ds = p.dspeed, run = p.cls.run;
    DF.taps[DF.BIND.light] = true; DF.sim(0.05);
    DF.keys[DF.BIND.fwd] = false; DF.keys[DF.BIND.sprint] = false;
    return { pass: p.state === "attack" && p.move === p.cls.dash && sp < run * 0.8 && ds > run * 0.8, move: p.move, state: p.state, sp, ds, run };`),
  step("D is sealed until E is cleared and D is live", `DF.resetCleared(); DF.LIVE_GRADES.delete("D");
  const c = { e: DF.portalOpen("E"), d0: !DF.portalOpen("D") };
  DF.clearGrade("E", "fighter"); c.notLive = !DF.portalOpen("D");
  DF.LIVE_GRADES.add("D"); c.open = DF.portalOpen("D") && DF.hubPortals().find((q) => q.grade === "D").open;
  DF.resetCleared(); c.reset = !DF.portalOpen("D"); DF.LIVE_GRADES.delete("D");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("killing E's boss records E and says so once", `DF.resetCleared(); DF.LIVE_GRADES.add("D"); DF.newRun(99); DF.show("play"); G.state = "play";
  const b = G.enemies.find((e) => e.def.boss); b.hp = 0; DF.kill(b);
  const said = G.msgs.some((m) => /new gate has opened/.test(m.text || m.t || ""));
  const c = { cleared: DF.gradeCleared("E"), said, saved: /"c":/.test(localStorage.getItem("dungeon-raze.v2")) };
  DF.LIVE_GRADES.delete("D"); DF.resetCleared();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("an old save, or a broken c, loads with nothing cleared", `const k = "dungeon-raze.v2", keep = localStorage.getItem(k);
  const d = JSON.parse(keep || "{}"); delete d.c; localStorage.setItem(k, JSON.stringify(d));
  for (const id in DF.CLEARED) delete DF.CLEARED[id]; DF.loadOpt(); const a = !DF.gradeCleared("E");
  d.c = "rubbish"; localStorage.setItem(k, JSON.stringify(d)); DF.loadOpt(); const b = !DF.gradeCleared("E") && typeof DF.BIND.fwd === "string";
  d.c = { fighter: ["E", 7] }; localStorage.setItem(k, JSON.stringify(d)); DF.loadOpt(); const c2 = DF.gradeCleared("E");
  localStorage.setItem(k, keep); DF.resetCleared();
  return { pass: a && b && c2, a, b, c2 };`),
  step("the sewer is connected and has every room kind", `const bad = []; for (let s = 1; s <= 12; s++) { const w = DF.genSewer(s), k = w.nodes.map((n) => n.kind);
    const ok = ["start", "pool", "brood", "shrine", "boss"].every((x) => k.includes(x)) && w.shrines.length === 4 && w.nodes.every((n) => n.depth >= 0)
      && w.nodes.filter((n) => n.kind === "start")[0].adj.length === 1 && w.boss.adj.length === 1;
    if (!ok) bad.push(s); }
  return { pass: bad.length === 0, bad };`),
  step("a D run is about 1.5 times an E run, with more fights, dead ends and loops", `let e = 0, d = 0, few = [];
  const len = (w) => { const r = w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6); let l = 0, a = w.spawn; for (const q of r) { l += Math.hypot(a.x - q.x, a.z - q.z); a = q; } return l; };
  for (let s = 1; s <= 8; s++) { DF.newRun(s); e += len(G.world); const w = DF.genSewer(s); d += len(w);
    const fights = w.nodes.filter((n) => n.kind === "pool" || n.kind === "brood").length, leaves = w.nodes.filter((n) => n.adj.length === 1 && n.kind !== "start" && !w.path.includes(n.id)).length;
    if (fights < 15 || leaves < 2 || w.edges.length - w.nodes.length + 1 < 2) few.push({ s, fights, leaves }); }
  const ratio = d / e; return { pass: ratio > 1.35 && ratio < 1.65 && few.length === 0, ratio, few };`),
  step("every sewer spawn and respawn spot is dry, walkable and not in a rest room", `const bad = []; for (let s = 1; s <= 6; s++) { const w = DF.genSewer(s), rest = new Set(w.shrines.map((q) => q.node));
    for (const q of w.spawns) if (w.fieldAt(q.x, q.z) < 0.5 || w.waterAt(q.x, q.z) > 0 || rest.has(q.node) && q.type !== "warden") bad.push([s, q.type]);
    for (const c of w.shrines) { const o = { x: c.x, z: c.z - 1.6 }; w.resolve(o, 0.6); if (w.fieldAt(o.x, o.z) < 0.55 || w.waterAt(o.x, o.z) > 0) bad.push([s, "shrine", c.node]); } }
  return { pass: bad.length === 0, bad };`),
  step("the sewer ceiling clears the camera and rises in rooms", `const w = DF.genSewer(3), b = w.boss; let low = 0;
  for (let x = w.minX; x < w.minX + w.W; x += 2) for (let z = w.minZ; z < w.minZ + w.H; z += 2) if (w.fieldAt(x, z) >= 0.6 && w.ceilAt(x, z) < 3.2) low++;
  const room = w.nodes.find((n) => n.kind === "pool");
  return { pass: low === 0 && w.ceilAt(room.x, room.z) >= 6 && w.ceilAt(b.x + 8, b.z) >= 12, low };`),
  step("the sewer generates in under 1.5 seconds", `const t = performance.now(); DF.genSewer(11); const ms = performance.now() - t; return { pass: ms < 1500, ms };`),
  step("pool rooms hold 2 to 4 bodies, gutters stay apart", `const bad = []; for (let s = 1; s <= 8; s++) { const w = DF.genSewer(s);
    for (const n of w.nodes) { const own = w.bodies.filter((b) => b.room === n.id).length;
      if (n.kind === "pool" && (own < 2 || own > 4)) bad.push([s, n.id, own]); }
    for (const b of w.bodies) if (b.room === -1) { for (const n of w.nodes) if (Math.abs(b.x - n.x) < n.hw + 1 && Math.abs(b.z - n.z) < n.hd + 1) bad.push([s, "gutter", n.id]); } }
  return { pass: bad.length === 0, bad };`),
  step("a dry route joins every tunnel mouth of every room", `const bad = []; for (let s = 1; s <= 6; s++) { const w = DF.genSewer(s), Fd = w.F.map((f, k) => (w.Wt[k] > 0.5 ? -1 : f)), dry = DF.fieldFns(Fd, w.minX, w.minZ, w.W, w.H);
    for (const n of w.nodes) { if (n.kind === "boss") continue; const mids = w.edges.filter((e) => e.a === n.id || e.b === n.id).map((e) => e.pts[(e.pts.length / 2) | 0]);
      for (let i = 1; i < mids.length; i++) if (!dry.route(mids[0].x, mids[0].z, mids[i].x, mids[i].z, 0.6)) bad.push([s, n.id]); } }
  return { pass: bad.length === 0, bad };`),
  step("the boss cavern has a moat, a centre pool and a dry ring", `const bad = []; for (let s = 1; s <= 6; s++) { const w = DF.genSewer(s), b = w.boss, R = b.r;
    const centre = w.waterAt(b.x, b.z) === 1, ring = [0, 1, 2, 3, 4, 5, 6, 7].every((k) => { const a = k * Math.PI / 4; return w.waterAt(b.x + Math.sin(a) * (R - 10), b.z + Math.cos(a) * (R - 10)) === 0; });
    let moat = 0; for (let k = 0; k < 36; k++) { const a = k * Math.PI / 18; if (w.waterAt(b.x + Math.sin(a) * (R - 2), b.z + Math.cos(a) * (R - 2)) === 1) moat++; }
    if (!centre || !ring || moat < 30) bad.push({ s, centre, ring, moat }); }
  return { pass: bad.length === 0, bad };`),
  sewer("entering D builds the sewer with its air and echo", `const c = { sewer: !!w.sewer, grade: G.grade === "D", env: DF.R.env.fogD === DF.ENV_SEWER.fogD, echo: DF.SFX.echo === true };
  DF.newRun(99); c.back = !G.world.sewer && G.grade === "E" && DF.SFX.echo === false && DF.R.env.fogD !== DF.ENV_SEWER.fogD;
  return { pass: Object.values(c).every(Boolean), c };`),
  step("the reduced-motion cut into D lands in the sewer", `DF.LIVE_GRADES.add("D"); DF.enterHub(); DF.startTrans("D", true);
  return { pass: !!G.world.sewer && G.grade === "D" && DF.SFX.echo === true };`),
  sewer("a stand-in boss kill in D records D", `DF.resetCleared(); const b = G.enemies.find((e) => e.def.boss); b.hp = 0; DF.kill(b);
  const ok = DF.gradeCleared("D") && !!G.gate; DF.resetCleared(); return { pass: ok };`),
  sewer("a cave-in seals a sewer tunnel, a rift carries over water", `DF.setClass("sapper"); DF.newRun(5, "D"); const w2 = G.world, e = w2.edges.find((e) => e.pts.length > 8), m = e.pts[(e.pts.length / 2) | 0], A = e.pts[2], B = e.pts[e.pts.length - 3];
  const before = !!w2.route(A.x, A.z, B.x, B.z, 0.6); DF.startCaveIn(m.x, m.z); DF.sim(1.2); const after = w2.route(A.x, A.z, B.x, B.z, 0.6);
  DF.setClass("riftwalker"); DF.newRun(5, "D"); const w3 = G.world, pool = w3.bodies.find((b) => b.room >= 0), p3 = G.player;
  p3.x = pool.x; p3.z = pool.z; const a = DF.openRift(pool.x, pool.z + 1, 0), b2 = DF.openRift(w3.spawn.x, w3.spawn.z + 2, 0);
  const o = { x: pool.x, z: pool.z + 0.6 }; DF.riftMove(o, pool.x, pool.z + 1.4, 0.6);
  DF.setClass("fighter");
  return { pass: before && (after === null || after.length > 20) && typeof a === "object" && typeof b2 === "object" && Math.hypot(o.x - w3.spawn.x, o.z - w3.spawn.z) < 4, before, after: after && after.length, a, b2, o, spawn: w3.spawn };`),
  step("the cave and hall carry no material, the sewer brick and water", `DF.newRun(99); const cave = G.world.mat === null || G.world.mat.every((m) => m === 0); DF.enterHub(); const hall = G.world.mat === null || G.world.mat.every((m) => m === 0);
  const s = DF.genSewer(4), n1 = s.mat.filter((m) => m === 1).length, n2 = s.mat.filter((m) => m === 2).length;
  return { pass: cave && hall && n1 > 0 && n2 > 0 && s.mat.length === s.pos.length / 3 };`),
  { ...step("the cave still looks the same", `DF.newRun(99); DF.show("play"); G.state = "play";`), wait: 400, shot: "t22-cave99" }, // compare by eye with shots/play0.png from a run on main
  // a gutter tunnel, looking along it
  { ...sewer("a sewer tunnel, for looking at", `const g = w.bodies.find((b) => b.room === -1 && b.n > 20) || w.bodies.find((b) => b.room === -1);
  let e0 = w.edges[0], k0 = 1, best = 1e9; for (const e of w.edges) for (let k = 1; k < e.pts.length - 1; k++) { const d = D(e.pts[k], g); if (d < best) { best = d; e0 = e; k0 = k; } }
  const a = e0.pts[k0 - 1], b = e0.pts[k0 + 1]; return look(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z), 0.22);`), wait: 400, shot: "t22-tunnel" },
  // a pool room from its walkway, looking across the water
  { ...sewer("a pool room, for looking at", `const n = w.nodes.find((n) => n.kind === "pool"); return look(n.x, n.z - n.hd * 0.4, 0, 0.42);`), wait: 400, shot: "t22-pool" },
  // the boss cavern from its entrance, looking at the centre pool
  { ...sewer("the boss cavern, for looking at", `const b = w.boss, ent = w.nodes[w.path[w.path.length - 2]], a = Math.atan2(ent.x - b.x, ent.z - b.z);
  return look(b.x + Math.sin(a) * (b.r - 3), b.z + Math.cos(a) * (b.r - 3), a + Math.PI, 0.3);`), wait: 400, shot: "t22-boss" },
];
