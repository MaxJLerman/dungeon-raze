// Enemy pursuit: routes, lost sight and searching, leash, provoke, boss chamber.
// Run with: SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; DF.newRun(99); DF.show("play");
  let w = G.world, p = G.player; const P = DF.PURSUIT || {}, D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const put = (o, x, z) => { o.x = x; o.z = z; };
  // e stands at (x, z) and that spot is also its post
  const post = (e, x, z) => { put(e, x, z); e.hx = x; e.hz = z; };
  const only = (...es) => { G.enemies = es; };
  const hunt = (e) => { e.aware = true; e.state = "chase"; };
  const home = (e) => e.state === "idle" && !e.aware && Math.hypot(e.x - e.hx, e.z - e.hz) < 0.6;
  const safe = () => { p.hp = p.maxHp; if (p.state === "dead") p.state = "free"; };
  // every sim step keeps the player alive unless the body says otherwise
  const sim = (sec, each) => DF.sim(sec, (i) => { safe(); return each ? each(i) : undefined; });
  let rooms = w.nodes.filter((n) => n.kind === "room");
  // two joined rooms whose centres are at least min apart with no line of sight
  const pair = (min) => { for (const a of rooms) for (const j of a.adj) { const b = w.nodes[j]; if (b.kind === "room" && D(a, b) >= min && !w.los(a.x, a.z, b.x, b.z)) return [a, b]; } return null; };
  const type = (t) => G.enemies.find((q) => q.type === t);
  // start a cave from another seed and refresh the shortcuts
  const reseed = (s) => { DF.newRun(s); DF.show("play"); w = G.world; p = G.player; rooms = w.nodes.filter((n) => n.kind === "room"); };
  // lowest field value along the legs of [from, ...R], sampled every 0.5 m
  const clear = (R, from, f = w.fieldAt) => { let lo = 99, a = from; for (const b of R) { const n = Math.max(1, Math.ceil(D(a, b) / 0.5)); for (let i = 0; i <= n; i++) lo = Math.min(lo, f(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)); a = b; } return lo; };
  // the point dist metres along the legs of [from, ...R], clamped to the end
  const along = (R, from, dist) => { let a = from; for (const b of R) { const l = D(a, b); if (dist <= l) return { x: a.x + (b.x - a.x) * dist / (l || 1), z: a.z + (b.z - a.z) * dist / (l || 1) }; dist -= l; a = b; } return { x: a.x, z: a.z }; };
  const all = (c) => Object.values(c).every((v) => v === true);
  ${body} })()`,
});

export default [
  // ---- Task 1: world.route ----
  step("route exists", `
  const c = { cave: typeof w.route === "function", hub: typeof DF.genHub().route === "function", path: Array.isArray(w.path) };
  return { pass: all(c), c };`),
  step("start to boss on ten seeds", `
  const bad = []; let slow = 0;
  for (let s = 1; s <= 10; s++) { reseed(s * 7919); const t0 = performance.now(), R = w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.6); slow = Math.max(slow, performance.now() - t0);
    if (!R) { bad.push("none " + s); continue; }
    if (D(R[R.length - 1], w.boss) > 0.01) bad.push("end " + s);
    const lo = clear(R, w.spawn); if (!(lo >= 0.6)) bad.push("clear " + s + " " + lo.toFixed(2)); }
  return { pass: bad.length === 0 && slow < 30, bad, slowMs: +slow.toFixed(1) };`),
  step("every post is reachable at its own size", `
  const bad = []; let n = 0;
  for (let s = 1; s <= 10; s++) { reseed(s * 7919);
    for (const sp of w.spawns) { const r = DF.EDEF[sp.type].r, R = w.route(w.spawn.x, w.spawn.z, sp.x, sp.z, r); n++;
      if (!R) { bad.push("none " + s + " " + sp.type); continue; }
      const lo = clear(R, w.spawn); if (!(lo >= r)) bad.push("clear " + s + " " + sp.type + " " + lo.toFixed(2)); } }
  return { pass: bad.length === 0 && n > 100, n, bad: bad.slice(0, 8), nbad: bad.length };`),
  step("a route is direct in the open", `
  const n = rooms[0], R = w.route(n.x - 3, n.z, n.x + 3, n.z, 0.5);
  return { pass: !!R && R.length === 1 && Math.abs(R[0].x - (n.x + 3)) < 1e-6 && Math.abs(R[0].z - n.z) < 1e-6, R };`),
  step("a wide body avoids a narrow gap", `
  const a = w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 0.5), b = w.route(w.spawn.x, w.spawn.z, w.boss.x, w.boss.z, 1.35);
  const lo = b ? clear(b, w.spawn) : -9;
  return { pass: !!a && !!b && lo >= 1.35, lo, na: a && a.length, nb: b && b.length };`),
  step("no route is null", `
  const n = rooms[0]; let x = n.x; while (w.fieldAt(x, n.z) >= -1 && x < n.x + 60) x += 0.25;
  const timed = (f) => { const t0 = performance.now(); let r, threw = false; try { r = f(); } catch (e) { threw = String(e); } return { r, threw, ms: performance.now() - t0 }; };
  const off = timed(() => w.route(w.spawn.x, w.spawn.z, w.minX - 50, w.minZ - 50, 0.6));
  const nan = timed(() => w.route(w.spawn.x, w.spawn.z, NaN, 0, 0.6));
  const rock = timed(() => w.route(w.spawn.x, w.spawn.z, x, n.z, 0.6));
  const end = rock.r && rock.r[rock.r.length - 1];
  const c = { off: off.r === null, nan: nan.r === null, rock: !!end && w.fieldAt(end.x, end.z) >= 0.6, inRock: w.fieldAt(x, n.z) < -1,
    quiet: !off.threw && !nan.threw && !rock.threw, fast: off.ms < 30 && nan.ms < 30 && rock.ms < 30 };
  return { pass: all(c), c, ms: [off.ms, nan.ms, rock.ms].map((v) => +v.toFixed(1)) };`),
  step("the hall routes round a pillar", `
  // a pillar stands at (-12, -9); a brazier at (-12, -5) rules out going further north
  const h = DF.genHub(), from = { x: -12, z: -11.5 }, R = h.route(-12, -11.5, -12, -7, 0.5);
  const c = { pre: h.fieldAt(-12, -11.5) >= 0.8 && h.fieldAt(-12, -7) >= 0.8 && h.fieldAt(-12, -9) < 0, ends: !!R && D(R[R.length - 1], { x: -12, z: -7 }) < 0.01, found: !!R, bends: !!R && R.length > 1, clear: !!R && clear(R, from, h.fieldAt) >= 0.5 };
  return { pass: all(c), c, R };`),
];
