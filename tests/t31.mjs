// The big cave: 36 rooms for two players, drawn in pieces (genWorld with big).
// Run with: SCRIPT=$PWD/tests/t31.mjs node test.mjs smoke
const step = (name, body) => ({ name, eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} })()` });
// a big cave run from a seed, with a helper that puts the player and camera
// somewhere to look
const cave = (name, body, seed = 7) => step(name, `DF.newRun(${seed}, "E", true); DF.show("play"); G.state = "play";
  const w = G.world, p = G.player;
  const look = (x, z, yaw, pitch) => { p.x = x; p.z = z; p.yaw = yaw; cam.yaw = yaw; cam.pitch = pitch; cam.px = x; cam.pz = z; cam.cd = 5.6; for (const e of G.enemies) e.x += 500; return { pass: true }; };
  ${body}`);
// the route indices the rest rule gives a route of L rooms
const REST = `const restAt = (L) => { const r = [0]; for (let i = 3; i <= L - 4; i += 3) r.push(i); r.push(L - 2); return r; };`;
export default [
  step("a plain run is the small cave", `const look = () => ({ big: G.world.big, nodes: G.world.nodes.length, enemies: G.enemies.length });
  DF.newRun(99); const a = look(); DF.enterCave("E", 99); const b = look();
  const ok = (o) => o.big === false && o.nodes === 16 && o.enemies === 47;
  return { pass: ok(a) && ok(b), a, b };`),
  step("36 rooms, every one reachable", `const got = {}; let ok = true;
  for (const s of [1, 7, 99]) { DF.newRun(s, "E", true); const w = G.world;
    const r = w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6);
    const c = { big: w.big === true, n: w.nodes.length === 36, depth: w.nodes.every((n) => n.depth >= 0),
      start: w.start === w.nodes[0] && w.start.r === 9.5, boss: w.boss === w.nodes[35] && w.boss.r === 16.5, route: r !== null };
    got[s] = c; if (!Object.values(c).every(Boolean)) ok = false; }
  return { pass: ok, got };`),
  step("the route is at least 10 rooms", `const lens = {}; let short = [];
  for (let s = 1; s <= 200; s++) { const L = DF.bigCaveGraph(s).path.length; lens[L] = (lens[L] || 0) + 1; if (L < 10) short.push(s); }
  const same = [1, 7, 99].every((s) => { const g = DF.bigCaveGraph(s).path.join(); DF.newRun(s, "E", true); return G.world.path.join() === g; });
  return { pass: short.length === 0 && same, lens, short, same };`),
  step("the same seed gives the same cave", `DF.newRun(7, "E", true); const a = G.world; DF.newRun(7, "E", true); const b = G.world;
  const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  const c = { fresh: a !== b, pos: eq(a.pos, b.pos), spawns: JSON.stringify(a.spawns) === JSON.stringify(b.spawns), path: a.path.join() === b.path.join() };
  return { pass: Object.values(c).every(Boolean), c, tris: a.pos.length / 9 };`),
  step("rest points are spread along the route", `${REST} const bad = {}, counts = {};
  for (let s = 1; s <= 20; s++) { DF.newRun(s, "E", true); const w = G.world, L = w.path.length;
    const at = w.shrines.map((q) => w.path.indexOf(q.node)), want = restAt(L), rest = new Set(w.shrines.map((q) => q.node));
    const c = { rule: at.join() === want.join(), apart: at.every((v, i) => i === 0 || v - at[i - 1] >= 2),
      four: L < 10 || L > 12 || at.length === 4, lit: w.shrines[0].lit === true && w.shrines.slice(1).every((q) => !q.lit),
      empty: w.spawns.every((e) => !rest.has(e.node)) };
    counts[s] = L + ":" + at.join("/"); if (!Object.values(c).every(Boolean)) bad[s] = { c, at, want }; }
  return { pass: Object.keys(bad).length === 0, bad, counts };`),
  step("packs deepen with the cave", `const bad = {}, top = {}, totals = {};
  for (let s = 1; s <= 20; s++) { DF.newRun(s, "E", true); const w = G.world, groups = {};
    for (const e of w.spawns) if (e.node >= 0 && e.type !== "warden") (groups[e.node] = groups[e.node] || []).push(e.type);
    const ids = Object.keys(groups).map(Number), deep = Math.max(...ids.map((i) => w.nodes[i].depth)), use = {};
    const c = { shallow: true, deep: true };
    for (const i of ids) { const pk = groups[i].join(), d = w.nodes[i].depth, brutes = groups[i].filter((t) => t === "brute").length;
      use[pk] = (use[pk] || 0) + 1;
      if (d === 1 && pk !== "husk,husk" && pk !== "husk,husk,spit") c.shallow = false;
      if (d === deep && brutes < 2) c.deep = false; }
    const most = Math.max(...Object.values(use)); top[s] = Math.round((most / ids.length) * 100) + "%";
    c.mixed = most <= ids.length / 2;
    const wardens = w.spawns.filter((e) => e.type === "warden");
    c.warden = wardens.length === 1 && wardens[0].node === w.boss.id && wardens[0].x === w.boss.x && wardens[0].z === w.boss.z;
    totals[s] = w.spawns.length;
    if (!Object.values(c).every(Boolean)) bad[s] = { c, use }; }
  return { pass: Object.keys(bad).length === 0, bad, top, totals };`),
  step("tunnel guards stay out of the Warden's keep-out", `const bad = {}, posts = {};
  for (let s = 1; s <= 20; s++) { DF.newRun(s, "E", true); const w = G.world, b = w.boss, keep = b.r + DF.PURSUIT.bossPad;
    const g = w.spawns.filter((e) => e.node === -1); posts[s] = g.length;
    const near = g.filter((e) => Math.hypot(e.x - b.x, e.z - b.z) < keep); if (near.length) bad[s] = near; }
  return { pass: Object.keys(bad).length === 0, bad, posts };`),
  step("as lit as the small cave", `const got = {}; let ok = true;
  for (const s of [1, 7, 99]) { DF.newRun(s, "E", true); const w = G.world, L = w.lights, b = w.boss;
    let close = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z) < 12.5) close++;
    const red = L.filter((q) => Math.hypot(q.x - b.x, q.z - b.z) < 40);
    const c = { n: L.length, count: L.length >= 100 && L.length <= 116, apart: close === 0, red: red.length > 0 && red.every((q) => q.c === DF.CRY.red) };
    got[s] = c; if (!(c.count && c.apart && c.red)) ok = false; }
  return { pass: ok, got };`),
  step("big is for grade E only", `DF.newRun(5, "D", true); const w = G.world;
  return { pass: w.sewer === true && !w.big, sewer: w.sewer, big: w.big };`),
  // culling: the big cave is cut into pieces as the sewer is (t22)
  step("the big cave is in pieces and the small cave is not", `DF.newRun(99, "E", true); const w = G.world, ps = w.pieces || [], nv = w.pos.length / 3;
  const rs = ps.map((q) => [q.first, q.count]).sort((a, b) => a[0] - b[0]); let end = 0, apart = true;
  for (const [f, n] of rs) { if (f < end || n < 0) apart = false; end = f + n; }
  const c = { n: ps.length >= 150 && ps.length <= 230, all: ps.reduce((a, q) => a + q.count, 0) === nv && end <= nv, apart, cut: Math.abs(w.cut - 71.53) < 0.01 };
  const n = ps.length, cut = w.cut; DF.newRun(99); const s = G.world; c.small = s.pieces === null && s.cut === 0 && DF.visiblePieces(s, 0, 0, 0, 0) === null;
  return { pass: Object.values(c).every(Boolean), c, n, cut };`),
  // The view is cast from where the camera sits, as t22 does for the sewer:
  // every 2 m on the way to the boss at four headings, five spots in every
  // room at eight (the centre and the four corners, 0.6 of its radius off it
  // on both axes at once, as t22 takes 0.6 of a room's half sizes) and every
  // third point of every tunnel at four, the camera also at 1.35 times its
  // distance near the Warden. Every walkable point in sight within the cut
  // must be in a listed piece, and the listed pieces never hold more
  // triangles than the whole of cave 99. Without CAVE_PIECE.slack seeds 5
  // and 13 miss here
  step("everything the camera can see is in a drawn piece", `DF.newRun(99); const cap = G.world.pos.length / 9, out = { views: 0, miss: 0, bad: [], most: 0, at: null, sum: 0 };
  for (const s of [1, 5, 7, 13, 42, 99]) { DF.newRun(s, "E", true); const w = G.world, P = [], bn = w.boss, cut = w.cut, tris = w.pieces.map((q) => q.count / 3);
    const camAt = (x, z, yaw, pitch, D) => { const fx = Math.sin(yaw), fz = Math.cos(yaw); let so = 0.6; if (w.fieldAt(x - fz * so, z + fx * so) < 0.5) so = 0;
      const vx = x - fz * so, vz = z + fx * so, cp = Math.cos(pitch), sp = Math.sin(pitch); let t = 1;
      for (let i = 1; i <= 16; i++) { const u = i / 16, X = vx - fx * cp * D * u, Y = 1.62 + sp * D * u, Z = vz - fz * cp * D * u; if (w.fieldAt(X, Z) < 0.4 || Y > w.ceilAt(X, Z) - 0.4 || Y < 0.35) { t = (i - 1) / 16; break; } }
      const cd = Math.max(0.6, D * t); return [vx - fx * cp * cd, vz - fz * cp * cd]; };
    const r = [w.spawn, ...w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6)];
    for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z); for (let t = 0; t < L; t += 2) P.push([a.x + ((b.x - a.x) * t) / L, a.z + ((b.z - a.z) * t) / L, yaw, 4]); }
    for (const n of w.nodes) for (const [u, v] of [[0, 0], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) P.push([n.x + u * n.r, n.z + v * n.r, 0.3, 8]);
    for (const e of w.edges) for (let i = 0; i < e.pts.length; i += 3) P.push([e.pts[i].x, e.pts[i].z, 0.7, 4]);
    for (const [x, z, y0, nh] of P) { if (w.fieldAt(x, z) < 0.5) continue; const inBoss = Math.hypot(x - bn.x, z - bn.z) < bn.r + 4;
      for (let h = 0; h < nh; h++) for (const D of inBoss ? [DF.cam.dist, DF.cam.dist * 1.35] : [DF.cam.dist]) { const yaw = y0 + (h * 2 * Math.PI) / nh, [cx, cz] = camAt(x, z, yaw, h % 2 ? 0.45 : 0.1, D);
        const list = DF.visiblePieces(w, cx, cz, x, z, false) || [], ids = new Set(list); out.views++;
        let n = 0; for (const id of list) n += tris[id]; out.sum += n; if (n > out.most) { out.most = n; out.at = [s, Math.round(x), Math.round(z)]; }
        look: for (let X = cx - cut; X <= cx + cut; X += 1) for (let Z = cz - cut; Z <= cz + cut; Z += 1) { const id = w.pieceAt(X, Z);
          if (id < 0 || ids.has(id) || (X - cx) ** 2 + (Z - cz) ** 2 > cut * cut || !(w.fieldAt(X, Z) > 0) || !w.los(cx, cz, X, Z)) continue;
          out.miss++; if (out.bad.length < 8) out.bad.push({ s, at: [Math.round(x), Math.round(z)], yaw: +yaw.toFixed(2), id, d: Math.round(Math.hypot(X - cx, Z - cz)) }); break look; } } } }
  const avg = Math.round(out.sum / out.views); window.__t31view = { most: out.most, avg, at: out.at, cap };
  return { pass: out.miss === 0 && out.views > 4000, views: out.views, miss: out.miss, bad: out.bad };`),
  step("no view lists more than the whole of cave 99", `const v = window.__t31view || {}; return { pass: v.most > 0 && v.most <= v.cap, ...v };`),
  // 20 points along the way to the boss in three seeds, two frames drawn at
  // each: the most world triangles drawn in a frame stays within cave 99's
  // whole count
  { name: "the big cave draws no more in a frame than the whole of cave 99", eval: `(async () => { const { G, cam } = DF; G.manual = true;
    DF.newRun(99); const cap = G.world.pos.length / 9, frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    let most = 0, at = null, fewest = 1e9;
    for (const s of [1, 7, 99]) { DF.newRun(s, "E", true); DF.show("play"); G.state = "play"; const w = G.world, p = G.player; for (const e of G.enemies) e.x += 500;
      const r = [w.spawn, ...w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6)], cum = [0];
      for (let i = 1; i < r.length; i++) cum.push(cum[i - 1] + Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z));
      for (let k = 0; k < 20; k++) { const d = (cum[cum.length - 1] * (k + 0.5)) / 20; let i = 1; while (i < r.length - 1 && cum[i] < d) i++;
        const a = r[i - 1], b = r[i], t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        p.x = a.x + (b.x - a.x) * t; p.z = a.z + (b.z - a.z) * t; p.yaw = Math.atan2(b.x - a.x, b.z - a.z);
        cam.yaw = p.yaw; cam.pitch = 0.3; cam.px = p.x; cam.pz = p.z; await frame(); await frame();
        const n = DF.R.stats.tris; if (n > most) { most = n; at = [s, k]; } fewest = Math.min(fewest, n); } }
    return { pass: most <= cap && fewest > 0, most, cap, at, fewest }; })()` },
  // a player who crosses the cave at once (as a co-op partner's view can)
  // is drawn from the pieces where they now stand
  { name: "a player moved across the cave is drawn where they stand", eval: `(async () => { const { G, cam } = DF; G.manual = true; const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    DF.newRun(99, "E", true); DF.show("play"); G.state = "play"; const w = G.world, p = G.player; for (const e of G.enemies) e.x += 500;
    const from = w.pieceAt(p.x, p.z); await frame(); await frame();
    const n = w.nodes[w.path[w.path.length - 2]]; p.x = n.x; p.z = n.z; cam.px = p.x; cam.pz = p.z; await frame(); await frame();
    const tris = DF.R.stats.tris, here = w.pieceAt(p.x, p.z), ids = DF.visiblePieces(w, DF.R.cam.x, DF.R.cam.z, p.x, p.z) || [];
    // the list is the frame's: the triangles drawn are the listed pieces' (the renderer's camera is still the frame's)
    const listed = ids.reduce((a, id) => a + w.pieces[id].count / 3, 0);
    return { pass: tris > 0 && here >= 0 && from >= 0 && ids.includes(here) && !ids.includes(from) && tris === listed, tris, listed, here, from, n: ids.length }; })()` },
  step("the camera outside every piece still draws the player's pieces", `DF.newRun(99, "E", true); const w = G.world, b = w.boss, own = w.pieceAt(b.x, b.z);
  const out = DF.visiblePieces(w, w.minX - 50, w.minZ - 50, w.spawn.x, w.spawn.z), miss = [];
  for (let h = 0; h < 8; h++) { const yaw = (h * Math.PI) / 4, ids = DF.visiblePieces(w, b.x - Math.sin(yaw) * 22, b.z - Math.cos(yaw) * 22, b.x, b.z, false) || [];
    if (!ids.includes(own)) miss.push(h); }
  return { pass: Array.isArray(out) && out.length > 0 && own >= 0 && miss.length === 0, outside: out && out.length, own, miss };`),
  step("the big cave builds in under 2 seconds", `const t0 = performance.now(); DF.newRun(11, "E", true); const ms = Math.round(performance.now() - t0);
  return { pass: ms < 2000, ms, aim: 800 };`),
  // the mesh, route, spawns and pieces for three seeds: a change that only
  // moves code must leave these as they are
  step("the big cave is unchanged", `const GOLD = {"1":[49292376,-1715126544,"0,7,13,14,8,9,15,22,28,34,35",-119219537,-1372375455],"7":[-533294947,-1454439616,"0,1,2,3,9,16,22,28,29,35",1908779748,558383828],"99":[-1104761871,-544085576,"0,6,12,18,19,20,27,33,34,35",1892390956,-1106085883]};
  const h = (a) => { let x = 0; for (let i = 0; i < a.length; i++) x = (x * 31 + Math.round(a[i] * 1000)) | 0; return x; };
  const hs = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  const got = {}; for (const s of [1, 7, 99]) { DF.newRun(s, "E", true); const w = G.world;
    got[s] = [h(w.pos), h(w.col), w.path.join(","), hs(JSON.stringify(w.spawns)), hs(JSON.stringify(w.pieces)) ^ h(w.pieceGrid)]; }
  return { pass: JSON.stringify(got) === JSON.stringify(GOLD), got };`),
  // to look at: the start, a room on the route, a tunnel on the route and the
  // Warden's chamber from its entrance
  { ...cave("the start, for looking at", `return look(w.spawn.x, w.spawn.z, w.spawnYaw, 0.3);`), wait: 400, shot: "t31-start" },
  { ...cave("a room on the route, for looking at", `const n = w.nodes[w.path[2]]; return { ...look(n.x, n.z - n.r * 0.4, 0, 0.42), n: n.id };`), wait: 400, shot: "t31-room" },
  { ...cave("a tunnel on the route, for looking at", `const a0 = w.path[3], b0 = w.path[4], e = w.edges.find((e) => (e.a === a0 && e.b === b0) || (e.a === b0 && e.b === a0));
  const pts = e.a === a0 ? e.pts : e.pts.slice().reverse(), k = (pts.length / 2) | 0, a = pts[k - 1], b = pts[k + 1];
  return look(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z), 0.22);`), wait: 400, shot: "t31-tunnel" },
  { ...cave("the Warden's chamber, for looking at", `const b = w.boss, ent = w.nodes[w.path[w.path.length - 2]], a = Math.atan2(ent.x - b.x, ent.z - b.z);
  return look(b.x + Math.sin(a) * (b.r - 3), b.z + Math.cos(a) * (b.r - 3), a + Math.PI, 0.3);`), wait: 400, shot: "t31-boss" },
  // the minimap with every room and tunnel seen, at its size and blown up
  // to four times it, to see what is on it
  { ...cave("the minimap, for looking at", `for (const n of w.nodes) n.seen = true; for (const e of w.edges) e.seen = true; const n = w.nodes[w.path[2]];
  return look(n.x, n.z - n.r * 0.4, 0, 0.3);`), wait: 500, shot: "t31-map" },
  { ...step("the minimap blown up, for looking at", `const m = document.getElementById("map"); m.style.cssText = "width:640px;height:640px;right:20px;top:20px"; return { pass: true };`), wait: 500, shot: "t31-map-big" },
  // the longest clear sight line from a room's edge across the room into a
  // tunnel: look for anything appearing at the cut distance
  { ...cave("the longest view, for looking at", `document.getElementById("map").style.cssText = ""; let best = null;
  for (const e of w.edges) for (const end of [e.a, e.b]) { const n = w.nodes[end], pts = end === e.a ? e.pts : e.pts.slice().reverse(), out = pts.find((q) => Math.hypot(q.x - n.x, q.z - n.z) > n.r);
    if (!out) continue; const a = Math.atan2(out.x - n.x, out.z - n.z), x = n.x - Math.sin(a) * (n.r - 2.5), z = n.z - Math.cos(a) * (n.r - 2.5);
    if (w.fieldAt(x, z) < 1) continue;
    for (let k = pts.length - 1; k > 0; k--) { const q = pts[k], d = Math.hypot(q.x - x, q.z - z); if (best && d <= best.d) break; if (w.los(x, z, q.x, q.z)) { best = { x, z, yaw: Math.atan2(q.x - x, q.z - z), d }; break; } } }
  return { ...look(best.x, best.z, best.yaw, 0.12), d: Math.round(best.d), cut: Math.round(w.cut) };`, 99), wait: 500, shot: "t31-far" },
  // round the sharpest bend of a tunnel clear of every room, as t22 walks the
  // sewer's: look for missing walls, floor or ceiling
  ...[0, 1, 2].map((k) => ({ ...cave("round a bend " + (k + 1) + ", for looking at", `let best = null;
    for (const e of w.edges) for (let i = 2; i < e.pts.length - 2; i++) { const c = e.pts[i]; if (w.nodes.some((n) => Math.hypot(c.x - n.x, c.z - n.z) < n.r + 6)) continue;
      const a = e.pts[i - 2], b = e.pts[i + 2], yi = Math.atan2(c.x - a.x, c.z - a.z), yo = Math.atan2(b.x - c.x, b.z - c.z), turn = Math.abs(DF.angDiff(yi, yo));
      if (!best || turn > best.turn) best = { c, yi, yo, turn }; }
    const { c, yi, yo } = best, k = ${k};
    const yaw = k === 0 ? yi : k === 1 ? yi + DF.angDiff(yi, yo) / 2 : yo, x = k === 0 ? c.x - Math.sin(yi) * 6 : k === 1 ? c.x : c.x + Math.sin(yo) * 6, z = k === 0 ? c.z - Math.cos(yi) * 6 : k === 1 ? c.z : c.z + Math.cos(yo) * 6;
    return { ...look(x, z, yaw, 0.2), turn: +best.turn.toFixed(2), piece: w.pieceAt(x, z) };`), wait: 500, shot: "t31-bend-" + (k + 1) })),
];
