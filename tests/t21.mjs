// The Riftwalker's rifts: ends, passing through, Drop.
// Run with: SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.

// the Riftwalker in cave 99, with helpers to find a tunnel and place bodies
const game = (name, body) => ({
  name,
  eval: `(() => { DF.setClass("riftwalker"); DF.newRun(99); const { G, cam } = DF; G.manual = true; DF.show("play"); G.state = "play";
  const w = G.world, p = G.player, D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const put = (o, q) => { o.x = q.x; o.z = q.z; w.resolve(o, o.r || 0.6); cam.px = p.x; cam.pz = p.z; };
  const len = (R) => { let l = 0, a = R[0]; for (const b of R) { l += D(a, b); a = b; } return l; };
  // the point d metres along the tunnel's route from its middle
  const at = (t, d) => { const R = t.R; let i = t.i, left = Math.abs(d), s = Math.sign(d) || 1, a = R[i];
    while (left > 0) { const j = i + s; if (j < 0 || j >= R.length) break; const b = R[j], l = D(a, b);
      if (l >= left) return { x: a.x + (b.x - a.x) * left / l, z: a.z + (b.z - a.z) * left / l }; left -= l; a = b; i = j; }
    return { x: a.x, z: a.z }; };
  // the width of the walkable cross-section at q, across yaw
  const width = (q, yaw) => { let n = 0; for (const sg of [-1, 1]) { let d = 0; while (d < 12 && w.fieldAt(q.x - Math.cos(yaw) * d * sg, q.z + Math.sin(yaw) * d * sg) > 0) d += 0.25; n += d; } return n; };
  // a point in a tunnel on the way to the boss: 5 to 10 m wide, 12 m from either room
  const tunnel = () => { for (let k = 0; k + 1 < w.path.length; k++) { const a = w.nodes[w.path[k]], b = w.nodes[w.path[k + 1]];
      const r = w.route(a.x, a.z, b.x, b.z, 0.6); if (!r) continue; const R = [{ x: a.x, z: a.z }];
      for (const q of r) { const l = D(R[R.length - 1], q), n = Math.ceil(l / 0.5); const o = R[R.length - 1];
        for (let i = 1; i <= n; i++) R.push({ x: o.x + (q.x - o.x) * i / n, z: o.z + (q.z - o.z) * i / n }); }
      for (let i = 20; i < R.length - 20; i++) { const yaw = Math.atan2(R[i + 1].x - R[i - 1].x, R[i + 1].z - R[i - 1].z), wd = width(R[i], yaw);
        if (D(R[i], a) < 12 || D(R[i], b) < 12 || wd < 5 || wd > 10) continue;
        // straight enough to see 6 m each way, so a sealed line of sight means something
        const t = { x: R[i].x, z: R[i].z, yaw, R, i, wd }, A = at(t, -6), B = at(t, 6); if (w.los(A.x, A.z, B.x, B.z)) return t; } }
    return null; };
  // the enemy of that type nearest to q moved there and left idle
  const spawnAt = (type, q) => { const e = G.enemies.filter((e) => !e.dead && (type === "warden" ? e.def.boss : e.type === type))
      .sort((a, b) => D(a, q) - D(b, q))[0]; put(e, q); e.hx = e.x; e.hz = e.z; e.state = "idle"; e.aware = false; e.route = null; return e; };
  const K = (a) => { DF.taps[DF.BIND[a]] = true; };
  // the point across the tunnel from q (across yaw) with the most room
  const mid = (q, yaw) => { let best = q, bf = -9; for (let d = -5; d <= 5; d += 0.25) { const x = q.x - Math.cos(yaw) * d, z = q.z + Math.sin(yaw) * d;
      if (!w.los(q.x, q.z, x, z)) continue; const f = w.fieldAt(x, z); if (f > bf) { bf = f; best = { x, z }; } } return best; };
  // d metres along the tunnel from its middle, centred across it
  const along = (t, d) => { const q = at(t, d), a = at(t, d - 1), b = at(t, d + 1); return mid(q, Math.atan2(b.x - a.x, b.z - a.z)); };
  // a pair of ends 5 m either side of the tunnel point, both facing its middle
  const pair = (t) => { const a = along(t, -5), b = along(t, 5);
    const A = DF.openRift(a.x, a.z, Math.atan2(t.x - a.x, t.z - a.z)), B = DF.openRift(b.x, b.z, Math.atan2(t.x - b.x, t.z - b.z)); return [A, B]; };
  // an end's facing n and line direction u
  const nv = (E) => ({ x: Math.sin(E.yaw), z: Math.cos(E.yaw) }), uv = (E) => ({ x: Math.cos(E.yaw), z: -Math.sin(E.yaw) });
  const off = (E, fn, fu) => { const n = nv(E), u = uv(E); return { x: E.x + n.x * fn + u.x * fu, z: E.z + n.z * fn + u.z * fu }; };
  ${body} })()`,
});

