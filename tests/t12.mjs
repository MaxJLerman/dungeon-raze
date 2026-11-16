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
  // and, with far, both at least that far from the start
  const pair = (min, far = 0) => { for (const a of rooms) for (const j of a.adj) { const b = w.nodes[j]; if (b.kind === "room" && D(a, b) >= min && D(a, w.spawn) >= far && D(b, w.spawn) >= far && !w.los(a.x, a.z, b.x, b.z)) return [a, b]; } return null; };
  // the same, trying seeds until one has such a pair; returns [a, b, seed]
  const pairAny = (min, far) => { for (let s = 99; s < 140; s++) { if (s !== 99) reseed(s); const q = pair(min, far); if (q) return [...q, s]; } return null; };
  const husks = () => G.enemies.filter((q) => q.type === "husk");
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

// One enemy of a kind posted 3 m north of a room's centre, hunting a player
// who stands 3 m south of it. seen is where the player stood. hide() moves the
// player down the tunnel toward the next room and reports that the enemy
// cannot see them there.
const scene = (kind = "husk") => `
  const q0 = pair(24, 40); if (!q0) return { pass: false, pre: false };
  const [a, b] = q0, e = type("${kind}"); only(e); post(e, a.x, a.z + 3); e.yaw = Math.PI; e.cd = 9; put(p, a.x, a.z - 3); p.vx = p.vz = 0; hunt(e);
  const seen = { x: p.x, z: p.z };
  // the hiding place: the first point down the tunnel toward the next room that is out of
  // sight of the room and beyond hunting sight range
  const R0 = w.route(a.x, a.z, b.x, b.z, 0.6); let hs = null;
  for (let d = 20; R0 && d < 90 && !hs; d++) { const q = along(R0, a, d); if ([[a.x, a.z + 3], [a.x, a.z], [seen.x, seen.z]].every((o) => Math.hypot(o[0] - q.x, o[1] - q.z) > 25 && !w.los(o[0], o[1], q.x, q.z))) hs = q; }
  if (!hs) return { pass: false, pre: false };
  const hide = () => { put(p, hs.x, hs.z); p.vx = p.vz = 0; return !w.los(e.x, e.z, p.x, p.z) && D(e, p) > 22.5; };
  // a second enemy beside the first, hunting too
  const mate = (m, dx) => { post(m, a.x + dx, a.z + 3); m.yaw = Math.PI; m.cd = 9; hunt(m); G.enemies.push(m); return m; };
  const nan = (o) => !(o.x === o.x && o.z === o.z);`;

// Two husks walking home through a room that is more than a leash from their
// posts, with the player beside them and outside both territories.
const away = `
  const q0 = pair(38, 40); if (!q0) return { pass: false, pre: false };
  const [a, b] = q0, e = husks()[0], m = husks()[1]; only(e, m);
  [e, m].forEach((q, i) => { put(q, a.x + i * 2, a.z + 3); q.hx = b.x + i * 2; q.hz = b.z; q.yaw = Math.PI; q.aware = false; q.state = "return"; q.route = null; });
  put(p, a.x, a.z - 3); p.vx = p.vz = 0;
  const hunting = (q) => q.aware === true && !["idle", "return", "dead"].includes(q.state);
  const walking = (q) => !q.aware && (q.state === "return" || q.state === "idle");`;
// A husk posted in a room chases a player who keeps 7 m ahead of it down the
// route to the next room, always in view.
const lead = (setup = "") => `
  const q0 = pair(40, 40); if (!q0) return { pass: false, pre: false };
  const [a, b] = q0, e = type("husk"); only(e); post(e, a.x, a.z); ${setup} const R = w.route(a.x, a.z, b.x, b.z, 0.6); hunt(e);
  let s = 0, most = 0, view = false, last = false; const H = { x: e.hx, z: e.hz };
  sim(40, () => { while (s < 200 && D(along(R, a, s), e) < 7) s += 0.1; const q = along(R, a, s); put(p, q.x, q.z); p.vx = p.vz = 0;
    most = Math.max(most, D(e, H)); if (e.state === "return") { view = last; return false; } last = w.los(e.x, e.z, p.x, p.z) && D(e, p) < 22.5; });
  const gave = e.state === "return"; sim(40, () => !home(e));`;

