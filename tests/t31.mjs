// The big cave: 36 rooms for two players, drawn whole (genWorld with big).
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
  // to look at: the start, a room on the route, a tunnel on the route and the
  // Warden's chamber from its entrance
  { ...cave("the start, for looking at", `return look(w.spawn.x, w.spawn.z, w.spawnYaw, 0.3);`), wait: 400, shot: "t31-start" },
  { ...cave("a room on the route, for looking at", `const n = w.nodes[w.path[2]]; return { ...look(n.x, n.z - n.r * 0.4, 0, 0.42), n: n.id };`), wait: 400, shot: "t31-room" },
  { ...cave("a tunnel on the route, for looking at", `const a0 = w.path[3], b0 = w.path[4], e = w.edges.find((e) => (e.a === a0 && e.b === b0) || (e.a === b0 && e.b === a0));
  const pts = e.a === a0 ? e.pts : e.pts.slice().reverse(), k = (pts.length / 2) | 0, a = pts[k - 1], b = pts[k + 1];
  return look(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z), 0.22);`), wait: 400, shot: "t31-tunnel" },
  { ...cave("the Warden's chamber, for looking at", `const b = w.boss, ent = w.nodes[w.path[w.path.length - 2]], a = Math.atan2(ent.x - b.x, ent.z - b.z);
  return look(b.x + Math.sin(a) * (b.r - 3), b.z + Math.cos(a) * (b.r - 3), a + Math.PI, 0.3);`), wait: 400, shot: "t31-boss" },
];