export default [
  game("the tool opens an end ahead, facing the player", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; const n0 = p.tool; K('tool'); DF.sim(0.1);
  const e = G.rifts[0], d = e && D(e, p), R = DF.RIFT;
  const c = { one: G.rifts.length === 1, dist: !!e && d >= R.near - 0.01 && d <= R.far + 0.01,
    faces: !!e && Math.abs(DF.angDiff(e.yaw, cam.yaw + Math.PI)) < 0.05, spent: p.tool === n0 - 1 };
  return { pass: Object.values(c).every(Boolean), c, d };`),
  game("a third end replaces the oldest; ends close after their life", `
  const t = tunnel(), q = [along(t, -4), along(t, 0), along(t, 4)];
  const E = q.map((s, i) => DF.openRift(s.x, s.z, i === 1 ? t.yaw : Math.atan2(t.x - s.x, t.z - s.z)));
  const c = { opened: E.every((e) => typeof e === 'object'), two: G.rifts.length === 2, oldGone: !G.rifts.includes(E[0]) };
  DF.sim(DF.RIFT.life + 0.1); c.closed = G.rifts.length === 0;
  return { pass: Object.values(c).every(Boolean), c };`),
  game("ends too close or with no room are refused for free", `
  const t = tunnel(); put(p, at(t, -6)); p.yaw = cam.yaw = t.yaw; const a = at(t, -1);
  DF.openRift(a.x, a.z, t.yaw + Math.PI); const n0 = p.tool;
  // aimed straight at the end just opened: the spot is within RIFT.apart of it
  const near = DF.openRift(a.x + 0.5, a.z, t.yaw + Math.PI);
  // a point in the rock beside the tunnel
  let r = { x: t.x, z: t.z }; for (let d = 0; d < 12 && w.fieldAt(r.x, r.z) >= 0.5; d += 0.25) r = { x: t.x - Math.cos(t.yaw) * d, z: t.z + Math.sin(t.yaw) * d };
  const room = DF.openRift(r.x, r.z, t.yaw);
  // the tool refuses an aim that lands too close, and keeps its charge
  const at0 = at(t, -1 - DF.RIFT.near); put(p, at0); p.toolCD = 0; K('tool'); DF.sim(0.05);
  const c = { near: near === 'close', room: room === 'room', free: p.tool === n0, still: G.rifts.length === 1 };
  return { pass: Object.values(c).every(Boolean), c, near, room, tool: p.tool, n0 };`),
  game("a new run and a respawn clear the ends", `
  const t = tunnel(); pair(t); const two = G.rifts.length === 2; DF.respawn(); const r1 = G.rifts.length === 0;
  pair(tunnel()); DF.newRun(99); const r2 = DF.G.rifts.length === 0;
  return { pass: two && r1 && r2, two, r1, r2 };`),
  game("a body crossing either face comes out of the other, turned", `
  const t = tunnel(), [A, B] = pair(t), out = {};
  for (const side of [1, -1]) {
    const s0 = off(A, 0.5 * side, 0.5), s1 = off(A, -0.5 * side, 0.5), o = { x: s1.x, z: s1.z, vx: -nv(A).x * side * 4, vz: -nv(A).z * side * 4, yaw: A.yaw + (side > 0 ? Math.PI : 0) };
    const crossed = DF.riftMove(o, s0.x, s0.z, 0.6), want = off(B, 0.75 * side, -0.5), nb = nv(B);
    out[side] = { crossed, miss: D(o, want), dir: (o.vx * nb.x + o.vz * nb.z) / 4 * side, yaw: Math.abs(DF.angDiff(o.yaw, B.yaw + (side > 0 ? 0 : Math.PI))), f: w.fieldAt(o.x, o.z) };
  }
  const ok = (r) => r.crossed && r.miss < 0.1 && r.dir > 0.99 && r.yaw < 0.01 && r.f >= 0.55;
  return { pass: ok(out[1]) && ok(out[-1]), out };`),
  game("the player crosses, the camera turns, the lock stays", `
  const t = tunnel(), [A, B] = pair(t), e = spawnAt('husk', along(t, 0)); p.lock = e;
  put(p, off(A, 1.5, 0)); p.yaw = cam.yaw = A.yaw + Math.PI; const y0 = cam.yaw, a = B.yaw - A.yaw + Math.PI;
  // the husk held still, so the lock is not lost to a fight
  DF.keys[DF.BIND.fwd] = true; DF.sim(2, () => { e.state = 'idle'; e.aware = false; return !(p.riftBonus > 0); }); DF.keys[DF.BIND.fwd] = false;
  const c = { near: D(p, B) < 2, cam: Math.abs(DF.angDiff(cam.yaw, y0 + a)) < 0.05, lock: p.lock === e, safe: p.iframe > 0, bonus: p.riftBonus > 0 };
  return { pass: Object.values(c).every(Boolean), c, dB: D(p, B) };`),
  game("a dodge through a rift crosses once and carries on out", `
  const t = tunnel(), [A, B] = pair(t); put(p, off(A, 1.2, 0)); p.yaw = cam.yaw = A.yaw + Math.PI; let n = 0, last = 0;
  DF.keys[DF.BIND.fwd] = true; DF.taps[DF.BIND.dodge] = true;
  DF.sim(1, () => { if ((p.riftBonus || 0) > last) n++; last = p.riftBonus || 0; }); DF.keys[DF.BIND.fwd] = false;
  const nb = nv(B), out = (p.x - B.x) * nb.x + (p.z - B.z) * nb.z;
  return { pass: n === 1 && out > 0.5, n, out };`),
  game("a pack is carried once, then comes on foot", `
  const t = tunnel(), [A, B] = pair(t); put(p, off(A, 5, 0));
  const e = spawnAt('husk', off(A, -7, 0)); e.aware = true; e.state = 'chase'; e.lsx = p.x; e.lsz = p.z;
  let n = 0, last = 0, first = -1, closest = 99, i = 0, e2 = null, n2 = 0;
  DF.sim(7, () => { i++; p.hp = p.maxHp; const r = e.rest || 0; if (r > last + 0.5) { n++; if (first < 0) first = i; } last = r;
    if (first > 0 && i > first) closest = Math.min(closest, D(e, p));
    if (first > 0 && i === first + 20) { e2 = G.enemies.find((o) => o !== e && !o.dead && o.type === 'husk'); const q = off(A, -1, 0); put(e2, q); e2.aware = true; e2.state = 'chase'; }
    if (e2 && (e2.rest || 0) > 0) n2 = 1; });
  return { pass: n === 1 && closest < 2.2 && n2 === 1, n, closest, n2 };`),
  game("an enemy at the edge of the line comes out clear of rock", `
  const t = tunnel(), [A, B0] = pair(t); let B = B0; const u = uv(B0);
  for (let d = 0.25; d < 6; d += 0.25) { G.rifts = [A]; const r = DF.openRift(B0.x + u.x * d, B0.z + u.z * d, B0.yaw); if (typeof r === 'string') break; B = r; }
  G.rifts = [A, B]; const e = spawnAt('brute', off(A, 3, 0)); const s0 = off(A, 0.4, -0.85), s1 = off(A, -0.4, -0.85);
  e.x = s1.x; e.z = s1.z; const crossed = DF.riftMove(e, s0.x, s0.z, e.r);
  return { pass: crossed && w.fieldAt(e.x, e.z) >= e.r - 0.05, crossed, f: w.fieldAt(e.x, e.z), r: e.r, edge: D(B, B0) };`),
  game("the boss and the dummy walk through the tear", `
  const wd = G.enemies.find((e) => e.def.boss); G.rifts = []; const A = DF.openRift(wd.x, wd.z + 0.5, 0);
  const far = { x: wd.x + 12, z: wd.z }, B = DF.openRift(far.x, far.z, 0); const at0 = { x: wd.x, z: wd.z };
  DF.riftBodies({ p: [p.x, p.z], e: new Map([[wd, [wd.x, wd.z + 1.2]]]) });
  const boss = D(wd, at0) < 0.01;
  DF.enterHub(); const d = G.enemies.find((e) => e.def.dummy); G.rifts = []; DF.openRift(d.x, d.z + 0.5, 0); DF.openRift(d.x + 8, d.z, 0);
  const d0 = { x: d.x, z: d.z }; DF.riftBodies({ p: [G.player.x, G.player.z], e: new Map([[d, [d.x, d.z + 1.2]]]) });
  return { pass: boss && D(d, d0) < 0.01 && !!A && !!B, boss, dummy: D(d, d0) };`),
  game("a Spitter shot through a rift turns on a husk", `
  const t = tunnel(), [A, B] = pair(t); put(p, off(A, 5, 0)); const hp0 = p.hp;
  const sp = spawnAt('spit', off(A, -3, 0)), h = spawnAt('husk', off(B, -3, 0)); const h0 = h.hp, nA = nv(A); p.iframe = 0;
  DF.shoot(sp, Math.atan2(nA.x, nA.z), 13, 18); const pr = G.projs[G.projs.length - 1]; let mine = false;
  DF.sim(0.8, () => { sp.state = 'idle'; sp.cd = 9; if (h.state !== 'hit') h.state = 'idle'; if (pr.own === 'p') mine = true; });
  const safe = p.hp === hp0;
  // the boss's shot goes through the tear as air, at the player
  const wd = spawnAt('warden', off(A, -4, 0)); DF.shoot(wd, Math.atan2(nA.x, nA.z), 13, 18); const wp = G.projs[G.projs.length - 1]; let wOwn = true, wNear = false;
  DF.sim(0.6, () => { wd.state = 'idle'; wd.cd = 9; if (wp.own !== 'e') wOwn = false; if (wp.life > 0 && D(wp, B) < 1.5) wNear = true; });
  const c = { hurt: h.hp < h0, mine, safe, bossKept: wOwn && !wNear };
  return { pass: Object.values(c).every(Boolean), c };`),
  game("the shard passes through", `
  const t = tunnel(), [A, B] = pair(t); put(p, off(A, -3, 0)); const nA = nv(A); let seen = false;
  DF.fire(DF.MOVES.v3.proj, Math.atan2(nA.x, nA.z)); const pr = G.projs[G.projs.length - 1];
  DF.sim(0.6, () => { if (pr.life > 0 && D(pr, B) < 1.5) seen = true; });
  return { pass: seen, seen };`),
  game("the next hit after a crossing does more", `
  const t = tunnel(), e = spawnAt('brute', at(t, 0)); e.aware = true; e.state = 'chase';
  let h = e.hp; DF.hitEnemy(e, 10, 0, { src: 'melee' }); const plain = h - e.hp; p.riftBonus = 2; h = e.hp; DF.hitEnemy(e, 10, 0, { src: 'melee' }); const more = h - e.hp;
  return { pass: Math.abs(more / plain - 1 - DF.RIFT.bonus) < 0.02 && p.riftBonus === 0, plain, more };`),
  game("unpaired ends do nothing", `
  const t = tunnel(), a = along(t, 0); G.rifts = []; const A = DF.openRift(a.x, a.z, t.yaw); const s0 = off(A, 0.5, 0), s1 = off(A, -0.5, 0);
  const o = { x: s1.x, z: s1.z }; const crossed = DF.riftMove(o, s0.x, s0.z, 0.6);
  return { pass: !crossed && D(o, s1) < 0.01, crossed };`),
];