// The tunnel mouth of the boss chamber. at(k) is the first point down the
// route out of the chamber that is boss.r + k from its centre, so a negative
// k is inside. A husk and a spitter are posted just outside, where they can
// see in, and hunting a player who stands further up the tunnel. inside()
// moves the player in.
const mouth = `
  const B = w.boss, prev = w.nodes[w.path[w.path.length - 2]], R = w.route(B.x, B.z, prev.x, prev.z, 0.6);
  const at = (k) => { for (let d = 0; d < 120; d += 0.5) { const q = along(R, B, d); if (D(q, B) >= B.r + k) return q; } return null; };
  const h = type("husk"), s = type("spit"), boss0 = type("warden"), ph = at(4), ps = at(7), out = at(14);
  // deep: a spot at least 2 m inside the chamber that both posts can see
  let deep = null; for (let k = -2; k >= -14 && !deep; k--) { const q = at(k); if (q && ph && ps && w.los(ph.x, ph.z, q.x, q.z) && w.los(ps.x, ps.z, q.x, q.z)) deep = q; }
  if (!R || !ph || !ps || !out || !deep) return { pass: false, pre: false };
  only(h, s); post(h, ph.x, ph.z); post(s, ps.x, ps.z); hunt(h); hunt(s); put(p, out.x, out.z); p.vx = p.vz = 0; sim(0.5);
  const inside = () => { put(p, deep.x, deep.z); p.vx = p.vz = 0; };
  const idle = (q) => q.state === "idle" && !q.aware;`;
