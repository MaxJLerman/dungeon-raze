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
  // the sewer's mesh, materials, water, spawns, pieces and dressing for three
  // seeds: a change that only moves code must leave these as they are (last
  // set when most big pool rooms placed their piers before their pools)
  step("genSewer is unchanged by moving code", `const GOLD = {"1":[-1431275824,-1228683800,246235336,607675172,-449013164,-82002622,1529990366],"5":[-958529565,1429795960,-1035043016,-1166667044,800819374,608908786,-1321668637],"9":[857347738,-962631704,-1260107072,933463255,32012464,749723291,-865936057]};
  const h = (a) => { let x = 0; for (let i = 0; i < a.length; i++) x = (x * 31 + Math.round(a[i] * 1000)) | 0; return x; };
  const hs = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  const got = {}; for (const s of [1, 5, 9]) { const w = DF.genSewer(s);
    got[s] = [h(w.pos), h(w.col), h(w.mat), h(w.Wt), hs(JSON.stringify(w.spawns)), hs(JSON.stringify(w.pieces)) ^ h(w.pieceGrid), hs(JSON.stringify([w.lights, w.halos, w.grates, w.shafts]))]; }
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
  step("a save with __proto__ or constructor keys still loads its options and clears nothing odd", `const k = "dungeon-raze.v2", keep = localStorage.getItem(k), sens = DF.OPT.sens;
  const d = JSON.parse(keep || "{}"); delete d.c; d.o = { ...(d.o || {}), sens: 2.5 }; d.u = ["constructor", "__proto__", "toString"];
  const raw = JSON.stringify(d).replace(/}$/, ',"c":{"__proto__":["E"],"constructor":["E"],"toString":["E"],"hasOwnProperty":["D"]}}');
  DF.resetCleared(); localStorage.setItem(k, raw); let err = null; try { DF.loadOpt(); } catch (e) { err = String(e); }
  const c = { err: err === null, opts: DF.OPT.sens === 2.5, none: !DF.gradeCleared("E") && !DF.gradeCleared("D") && Object.keys(DF.CLEARED).length === 0,
    unl: !DF.UNLOCKED.has("constructor") && !DF.UNLOCKED.has("__proto__") && !DF.UNLOCKED.has("toString"),
    clear: DF.clearGrade("E", "constructor") === false && DF.clearGrade("E", "__proto__") === false && !DF.gradeCleared("E"),
    open: DF.classOpen("constructor") === false && DF.unlockClass("toString") === false, proto: typeof ({}).includes === "undefined" };
  localStorage.setItem(k, keep); DF.OPT.sens = sens; DF.resetCleared();
  return { pass: Object.values(c).every(Boolean), c, err };`),
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
  // The drawn water is the floor triangles of water material at -sink. Inside
  // a square of floor the drawn shore is a straight line between the points
  // where waterAt reads 0.5 on its sides, and waterAt's 0.5 line is the
  // bilinear curve through the same points. For a cell with one corner of 1
  // and three of 0, the most common shore cell, the curve meets the diagonal
  // at 1 - 1/sqrt 2 and the line at 1/4: they part by 0.061 m. Corner values
  // near 0.5 can bow it by up to 0.47 of the side (found numerically), so
  // the floor halves such a square until the bow is no more than that 0.061,
  // or down to an eighth of a cell (0.47 / 8 = 0.059). The test steps out
  // from each point 1 cm at a time in 32 directions, which adds up to 2 cm.
  // So on every walkable point near a shore in four seeds, where the drawing
  // and waterAt >= 0.5 disagree, waterAt must agree within 0.08 m, and such
  // points must be rare: a shore drawn off the grid's along every gutter, as
  // before this test, made 5% of them disagree.
  step("the drawn shore is where waterAt reads 0.5", `const TOL = 0.08, out = { pts: 0, off: 0, worst: 0, at: null };
  for (const s of [1, 5, 9, 13]) { const w = DF.genSewer(s), P = w.pos, M = w.mat, sink = DF.WATER.sink, W1 = w.W + 1, tris = new Map();
    for (let t = 0; t < M.length / 3; t++) { const b = t * 9; if (M[t * 3] !== 2 || [1, 4, 7].some((o) => Math.abs(P[b + o] + sink) > 1e-4)) continue;
      const c = Math.floor((P[b] + P[b + 3] + P[b + 6]) / 3 - w.minX) + Math.floor((P[b + 2] + P[b + 5] + P[b + 8]) / 3 - w.minZ) * W1;
      if (!tris.has(c)) tris.set(c, []); tris.get(c).push(b); }
    const side = (ax, az, bx, bz, x, z) => (bx - ax) * (z - az) - (bz - az) * (x - ax);
    const inTri = (b, x, z) => { const d1 = side(P[b], P[b + 2], P[b + 3], P[b + 5], x, z), d2 = side(P[b + 3], P[b + 5], P[b + 6], P[b + 8], x, z), d3 = side(P[b + 6], P[b + 8], P[b], P[b + 2], x, z);
      return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9)); };
    const drawn = (x, z) => (tris.get(Math.floor(x - w.minX) + Math.floor(z - w.minZ) * W1) || []).some((b) => inTri(b, x, z));
    const near = (x, z, wet) => { for (let r = 0.01; r <= 1; r += 0.01) for (let a = 0; a < 32; a++) if (w.waterAt(x + Math.sin(a * Math.PI / 16) * r, z + Math.cos(a * Math.PI / 16) * r) >= 0.5 === wet) return r; return 1; };
    for (let j = 0; j < w.H; j++) for (let i = 0; i < w.W; i++) { const k = j * W1 + i, c = [w.Wt[k], w.Wt[k + 1], w.Wt[k + W1], w.Wt[k + W1 + 1]];
      if (!tris.has(k) && Math.max(...c) === 0 || Math.min(...c) === 1) continue;
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) { const x = w.minX + i + (a + 0.5) / 6, z = w.minZ + j + (b + 0.5) / 6;
        if (!(w.fieldAt(x, z) > 0)) continue; out.pts++; const d = drawn(x, z);
        if (w.waterAt(x, z) >= 0.5 === d) continue; out.off++; const r = near(x, z, d);
        if (r > out.worst) { out.worst = r; out.at = { s, x: +x.toFixed(2), z: +z.toFixed(2), drawn: d, wet: +w.waterAt(x, z).toFixed(3), room: w.nodes.findIndex((n) => Math.abs(x - n.x) < n.hw + 1 && Math.abs(z - n.z) < n.hd + 1) }; } } } }
  return { pass: out.worst <= TOL && out.pts > 20000 && out.off < out.pts * 0.02, ...out, worst: +out.worst.toFixed(3) };`),
  // The rules of the spec's Water section that the D enemies will rely on,
  // over twelve seeds, measured on the water grid through waterAt and bodyAt
  // and on the room rectangles.
  ...[
    // every pool is at least 4 m across at its narrowest (a pool is a box on
    // the grid, so its narrowest is its shorter side, where waterAt reads 0.5)
    ["every pool is at least 4 m across at its narrowest", `let least = 1e9;
      for (const s of SEEDS) { const w = gen(s); for (const n of w.nodes) if (n.kind === "pool") for (const q of pools(w, n)) { const d = Math.min(q.x1 - q.x0, q.z1 - q.z0); least = Math.min(least, d);
        if (!q.box || d < 4 - TOL) bad.push({ s, n: n.id, box: q.box, d: +d.toFixed(2) }); } }
      return { pass: bad.length === 0, least: +least.toFixed(2), bad: bad.slice(0, 6) };`],
    // a pool room's dry floor: at least 3 m from each pool to the room's wall
    // and to a pier that stands outside it, and between two pools either at
    // least 3 m or a crossing of 2 to 3 m. A pier inside a pool has at least
    // SEWER.pillarWet of water to every side of it, so no sliver of water is
    // left beside it. Both pier rules must run on some pier
    ["dry walkways in pool rooms are at least 3 m wide", `const least = { wall: 1e9, pillar: 1e9, inPool: 1e9, between: 1e9 }, PH = DF.SEWER.pillarHS; let pillars = 0;
      for (const s of SEEDS) { const w = gen(s); for (const n of w.nodes) { if (n.kind !== "pool") continue; const ps = pools(w, n), mine = w.pillars.filter((c) => inRect(n, c.x, c.z)); pillars += mine.length;
        for (const q of ps) { let wall = 1e9;
          for (let t = 0; t <= 1; t += 1 / 64) for (const [x, z] of [[q.x0 + (q.x1 - q.x0) * t, q.z0], [q.x0 + (q.x1 - q.x0) * t, q.z1], [q.x0, q.z0 + (q.z1 - q.z0) * t], [q.x1, q.z0 + (q.z1 - q.z0) * t]]) wall = Math.min(wall, wallD(n, x, z));
          least.wall = Math.min(least.wall, wall); if (wall < 3 - TOL) bad.push({ s, n: n.id, wall: +wall.toFixed(2) });
          for (const c of mine) { const pier = { x0: c.x - PH, x1: c.x + PH, z0: c.z - PH, z1: c.z + PH };
            if (c.x > q.x0 && c.x < q.x1 && c.z > q.z0 && c.z < q.z1) { const d = Math.min(pier.x0 - q.x0, q.x1 - pier.x1, pier.z0 - q.z0, q.z1 - pier.z1);
              least.inPool = Math.min(least.inPool, d); if (d < DF.SEWER.pillarWet - TOL) bad.push({ s, n: n.id, inPool: +d.toFixed(2) }); continue; }
            const d = gap(q, pier); least.pillar = Math.min(least.pillar, d); if (d < 3 - TOL) bad.push({ s, n: n.id, pillar: +d.toFixed(2) }); } }
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const d = gap(ps[i], ps[j]); least.between = Math.min(least.between, d); if (d < 2 - TOL) bad.push({ s, n: n.id, between: +d.toFixed(2) }); } } }
      for (const k in least) least[k] = least[k] === 1e9 ? null : +least[k].toFixed(2);
      return { pass: bad.length === 0 && pillars > 0 && least.pillar !== null && least.inPool !== null, least, pillars, bad: bad.slice(0, 6) };`],
    // Piers: in about half of fight rooms (between a third and 0.6 over
    // twelve seeds; 0.557 measured), never in the arrival hall or the boss
    // cavern. Most pool rooms big enough for one (SEWER.pillarAt) place a
    // pier before their pools, so at least 0.45 of them have one (0.551
    // measured; about a quarter before that). Each
    // is rock at its centre and its field reads 0 along its faces, so the
    // wall drawn round it is its footprint; the walls drawn there and the top
    // of its plinth are read back from the mesh. It keeps 3 m to the room's
    // walls and to other piers, and either has no water within 3 m or water
    // all round it out to SEWER.pillarWet
    ["piers stand in a third to 0.6 of fight rooms, block, and are drawn where they stand", `const S = DF.SEWER, PH = S.pillarHS, B = S.pillarBase; let fights = 0, withP = 0, n2 = 0, piers = 0; const pool = { rooms: 0, big: 0, withP: 0, bigP: 0 };
      for (const s of SEEDS) { const w = gen(s), P = w.pos;
        for (const n of w.nodes) { const mine = w.pillars.filter((c) => inRect(n, c.x, c.z)); if (n.kind === "pool" || n.kind === "brood") { fights++; if (mine.length) withP++; }
          if (n.kind === "pool") { const big = Math.min(n.hw, n.hd) >= S.pillarAt; pool.rooms++; if (big) pool.big++; if (mine.length) { pool.withP++; if (big) pool.bigP++; } }
          if (mine.length > 1) n2++; if (mine.length && (n.kind === "start" || n.kind === "boss")) bad.push({ s, n: n.id, kind: n.kind }); }
        for (const c of w.pillars) { piers++; const n = w.nodes.find((n) => inRect(n, c.x, c.z)), why = [];
          if (!n) { bad.push({ s, c, why: "in no room" }); continue; }
          if (!(w.fieldAt(c.x, c.z) <= 0)) why.push("open at its centre");
          for (let t = -PH + 0.25; t <= PH - 0.25 + 1e-9; t += 0.25) for (const [x, z, ox, oz] of [[c.x - PH, c.z + t, -1, 0], [c.x + PH, c.z + t, 1, 0], [c.x + t, c.z - PH, 0, -1], [c.x + t, c.z + PH, 0, 1]])
            if (Math.abs(w.fieldAt(x, z)) > 0.01 || !(w.fieldAt(x - ox * 0.1, z - oz * 0.1) < 0) || !(w.fieldAt(x + ox * 0.1, z + oz * 0.1) > 0)) { why.push("face off its footprint"); break; }
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (wallD(n, c.x + sx * PH, c.z + sz * PH) < 3 - TOL) why.push("near a wall");
          for (const o of w.pillars) if (o !== c && gap({ x0: c.x - PH, x1: c.x + PH, z0: c.z - PH, z1: c.z + PH }, { x0: o.x - PH, x1: o.x + PH, z0: o.z - PH, z1: o.z + PH }) < 3 - TOL) why.push("near a pier");
          let dry = true, wet = true; for (let x = c.x - PH - 3; x <= c.x + PH + 3; x += 0.25) for (let z = c.z - PH - 3; z <= c.z + PH + 3; z += 0.25) {
            const d = Math.hypot(Math.max(Math.abs(x - c.x) - PH, 0), Math.max(Math.abs(z - c.z) - PH, 0)); if (d > 3) continue; const v = w.waterAt(x, z) >= 0.5; if (v) dry = false; else if (d <= S.pillarWet) wet = false; }
          if (!dry && !wet) why.push("a sliver of water or a narrow walkway");
          // the mesh: the plinth's top, and the walls' middle row (y 1.1)
          let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, nw = 0, off = 0;
          for (let i = 0; i < P.length; i += 3) { const dx = P[i] - c.x, dz = P[i + 2] - c.z; if (Math.abs(dx) > PH + 0.6 || Math.abs(dz) > PH + 0.6) continue;
            if (Math.abs(P[i + 1] - B.top) < 1e-4) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
            if (Math.abs(P[i + 1] - 1.1) < 1e-4) { nw++; if (Math.abs(Math.max(Math.abs(dx), Math.abs(dz)) - PH) > 0.01) off++; } }
          const e = PH + B.out; if ([c.x - e - x0, x1 - c.x - e, c.z - e - z0, z1 - c.z - e].some((d) => Math.abs(d) > 0.01)) why.push("plinth off its footprint");
          if (nw < 8 || off) why.push("walls off its footprint " + nw + " " + off);
          if (why.length) bad.push({ s, c, n: n.id, why }); } }
      const share = withP / fights, poolBig = pool.bigP / pool.big;
      return { pass: bad.length === 0 && share >= 1 / 3 && share <= 0.6 && n2 > 0 && poolBig >= 0.45, share: +share.toFixed(3), fights, withP, pairs: n2, piers,
        poolBig: +poolBig.toFixed(3), poolAll: +(pool.withP / pool.rooms).toFixed(3), pool, bad: bad.slice(0, 6) };`],
    // each pool room has a crossing: two pools 2 to 3 m apart
    ["each pool room has a crossing 2 to 3 m wide between two pools", `const widths = new Set();
      for (const s of SEEDS) { const w = gen(s); for (const n of w.nodes) { if (n.kind !== "pool") continue; const ps = pools(w, n); let found = null;
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const d = gap(ps[i], ps[j]); if (d >= 2 - TOL && d <= 3 + TOL) found = d; }
        if (found === null) bad.push({ s, n: n.id, pools: ps.length }); else widths.add(+found.toFixed(2)); } }
      return { pass: bad.length === 0, widths: [...widths].sort(), bad: bad.slice(0, 6) };`],
    ["brood rooms hold at most one body of water", `let rooms = 0, wet = 0;
      for (const s of SEEDS) { const w = gen(s); for (const n of w.nodes) { if (n.kind !== "brood") continue; rooms++; const k = pools(w, n).length; if (k) wet++; if (k > 1) bad.push({ s, n: n.id, bodies: k }); } }
      return { pass: bad.length === 0 && wet > 0, rooms, wet, bad: bad.slice(0, 6) };`],
    // every point in the arrival hall and the rest rooms reads 0, edges included
    ["the start room and rest rooms are dry", `let n0 = 0;
      for (const s of SEEDS) { const w = gen(s), rest = new Set(w.shrines.map((q) => q.node));
        for (const n of w.nodes) { if (n.kind !== "start" && !rest.has(n.id)) continue; n0++; if (n.kind !== "start" && n.kind !== "shrine") bad.push({ s, n: n.id, kind: n.kind });
          let most = 0; for (let x = n.x - n.hw; x <= n.x + n.hw + 1e-9; x += 0.5) for (let z = n.z - n.hd; z <= n.z + n.hd + 1e-9; z += 0.5) most = Math.max(most, w.waterAt(x, z));
          if (most > 0) bad.push({ s, n: n.id, kind: n.kind, most }); } }
      return { pass: bad.length === 0 && n0 === SEEDS.length * 4, rooms: n0, bad: bad.slice(0, 6) };`],
    // a tunnel has a gutter when, somewhere along it clear of every room, the
    // floor half a metre from one wall reads as water. SEWER.gutterP is a
    // third; a gutter that every point of its tunnel refuses (a short tunnel,
    // or one beside another) is lost, so over twelve seeds the share must
    // fall between 0.22 and 0.45
    ["roughly one tunnel in three has a gutter", `let all = 0, wet = 0; const per = [];
      for (const s of SEEDS) { const w = gen(s), b = w.boss, R = DF.SEWER.tunR - 0.5; let k = 0;
        for (const e of w.edges) { all++; let has = false;
          for (let i = 1; i < e.pts.length && !has; i++) { const a = e.pts[i - 1], c = e.pts[i], l = Math.hypot(c.x - a.x, c.z - a.z) || 1, nx = -(c.z - a.z) / l, nz = (c.x - a.x) / l;
            if (w.nodes.some((n) => inRect(n, a.x, a.z, 2)) || Math.hypot(a.x - b.x, a.z - b.z) < b.r + 3) continue;
            has = [-R, R].some((o) => { const x = a.x + nx * o, z = a.z + nz * o, id = w.bodyAt(x, z); return w.waterAt(x, z) >= 0.5 && id >= 0 && w.bodies[id].room === -1; }); }
          if (has) { wet++; k++; } }
        per.push(k); }
      const share = wet / all; return { pass: share >= 0.22 && share <= 0.45, share: +share.toFixed(3), wet, all, per };`],
    // a gutter is its own body, and no grid point of it is within 2 m of a
    // room's water, so there is always dry floor between where waterAt reads
    // 0.5 round the two
    ["tunnel gutters never touch a room's pools", `let gutters = 0;
      for (const s of SEEDS) { const w = gen(s), W1 = w.W + 1, home = new Map(), pts = new Map();
        for (let j = 0; j <= w.H; j++) for (let i = 0; i <= w.W; i++) { const x = i + w.minX, z = j + w.minZ, id = w.bodyAt(x, z); if (id < 0 || w.waterAt(x, z) < 0.5) continue;
          if (!pts.has(id)) pts.set(id, []); pts.get(id).push([i, j]); if (w.nodes.some((n) => inRect(n, x, z))) home.set(id, true); }
        const roomWet = new Set(); for (const [id, ps] of pts) if (home.has(id)) for (const [i, j] of ps) roomWet.add(j * W1 + i);
        for (const [id, ps] of pts) { if (home.has(id)) continue; gutters++;
          for (const [i, j] of ps) { if (w.nodes.some((n) => inRect(n, i + w.minX, j + w.minZ, 1))) { bad.push({ s, id, at: [i + w.minX, j + w.minZ], why: "in a room" }); break; }
            if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, c]) => roomWet.has((j + c) * W1 + i + a))) { bad.push({ s, id, at: [i + w.minX, j + w.minZ], why: "beside a room's water" }); break; } } } }
      return { pass: bad.length === 0 && gutters > 0, gutters, bad: bad.slice(0, 6) };`],
  ].map(([name, body]) => step(name, `const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], TOL = 0.02, bad = [], gen = (s) => ((window.__sewers ||= {})[s] ||= DF.genSewer(s));
    const inRect = (n, x, z, pad = 0) => Math.abs(x - n.x) <= n.hw + pad && Math.abs(z - n.z) <= n.hd + pad;
    // how far a point is inside room n's rounded rectangle
    const wallD = (n, x, z) => { const c = DF.SEWER.corner, qx = Math.abs(x - n.x) - (n.hw - c), qz = Math.abs(z - n.z) - (n.hd - c); return c - Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - Math.min(Math.max(qx, qz), 0); };
    const gap = (a, b) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.z0 - a.z1, a.z0 - b.z1));
    // each body of water in room n: its grid points, whether they fill their
    // box, and the box where waterAt reads 0.5, stepped out from the middle of
    // each side
    const pools = (w, n) => { const by = new Map();
      for (let z = Math.ceil(n.z - n.hd); z <= n.z + n.hd; z++) for (let x = Math.ceil(n.x - n.hw); x <= n.x + n.hw; x++) { if (w.waterAt(x, z) < 0.5) continue; const id = w.bodyAt(x, z);
        const q = by.get(id) || { id, i0: x, i1: x, j0: z, j1: z, n: 0 }; q.i0 = Math.min(q.i0, x); q.i1 = Math.max(q.i1, x); q.j0 = Math.min(q.j0, z); q.j1 = Math.max(q.j1, z); q.n++; by.set(id, q); }
      const out = (x, z, dx, dz) => { let t = 0; while (t < 2 && w.waterAt(x + dx * t, z + dz * t) >= 0.5) t += 0.005; return t; };
      return [...by.values()].map((q) => { const mx = Math.round((q.i0 + q.i1) / 2), mz = Math.round((q.j0 + q.j1) / 2);
        return { ...q, box: q.n === (q.i1 - q.i0 + 1) * (q.j1 - q.j0 + 1) && q.n === w.bodies[q.id].n, x0: q.i0 - out(q.i0, mz, -1, 0), x1: q.i1 + out(q.i1, mz, 1, 0), z0: q.j0 - out(mx, q.j0, 0, -1), z1: q.j1 + out(mx, q.j1, 0, 1) }; }); };
    ${body}`)),
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
  { ...sewer("a brood room, for looking at", `const n = w.nodes.find((n) => n.kind === "brood"); return { ...look(n.x, n.z - n.hd * 0.4, 0, 0.42), n: n.id };`), wait: 400, shot: "t22-brood" },
  // a room with a pair of piers: from beside the middle, looking at one pier
  // with the camera passing the other
  { ...sewer("a room with pillars, for looking at", `const mine = (n) => w.pillars.filter((c) => Math.abs(c.x - n.x) < n.hw && Math.abs(c.z - n.z) < n.hd);
  const n = w.nodes.find((n) => n.kind === "brood" && mine(n).length === 2) || w.nodes.find((n) => mine(n).length === 2) || w.nodes.find((n) => mine(n).length);
  const [a] = mine(n), dx = a.x - n.x, dz = a.z - n.z, l = Math.hypot(dx, dz), x = n.x - (dz / l) * 2.5, z = n.z + (dx / l) * 2.5;
  return { ...look(x, z, Math.atan2(a.x - x, a.z - z), 0.12), n: n.id, kind: n.kind, piers: mine(n) };`), wait: 500, shot: "t22-pillars" },
  // a pool room whose pier stands in a pool: from dry floor 7 m off,
  // looking across the water at it
  { ...sewer("a pier standing in a pool, for looking at", `const wet = (c) => [[2, 0], [-2, 0], [0, 2], [0, -2]].every(([a, b]) => w.waterAt(c.x + a, c.z + b) >= 0.5);
  const n = w.nodes.find((n) => n.kind === "pool" && w.pillars.some((c) => Math.abs(c.x - n.x) < n.hw && Math.abs(c.z - n.z) < n.hd && wet(c)));
  const c = w.pillars.find((c) => Math.abs(c.x - n.x) < n.hw && Math.abs(c.z - n.z) < n.hd && wet(c));
  // the dry spot 7 m from it with the most room behind it for the camera
  let x = c.x, z = c.z, best = -1e9; for (let a = 0; a < 32; a++) { const u = Math.sin(a * Math.PI / 16), v = Math.cos(a * Math.PI / 16), qx = c.x + u * 7, qz = c.z + v * 7;
    if (w.waterAt(qx, qz) > 0 || w.fieldAt(qx, qz) < 1) continue; const f = w.fieldAt(qx + u * 4, qz + v * 4); if (f > best) { best = f; x = qx; z = qz; } }
  return { ...look(x, z, Math.atan2(c.x - x, c.z - z) + 0.3, 0.3), n: n.id, c, dry: w.waterAt(x, z) === 0 };`), wait: 500, shot: "t22-pier-wet" },
  // the boss cavern from its entrance, looking at the centre pool
  { ...sewer("the boss cavern, for looking at", `const b = w.boss, ent = w.nodes[w.path[w.path.length - 2]], a = Math.atan2(ent.x - b.x, ent.z - b.z);
  return look(b.x + Math.sin(a) * (b.r - 3), b.z + Math.cos(a) * (b.r - 3), a + Math.PI, 0.3);`), wait: 400, shot: "t22-boss" },
  step("the sewer lists grates, wall tunnels and shafts", `const w = DF.genSewer(6), b = w.boss, ent = w.nodes[w.path[w.path.length - 2]];
  const far = w.wallTunnels.every((q) => (q.x - b.x) * (ent.x - b.x) + (q.z - b.z) * (ent.z - b.z) < 0);
  return { pass: w.grates.length > 0 && w.wallTunnels.length >= 3 && w.wallTunnels.length <= 5 && far && w.shafts.length >= 3 && w.lights.every((L) => typeof L.flick === "boolean") };`),
  step("a flickering lamp is steady most of the time and stutters sometimes", `let low = 0, full = 0, n = 0; for (let t = 0; t < 60; t += 1 / 60) { const v = DF.lampFlicker(1.7, t); n++; if (v < 0.5) low++; if (v > 0.99) full++; }
  return { pass: low > 0 && full / n > 0.85 && DF.lampFlicker(1.7, 12.3) === DF.lampFlicker(1.7, 12.3) };`),
  // every tunnel longer than 20 m has a grate in its wall, facing into it;
  // wall tunnels face the cavern's centre at about 5 m up, shafts stand on
  // dry floor inside it, about one lamp in three flickers, and nothing glows
  // like a crystal
  step("grates, wall tunnels, shafts and lamps are where they belong", `const bad = []; let flick = 0, lamps = 0;
  for (let s = 1; s <= 8; s++) { const w = DF.genSewer(s), b = w.boss, inRoom = (x, z) => w.nodes.some((n) => Math.abs(x - n.x) < n.hw && Math.abs(z - n.z) < n.hd);
    for (const e of w.edges) { let len = 0; for (let i = 1; i < e.pts.length; i++) { const a = e.pts[i - 1], c = e.pts[i]; if (!inRoom((a.x + c.x) / 2, (a.z + c.z) / 2)) len += Math.hypot(c.x - a.x, c.z - a.z); }
      if (len <= 20) continue;
      const near = (g) => e.pts.some((q) => Math.hypot(q.x - g.x, q.z - g.z) < DF.SEWER.tunR + 1.5);
      const g = w.grates.find((g) => near(g) && w.fieldAt(g.x + Math.sin(g.yaw) * 1.5, g.z + Math.cos(g.yaw) * 1.5) > w.fieldAt(g.x, g.z) + 1);
      if (!g) bad.push([s, "grate", e.a, e.b, Math.round(len)]); }
    for (const q of w.wallTunnels) { const d = Math.hypot(q.x - b.x, q.z - b.z), face = Math.abs(DF.angDiff(q.yaw, Math.atan2(b.x - q.x, b.z - q.z)));
      if (Math.abs(d - b.r) > 0.6 || Math.abs(q.y - 5) > 1 || face > 0.05 || w.waterAt(q.x + Math.sin(q.yaw) * 2, q.z + Math.cos(q.yaw) * 2) !== 1) bad.push([s, "mouth"]); }
    if (w.shafts.length < 3 || w.shafts.length > 6) bad.push([s, "shafts", w.shafts.length]);
    for (const h of w.shafts) if (Math.hypot(h.x - b.x, h.z - b.z) > b.r - 4 || w.waterAt(h.x, h.z) !== 0 || !(h.r > 0)) bad.push([s, "shaft"]);
    for (const L of w.lights) if (L.c === DF.SEWER_LAMP) { lamps++; if (L.flick) flick++; }
    if (w.halos.some((h) => !h.lamp)) bad.push([s, "halo"]); }
  const share = flick / lamps;
  return { pass: bad.length === 0 && share > 0.2 && share < 0.45, bad: bad.slice(0, 6), share };`),
  // the arrival: the ladder down from the manhole, beside where the player lands
  { ...sewer("the arrival hall under the manhole, for looking at", `const s = w.spawn, a = w.spawnYaw;
  return look(s.x + Math.sin(a) * 4.5, s.z + Math.cos(a) * 4.5, a + Math.PI + 0.35, -0.12);`), wait: 500, shot: "t22-arrival" },
  // the boss cavern from the dry ring, looking at the wall tunnels and their falls
  { ...sewer("the boss cavern's far wall, for looking at", `const b = w.boss, q = w.wallTunnels[(w.wallTunnels.length / 2) | 0], a = Math.atan2(q.x - b.x, q.z - b.z);
  return look(b.x + Math.sin(a) * 7, b.z + Math.cos(a) * 7, a, -0.05);`), wait: 500, shot: "t22-falls" },
  // wading: a body in water is drawn sunk, drips fall only in the sewer, the
  // map shows water in explored rooms
  { ...sewer("a body in water is drawn sunk by WATER.sink", `p.x = w.spawn.x; p.z = w.spawn.z; w.waterAt = () => 1;`), wait: 100 },
  step("the sunk body, read after two frames", `const y = DF.R.nodePos(G.player.fig.root, 0, 0, 0)[1]; return { pass: Math.abs(y + DF.WATER.sink) < 0.02, y };`),
  sewer("a half wet spot sinks the body half as far, a dry one not at all", `const f = p.fig, at = (wet) => { w.waterAt = () => wet; DF.posePlayer(p); return f.root.p[1]; };
  const d = at(0), h = at(0.5), c = at(1); w.waterAt = () => 0; for (const e of G.enemies) { w.waterAt = () => 1; DF.poseEnemy(e); }
  const en = G.enemies.find((e) => !e.def.dummy); w.waterAt = () => 1; DF.poseEnemy(en); const ey = en.fig.root.p[1] - en.y;
  return { pass: Math.abs(d) < 1e-9 && Math.abs(h + DF.WATER.sink / 2) < 1e-9 && Math.abs(c + DF.WATER.sink) < 1e-9 && Math.abs(ey + DF.WATER.sink) < 1e-9, d, h, c, ey };`),
  sewer("drips fall in the sewer and not in the cave", `DF.sim(3); const n = G.drips.length; DF.newRun(99); DF.sim(3);
  return { pass: n > 0 && n <= 40 && G.drips.length === 0, n };`),
  sewer("a drip lands as a ripple, is gone, and a new run starts with none", `DF.sim(4); let ok = true, rip = 0, peak = 0;
  for (let i = 0; i < 240; i++) { DF.sim(1 / 30); peak = Math.max(peak, G.drips.length); if (G.rings.some((r) => r.kind === "ripple")) rip++; }
  for (const q of G.drips) if (!(q.y > -1 && q.y <= w.ceilAt(q.x, q.z) + 0.01 && Math.hypot(q.x - p.x, q.z - p.z) <= 15.5)) ok = false;
  DF.newRun(5, "D"); return { pass: ok && rip > 0 && peak <= 40 && G.drips.length === 0, ok, rip, peak };`),
  sewer("wading in the sewer plays the wade sound on each footfall, not outside water", `let n = 0; const old = DF.SFX.wade; DF.SFX.wade = () => { n++; };
  p.x = w.spawn.x; p.z = w.spawn.z; w.waterAt = () => 1; DF.keys[DF.BIND.fwd] = true; DF.sim(2); DF.keys[DF.BIND.fwd] = false; const wet = n;
  n = 0; w.waterAt = () => 0; DF.keys[DF.BIND.fwd] = true; DF.sim(2); DF.keys[DF.BIND.fwd] = false; const dry = n; DF.SFX.wade = old;
  return { pass: wet >= 3 && wet <= 12 && dry === 0, wet, dry };`),
  sewer("a dodge in water splashes", `w.waterAt = () => 1; const r0 = G.rings.length, n0 = G.parts.length; DF.keys[DF.BIND.fwd] = true; DF.taps[DF.BIND.dodge] = true; DF.sim(0.1); DF.keys[DF.BIND.fwd] = false;
  const ok = p.state === "dodge" && G.rings.some((r) => r.kind === "ripple") && G.parts.length > n0; return { pass: ok, state: p.state, parts: G.parts.length - n0 };`),
  { ...sewer("the player wading through a pool, for looking at", `const n = w.nodes.find((n) => n.kind === "pool"); const b = w.bodies.filter((q) => q.room === n.id).sort((a, c) => c.n - a.n)[0];
  p.x = b.x; p.z = b.z; p.yaw = 0; DF.keys[DF.BIND.fwd] = true; DF.sim(0.3); DF.keys[DF.BIND.fwd] = false; for (const e of G.enemies) e.x += 500;
  cam.yaw = p.yaw + 0.5; cam.pitch = 0.25; cam.px = p.x; cam.pz = p.z; cam.cd = 4; return { pass: w.waterAt(p.x, p.z) > 0.9, wet: w.waterAt(p.x, p.z), b, n: n.id };`), wait: 500, shot: "t22-wade" },
  // standing just inside a tunnel gutter's drawn shore, 0.1 m into the water:
  // the body is drawn sunk by about half of WATER.sink, not standing on the
  // water
  { ...sewer("the player at a gutter's edge, for looking at", `let q = null;
    for (let x = w.minX + 2; x < w.minX + w.W - 2 && !q; x += 0.25) for (let z = w.minZ + 2; z < w.minZ + w.H - 2 && !q; z += 0.25) {
      const v = w.waterAt(x, z); if (v < 0.58 || v > 0.62 || w.fieldAt(x, z) < 1 || w.nodes.some((n) => Math.abs(x - n.x) < n.hw + 4 && Math.abs(z - n.z) < n.hd + 4)) continue;
      const gx = w.waterAt(x + 0.3, z) - w.waterAt(x - 0.3, z), gz = w.waterAt(x, z + 0.3) - w.waterAt(x, z - 0.3), l = Math.hypot(gx, gz); if (l < 0.3) continue;
      const tx = -gz / l, tz = gx / l; if ([-2, 2].every((s) => Math.abs(w.waterAt(x + tx * s, z + tz * s) - 0.6) < 0.08)) q = { x, z, a: Math.atan2(gx, gz) }; }
    if (!q) return { pass: false, why: "no straight gutter edge" };
    look(q.x, q.z, q.a + Math.PI / 2, 0.32); cam.yaw = q.a + 0.75; cam.cd = 3.2; p.state = "free";
    return { pass: true, at: q, wet: w.waterAt(q.x, q.z) };`), wait: 600, shot: "t22-gutter-edge" },
  step("the sunk body at the gutter's edge, read after two frames", `const p = G.player, y = DF.R.nodePos(p.fig.root, 0, 0, 0)[1], want = -DF.WATER.sink * G.world.waterAt(p.x, p.z);
    return { pass: Math.abs(y - want) < 0.02 && y < -0.1, y, want };`),
  sewer("a long room shows on the map as soon as the player is at its far end", `const n = w.nodes.filter((n) => n.kind !== "boss").sort((a, b) => Math.abs(b.hw - b.hd) - Math.abs(a.hw - a.hd))[0];
  const along = n.hw > n.hd, x = n.x + (along ? n.hw - 1.5 : 0), z = n.z + (along ? 0 : n.hd - 1.5), old = Math.hypot(x - n.x, z - n.z) >= n.r + 3;
  for (const m of w.nodes) m.seen = false; p.x = x; p.z = z; DF.sim(1 / 60);
  return { pass: n.seen && old && Math.hypot(p.x - x, p.z - z) < 0.5, seen: n.seen, old, hw: n.hw, hd: n.hd };`),
  step("the minimap draws water only in seen rooms and tunnels",`DF.newRun(5, "D"); const w = G.world;
  for (const n of w.nodes) n.seen = false; for (const e of w.edges) e.seen = false;
  const none = DF.HUD.mapWater(w).length;
  const pool = w.nodes.find((n) => n.kind === "pool"); pool.seen = true; const room = DF.HUD.mapWater(w);
  const inPool = room.every((q) => Math.abs(q.x - pool.x) < pool.hw + 1 && Math.abs(q.z - pool.z) < pool.hd + 1);
  for (const n of w.nodes) n.seen = true; for (const e of w.edges) e.seen = true; const all = DF.HUD.mapWater(w).length;
  DF.newRun(99); const cave = DF.HUD.mapWater(G.world).length;
  return { pass: none === 0 && room.length > 3 && inPool && all > room.length && cave === 0, none, room: room.length, inPool, all, cave };`),
  { ...sewer("the minimap in a pool room, for looking at", `for (const n of w.nodes) n.seen = true; for (const e of w.edges) e.seen = true; const n = w.nodes.find((n) => n.kind === "pool");
  // the map blown up to four times its size, to see what is on it
  const m = document.getElementById("map"); m.style.cssText = "width:640px;height:640px;right:20px;top:20px";
  return look(n.x, n.z - n.hd * 0.4, 0, 0.3);`), wait: 500, shot: "t22-map" },
  // culling: the sewer is cut into pieces, each with the pieces it can see.
  // The view is cast from where the camera sits: behind the player at its
  // full distance (1.35 times that in the boss cavern, as when the boss is
  // locked), over the shoulder and pulled in by the walls and vault as
  // camUpdate does. Six seeds; every 2 m on the way to the boss at four
  // headings, five spots in every room at eight and every third point of
  // every tunnel at four. Every walkable point in sight within the fog cutoff
  // must be in a piece that visiblePieces lists for a full turn
  step("everything the camera can see is in a drawn piece", `DF.LIVE_GRADES.add("D"); const cut = 2.146 / DF.ENV_SEWER.fogD, out = { views: 0, miss: 0, bad: [] };
  for (const s of [2, 5, 9, 11, 13, 21]) { DF.newRun(s, "D"); const w = G.world, P = [], bn = w.nodes.find((n) => n.kind === "boss");
    const camAt = (x, z, yaw, pitch, D) => { const fx = Math.sin(yaw), fz = Math.cos(yaw); let so = 0.6; if (w.fieldAt(x - fz * so, z + fx * so) < 0.5) so = 0;
      const vx = x - fz * so, vz = z + fx * so, cp = Math.cos(pitch), sp = Math.sin(pitch); let t = 1;
      for (let i = 1; i <= 16; i++) { const u = i / 16, X = vx - fx * cp * D * u, Y = 1.62 + sp * D * u, Z = vz - fz * cp * D * u; if (w.fieldAt(X, Z) < 0.4 || Y > w.ceilAt(X, Z) - 0.4 || Y < 0.35) { t = (i - 1) / 16; break; } }
      const cd = Math.max(0.6, D * t); return [vx - fx * cp * cd, vz - fz * cp * cd]; };
    const r = [w.spawn, ...w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6)];
    for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z); for (let t = 0; t < L; t += 2) P.push([a.x + ((b.x - a.x) * t) / L, a.z + ((b.z - a.z) * t) / L, yaw, 4]); }
    for (const n of w.nodes) for (const [u, v] of [[0, 0], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) P.push([n.x + u * n.hw, n.z + v * n.hd, 0.3, 8]);
    for (const e of w.edges) for (let i = 0; i < e.pts.length; i += 3) P.push([e.pts[i].x, e.pts[i].z, 0.7, 4]);
    for (const [x, z, y0, nh] of P) { if (w.fieldAt(x, z) < 0.5) continue; const inBoss = Math.abs(x - bn.x) < bn.hw + 4 && Math.abs(z - bn.z) < bn.hd + 4;
      for (let h = 0; h < nh; h++) for (const D of inBoss ? [DF.cam.dist, DF.cam.dist * 1.35] : [DF.cam.dist]) { const yaw = y0 + (h * 2 * Math.PI) / nh, [cx, cz] = camAt(x, z, yaw, h % 2 ? 0.45 : 0.1, D);
        const ids = new Set(DF.visiblePieces(w, cx, cz, x, z, false) || []); out.views++;
        look: for (let X = cx - cut; X <= cx + cut; X += 1) for (let Z = cz - cut; Z <= cz + cut; Z += 1) { const id = w.pieceAt(X, Z);
          if (id < 0 || ids.has(id) || (X - cx) ** 2 + (Z - cz) ** 2 > cut * cut || !(w.fieldAt(X, Z) > 0) || !w.los(cx, cz, X, Z)) continue;
          out.miss++; if (out.bad.length < 8) out.bad.push({ s, at: [Math.round(x), Math.round(z)], yaw: +yaw.toFixed(2), id, d: Math.round(Math.hypot(X - cx, Z - cz)) }); break look; } } } }
  return { pass: out.miss === 0 && out.views > 4000, ...out };`),
  sewer("the camera outside every piece still draws the player's pieces", `const ids = DF.visiblePieces(w, w.minX - 50, w.minZ - 50, w.spawn.x, w.spawn.z); return { pass: Array.isArray(ids) && ids.length > 0 };`),
  step("the cave and hall still draw whole", `DF.newRun(99); return { pass: G.world.pieces === null && DF.visiblePieces(G.world, 0, 0, 0, 0) === null && DF.genHub().pieces === null };`),
  // 20 points along the way to the boss in three seeds, two frames drawn at
  // each: the most world triangles drawn in a frame stays within E cave 99's
  // whole count
  { name: "the sewer draws no more in a frame than the whole of E cave 99", eval: `(async () => { const { G, cam } = DF; G.manual = true;
    DF.newRun(99); const cap = G.world.pos.length / 9, frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    DF.LIVE_GRADES.add("D"); let most = 0, at = null, fewest = 1e9;
    for (const s of [2, 5, 9]) { DF.newRun(s, "D"); DF.show("play"); G.state = "play"; const w = G.world, p = G.player; for (const e of G.enemies) e.x += 500;
      const r = [w.spawn, ...w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6)], cum = [0];
      for (let i = 1; i < r.length; i++) cum.push(cum[i - 1] + Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z));
      for (let k = 0; k < 20; k++) { const d = (cum[cum.length - 1] * (k + 0.5)) / 20; let i = 1; while (i < r.length - 1 && cum[i] < d) i++;
        const a = r[i - 1], b = r[i], t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        p.x = a.x + (b.x - a.x) * t; p.z = a.z + (b.z - a.z) * t; p.yaw = Math.atan2(b.x - a.x, b.z - a.z);
        cam.yaw = p.yaw; cam.pitch = 0.3; cam.px = p.x; cam.pz = p.z; await frame(); await frame();
        const n = DF.R.stats.tris; if (n > most) { most = n; at = [s, k]; } fewest = Math.min(fewest, n); } }
    return { pass: most <= cap && fewest > 0, most, cap, at, fewest }; })()` },
  // walking round a bend where one tunnel piece hands on to the next: look
  // for missing walls, floor or vault (the map back to its size first)
  ...[0, 1, 2].map((k) => ({ ...sewer("round a bend " + (k + 1) + ", for looking at", `document.getElementById("map").style.cssText = ""; const e = w.edges.find((e) => e.bends.length >= 3 && !w.nodes.some((n) => Math.abs(e.bends[2].x - n.x) < n.hw + 6 && Math.abs(e.bends[2].z - n.z) < n.hd + 6)) || w.edges.find((e) => e.bends.length >= 3);
    const c = e.bends[2], a = e.bends[1], b = e.bends[3] || w.nodes[e.b], yi = Math.atan2(c.x - a.x, c.z - a.z), yo = Math.atan2(b.x - c.x, b.z - c.z), k = ${k};
    const yaw = k === 0 ? yi : k === 1 ? yi + DF.angDiff(yi, yo) / 2 : yo, x = k === 0 ? c.x - Math.sin(yi) * 6 : k === 1 ? c.x : c.x + Math.sin(yo) * 6, z = k === 0 ? c.z - Math.cos(yi) * 6 : k === 1 ? c.z : c.z + Math.cos(yo) * 6;
    return { ...look(x, z, yaw, 0.2), piece: w.pieceAt(x, z) };`), wait: 500, shot: "t22-bend-" + (k + 1) })),
];
