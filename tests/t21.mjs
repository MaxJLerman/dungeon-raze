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
];