// The same, run on until the player has been inside for 14 seconds.
const shed = mouth + `
  const sees = w.los(h.x, h.z, deep.x, deep.z) && D(h, deep) < 22.5; inside(); let shots = false, within = false, quick = false;
  sim(14, (i) => { if (i === 150) quick = !h.aware && !s.aware; if (i < 300) return; shots = shots || G.projs.some((q) => q.own === "e" && q.src && !q.src.def.boss); within = within || D(h, B) < B.r || D(s, B) < B.r; });`;

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
  // ---- Task 2: following a route, going home, the boss round rock ----
  step("a returning enemy rounds the bend home", `
  // every joined pair of rooms on this seed with no line of sight, both ways
  const e = type("husk"), bad = []; let n = 0; only(e); put(p, w.spawn.x, w.spawn.z);
  for (const a of rooms) for (const j of a.adj) { const b = w.nodes[j]; if (b.kind !== "room" || D(a, w.spawn) < 40 || D(b, w.spawn) < 40 || w.los(a.x, a.z, b.x, b.z)) continue;
    n++; e.hx = a.x; e.hz = a.z; put(e, b.x, b.z); e.aware = false; e.state = "return"; e.route = null; sim(60, () => !home(e));
    if (!home(e)) bad.push(a.id + "<-" + b.id + " left " + D(e, { x: e.hx, z: e.hz }).toFixed(1)); }
  return { pass: n >= 4 && bad.length === 0, n, bad };`),
  step("far return", `
  const q = pairAny(30, 80); if (!q) return { pass: false, pre: false };
  const [a, b, seed] = q, e = type("husk"); only(e); e.hx = a.x; e.hz = a.z; put(e, b.x, b.z); e.aware = false; e.state = "return"; put(p, w.spawn.x, w.spawn.z);
  let near = 1e9; sim(60, () => { near = Math.min(near, D(e, p)); return !home(e); });
  return { pass: home(e) && near > 75, seed, near: +near.toFixed(1), left: +D(e, { x: e.hx, z: e.hz }).toFixed(1), state: e.state };`),
  step("an unreachable post does not freeze the walk", `
  const n = rooms.slice().sort((a, b) => D(a, w.spawn) - D(b, w.spawn))[1], e = type("husk"); only(e); put(e, n.x, n.z); e.hx = w.minX - 50; e.hz = n.z; e.aware = false; e.state = "return";
  put(p, n.x, n.z + 40); const x0 = e.x, z0 = e.z; let threw = false; try { DF.sim(2); } catch (err) { threw = String(err); }
  const moved = Math.hypot(e.x - x0, e.z - z0);
  return { pass: moved > 3 && e.x === e.x && e.z === e.z && !threw, moved: +moved.toFixed(1), threw };`),
  step("route budget", `
  const q = pairAny(30, 40); if (!q) return { pass: false, pre: false };
  const [a, b] = q, es = husks().slice(0, 4); only(...es); put(p, w.spawn.x, w.spawn.z);
  es.forEach((e, i) => { e.hx = a.x + i; e.hz = a.z; put(e, b.x + i * 1.5 - 2, b.z); e.aware = false; e.state = "return"; });
  DF.update(1 / 60); const n1 = es.filter((e) => e.route).length; DF.update(1 / 60); const n2 = es.filter((e) => e.route).length;
  return { pass: es.length === 4 && n1 === 2 && n2 === 4, n1, n2 };`),
  step("the boss walks round rock", `
  let spot = null, seed = 0, e, prev;
  for (let s = 99; s < 140 && !spot; s++) { if (s !== 99) reseed(s); seed = s; e = type("warden"); prev = w.nodes[w.path[w.path.length - 2]];
    const R = w.route(e.x, e.z, prev.x, prev.z, 0.6); if (!R) continue;
    for (let d = 6; d < 60; d++) { const q = along(R, e, d); if (D(q, e) < 28 && !w.los(e.x, e.z, q.x, q.z)) { spot = q; break; } } }
  if (!spot) return { pass: false, pre: false };
  only(e); hunt(e); put(p, spot.x, spot.z); p.vx = p.vz = 0; const d0 = D(e, p); let aware = true, never = true, routed = false;
  sim(3, () => { aware = aware && e.aware; never = never && e.state !== "return"; routed = routed || !!e.route; });
  const c = { aware, never, routed, closer: D(e, p) < d0 - 2 };
  return { pass: all(c), c, seed, d0: +d0.toFixed(1), d1: +D(e, p).toFixed(1) };`),
  // ---- Task 3: sight, memory and the search state ----
  step("a chasing enemy remembers where it saw the player", scene() + `
  sim(0.3); const c = { seen: e.lost === 0, where: Math.hypot(e.lsx - p.x, e.lsz - p.z) < 0.3 };
  return { pass: all(c), c, lost: e.lost };`),
  step("lost sight", scene() + `
  sim(0.3); const hp = e.hp, pre = hide(); let first = -1, least = 1e9, most = 0, reached = false, bad = false;
  sim(40, (i) => { const d = D(e, seen); if (e.state === "search" && first < 0) first = i; least = Math.min(least, d); if (d < 1.5) reached = true;
    if (reached && e.state === "search") most = Math.max(most, d); bad = bad || nan(e); return !home(e); });
  const c = { pre, searched: first >= 0 && first <= 30, reached: least < 1.5, stayed: most < 2.5, home: home(e), hp: e.hp === hp, nan: !bad };
  return { pass: all(c), c, first, least: +least.toFixed(2), most: +most.toFixed(2), state: e.state };`),
  step("the guess carries on the way the player went", scene() + `
  sim(0.3); const pre = hide(); e.lvx = 0; e.lvz = -5; const subs = []; let south = 0;
  sim(40, () => { if (e.state === "search") { if (subs[subs.length - 1] !== e.sub) subs.push(e.sub); south = Math.max(south, seen.z - e.z); } return !home(e); });
  const c = { pre, order: subs.join() === "go,guess,look", far: south > 3, capped: south <= 8.5, home: home(e) };
  return { pass: all(c), c, subs, south: +south.toFixed(2) };`),
  step("seen again", scene() + `
  sim(0.3); const pre = hide(); sim(3, () => e.state !== "search"); const was = e.state; put(p, seen.x, seen.z); sim(1.5);
  const c = { pre, was: was === "search", aware: e.aware === true, state: e.state !== "search" && e.state !== "return", seen: e.lost === 0 };
  return { pass: all(c), c, state: e.state };`),
  step("a hit redirects the search", scene() + `
  sim(0.3); const pre = hide(); sim(20, () => !(e.state === "search" && e.sub === "look")); const was = e.sub;
  const from = { x: e.x + 2, z: e.z }; put(p, from.x, from.z); DF.hitEnemy(e, 1, 0, { src: "bolt" });
  const at = Math.hypot(e.lsx - from.x, e.lsz - from.z) < 0.01; hide(); sim(0.6);
  const c = { pre, was: was === "look", at, state: e.state === "search", sub: e.sub === "go" || e.sub === "look", aware: e.aware === true };
  return { pass: all(c), c, state: e.state, sub: e.sub };`),
  step("a woken neighbour gets the same last-seen spot", scene().replace('only(e);', 'const spare = husks().filter((q) => q !== type("husk")); only(e);') + `
  const m = spare[0]; post(m, a.x + 6, a.z + 3); m.yaw = 0; m.aware = false; m.state = "idle"; G.enemies.push(m);
  e.aware = false; e.state = "idle"; DF.alertE(e); const ls = { x: e.lsx, z: e.lsz }; const pre = hide(); sim(1);
  const c = { pre, seeded: Math.hypot(ls.x - seen.x, ls.z - seen.z) < 0.01, woke: m.aware === true, same: m.lsx === ls.x && m.lsz === ls.z };
  return { pass: all(c), c };`),
  step("a pack loses sight together", scene().replace('only(e);', 'const spare = husks().filter((q) => q !== type("husk")).slice(0, 3); only(e);') + `
  const es = [e, mate(spare[0], -1.5), mate(spare[1], 1.5), mate(spare[2], 3)]; sim(0.3); const pre = hide(); let slow = 0, n = 0; const searched = new Set();
  for (; n < 3600 && !es.every(home); n++) { safe(); const t0 = performance.now(); DF.update(1 / 60); slow = Math.max(slow, performance.now() - t0); for (const q of es) if (q.state === "search") searched.add(q); }
  const c = { pre, four: es.length === 4 && spare.length === 3, searched: searched.size === 4, home: es.every(home), smooth: slow < 16 };
  return { pass: all(c), c, slowMs: +slow.toFixed(2), secs: +(n / 60).toFixed(1), states: es.map((q) => q.state) };`),
  step("the player dying sends hunters home", scene().replace('only(e);', 'const spare = husks().filter((q) => q !== type("husk")).slice(0, 1); only(e);') + `
  const m = mate(spare[0], 2), gone = () => [e, m].every((q) => (q.state === "return" || q.state === "idle") && !q.aware);
  // while chasing in view
  sim(0.3); p.state = "dead"; DF.sim(0.1); const chasing = gone();
  // while searching
  p.state = "free"; safe(); put(p, seen.x, seen.z); put(e, e.hx, e.hz); put(m, m.hx, m.hz); hunt(e); hunt(m); e.cd = m.cd = 9; sim(0.3);
  const pre = hide(); sim(3, () => !(e.state === "search" && m.state === "search")); const both = e.state === "search" && m.state === "search";
  p.state = "dead"; DF.sim(0.1); const searching = gone();
  const c = { pre, chasing, both, searching };
  return { pass: all(c), c, states: [e.state, m.state] };`),
  step("a spitter out of sight searches too", scene("spit") + `
  sim(0.3); const pre = hide(); let searched = false; sim(60, () => { searched = searched || e.state === "search"; return !home(e); });
  const c = { pre, searched, home: home(e) };
  return { pass: all(c), c, state: e.state };`),
  // ---- Task 4: leash, territory and provoke ----
  step("leash", lead() + `
  const c = { gave, far: most > 28, capped: most < 34, view, home: home(e) };
  return { pass: all(c), c, most: +most.toFixed(1), state: e.state };`),
  step("an enemy's own leash wins", lead("e.def = { ...e.def, leash: 12 };") + `
  const c = { gave, capped: most < 14, home: home(e) };
  return { pass: all(c), c, most: +most.toFixed(1), state: e.state };`),
  step("a returning enemy ignores a player outside its territory", away + `
  const pre = D(p, { x: e.hx, z: e.hz }) > P.leash && D(p, { x: m.hx, z: m.hz }) > P.leash; sim(1.5);
  const c = { pre, e: walking(e) && e.state === "return", m: walking(m) && m.state === "return" };
  return { pass: all(c), c, states: [e.state, m.state] };`),
  step("provoked", away + `
  DF.hitEnemy(e, 1, 0, { src: "melee" }); sim(1); const c = { hit: hunting(e), mate: hunting(m), shared: m.prov > 0 };
  sim(6); c.calmE = walking(e); c.calmM = walking(m);
  return { pass: all(c), c, states: [e.state, m.state] };`),
  step("a returning enemy notices inside its territory", `
  const q0 = pair(24, 40); if (!q0) return { pass: false, pre: false };
  const [a] = q0, e = type("husk"); only(e); e.hx = a.x; e.hz = a.z; put(e, a.x, a.z + 6); e.yaw = Math.PI; e.aware = false; e.state = "return"; put(p, a.x, a.z - 4); sim(1);
  return { pass: e.aware === true && !["idle", "return"].includes(e.state), state: e.state };`),
  // ---- Task 5: the boss chamber ----
  step("the chamber flag", mouth + `
  only(); const mid = at(1.5), far = at(4), seq = [];
  for (const q of [deep, mid, far]) { put(p, q.x, q.z); DF.update(1 / 60); seq.push(G.inBoss); }
  return { pass: seq[0] === true && seq[1] === true && seq[2] === false, seq };`),
  step("stepping into the chamber sheds the pack", shed + `
  // sees: the husk could see the player in there, so without the rule it would keep hunting
  const c = { sees, quick, home: home(h) && home(s), quiet: !shots, outside: !within };
  return { pass: all(c), c, states: [h.state, s.state] };`),
  step("the pack cannot notice a player in the chamber", shed + `
  for (const q of [h, s]) q.yaw = Math.atan2(p.x - q.x, p.z - q.z);
  const pre = home(h) && w.los(h.x, h.z, p.x, p.z) && D(h, p) < h.def.sight; sim(3);
  const c = { pre, h: idle(h), s: idle(s) };
  return { pass: all(c), c, states: [h.state, s.state], d: +D(h, p).toFixed(1) };`),
  step("a hit from inside the chamber does not start a hunt", shed + `
  const hp0 = h.hp; DF.hitEnemy(h, 5, 0, { src: "bolt" }); sim(1);
  const c = { pre: home(s), hurt: h.hp < hp0, h: !h.aware && (h.state === "idle" || h.state === "return"), s: idle(s) };
  return { pass: all(c), c, states: [h.state, s.state] };`),
  step("a hit from inside the chamber gets no ambush bonus", shed + `
  // every class has an ambush multiplier for an unaware enemy; it must not apply on every hit here
  const pre = home(h) && G.player.cls.ambush > 1, drops = []; G.msgs.length = 0;
  for (let i = 0; i < 3; i++) { const hp0 = h.hp; DF.hitEnemy(h, 5, 0, { src: "bolt" }); drops.push(+(hp0 - h.hp).toFixed(2)); sim(0.5); }
  const c = { pre, plain: drops.every((v) => v === 5), quiet: !G.msgs.some((q) => q.text === "AMBUSH"), unaware: !h.aware };
  return { pass: all(c), c, drops };`),
  step("the boss still fights in its chamber", mouth + `
  only(boss0); inside(); sim(2); const e = boss0;
  return { pass: !!e && e.aware === true && e.state !== "idle" && e.state !== "return", state: e && e.state };`),
  step("no post in the boss chamber", `
  const bad = []; let n = 0;
  for (let k = 1; k <= 40; k++) { reseed(k * 7919); for (const sp of w.spawns) { if (sp.type === "warden") continue; n++;
    const d = D(sp, w.boss); if (d < w.boss.r + P.bossPad) bad.push(k + " " + sp.type + " " + d.toFixed(1)); if (w.fieldAt(sp.x, sp.z) < 0.45) bad.push(k + " field"); } }
  return { pass: bad.length === 0 && n > 1000, n, bad: bad.slice(0, 8), nbad: bad.length };`),
  step("leaving for the hall clears the chamber flag", mouth + `
  inside(); DF.update(1 / 60); const pre = G.inBoss === true; DF.enterHub(); DF.sim(1);
  const d = G.enemies.find((q) => q.def.dummy);
  const c = { pre, flag: G.inBoss === false, zone: G.zone === "hub", dummy: !!d && d.state === "idle" };
  return { pass: all(c), c };`),
];
