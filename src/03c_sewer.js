// ---------- the sewer: the D-rank gate ----------
// Every layout number for the sewer, in metres unless named otherwise.
const SEWER = {
  // the grid of rooms, as planGraph takes it
  GX: 5,
  GZ: 4,
  SP: 50,
  jit: 14,
  diagP: 0.35,
  loopP: 0.3,
  loopDiagP: 0.4,
  spurs: 2, // rooms off the path with one tunnel, at least
  loopsMin: 2, // loops kept when making those dead ends
  // tunnels: even-width channels of straight runs joined by angled bends
  tunR: 3.4,
  bends: [3, 6], // bends per tunnel, least and most
  jog: [3, 6], // how far a run moves sideways from the one before it
  side: 7, // the furthest a run sits from the straight line between rooms
  turnMax: (70 * PI) / 180, // the sharpest bend
  mouth: 1, // the first and last bend stand this far out of their rooms
  // rooms: axis-aligned rounded rectangles, by half width and half depth
  roomHW: [10, 15],
  roomHD: [8, 12],
  corner: 3,
  pillarAt: 12, // both half-sizes at least this get one or two pillars
  pillarR: 0.8,
  // the arrival hall, off the grid beside corner (0, 0)
  startD: 44,
  startHW: 9,
  startHD: 7,
  // the boss cavern, the far corner, pushed out this far in X and Z
  bossR: 26,
  bossOff: 10,
  wardenD: 13, // from the cavern's centre toward its entrance
  // collapsed wall sections
  crumble: [3, 6],
  crumbleR: 2.5,
  // ceiling: 3 + vault * sqrt(field + 0.4), the vault rising into rooms
  vault: { tunnel: 1, room: 1.6, boss: 3.8 },
  vaultIn: 3, // how far into a room the vault takes to rise
  ceilTop: 16,
  // water. Pools in a pool room sit at least `edge` in from its walls, are
  // at least `min` across, and are parted by walkways at least `walk` wide
  // and one crossing `cross` wide. A side facing a wall may draw back by up
  // to `shrink`.
  pool: { edge: 3, walk: 3, cross: 2.5, min: 4, shrink: 1.5 },
  gutterW: 1.2,
  gutterP: 1 / 3, // the share of tunnels with a gutter
  gutterEnd: 1, // a tunnel's gutter stops this far outside every room's box
  broodGutterP: 0.5, // the chance a brood room has a gutter along one wall
  moatW: 4,
  crossW: 4, // the dry crossing over the moat at the cavern's entrance
  centreR: 6,
  fallR: 5, // a fall pool, its centre 1 m in from the far wall
  // the boss cavern's set: a dome on walls this high, the wall tunnels across
  // its far wall (how many, radians apart, their centre height, half the
  // opening's width, how far each outlet stands out of the wall) and the
  // light shafts through cracks in the dome
  bossWall: 8.5,
  mouths: [3, 5],
  mouthGap: 0.33,
  mouthY: 5,
  mouthHW: 1,
  mouthOut: 0.9,
  shafts: [3, 6],
  // dressing: brick ribs across tunnels this far apart, standing this far out
  // of the wall and vault; a lamp on every third rib; grates at least this
  // far apart along a tunnel
  ribGap: [4, 6],
  ribD: 0.2,
  grateGap: 12,
  // culling: a tunnel piece is this many runs; a cell this near a piece
  // joins it; sight samples this far apart, and on every edge-th cell of a
  // piece's rim; the fog is 99% at fog / fogD
  piece: { runs: 3, pad: 3, sample: 3, edge: 2, fog: 2.146 },
};
const BRICK = hexc(0x7a5242),
  SEWER_LAMP = hexc(0x7dff9a),
  SEWER_SKY = [0.62, 0.8, 0.7], // the pale light down a manhole or a crack
  SEWER_STONE = hexc(0x8a8274),
  SEWER_IRON = hexc(0x2e2a27),
  SEWER_RUST = hexc(0x553a2a),
  SEWER_MOSS = hexc(0x34502a);

// A lamp's brightness at time t, from its phase ph: 1, but for a lamp that
// flickers, now and then a stutter of 0.3 s that dips toward 0.15. Time runs
// in windows of 5 to 9 s, and a little under half of them hold a stutter.
function lampFlicker(ph, t) {
  const key = Math.floor(ph * 1000),
    per = 5 + 4 * hash2(key, 1),
    u = t + ph * 3,
    k = Math.floor(u / per);
  if (hash2(key + 3, k) > 0.45) return 1;
  const d = u - k * per - (0.3 + hash2(key + 7, k) * (per - 0.7));
  if (d < 0 || d >= 0.3) return 1;
  const s = Math.floor(d / 0.05);
  return s === 0 || hash2(key + 11, k * 8 + s) < 0.6
    ? 0.15 + 0.08 * hash2(key + 13, k * 8 + s)
    : 0.65;
}

// Field of an axis-aligned rounded rectangle: positive inside, roughly the
// distance to its edge.
function roomField(n, x, z) {
  const c = SEWER.corner,
    qx = Math.abs(x - n.x) - (n.hw - c),
    qz = Math.abs(z - n.z) - (n.hd - c);
  return (
    c -
    Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) -
    Math.min(Math.max(qx, qz), 0)
  );
}
// How far from a room's centre its edge is, going in direction (ux, uz).
function roomReach(n, ux, uz) {
  if (n.kind === "boss") return n.r;
  return Math.min(
    Math.abs(ux) > 1e-6 ? n.hw / Math.abs(ux) : 1e9,
    Math.abs(uz) > 1e-6 ? n.hd / Math.abs(uz) : 1e9,
  );
}

// The corners of a tunnel from A's centre to B's centre: a straight run out
// of A, then runs held at a sideways offset and joined by angled jogs, then
// a straight run into B. Every corner is a bend of at most SEWER.turnMax.
function sewerLine(Rn, A, B) {
  const S = SEWER,
    dx = B.x - A.x,
    dz = B.z - A.z,
    L = Math.hypot(dx, dz),
    ux = dx / L,
    uz = dz / L,
    nx = -uz,
    nz = ux,
    t0 = roomReach(A, ux, uz) + S.mouth,
    t1 = L - roomReach(B, -ux, -uz) - S.mouth;
  const at = (t, o) => ({ x: A.x + ux * t + nx * o, z: A.z + uz * t + nz * o });
  let nb = S.bends[0] + ((Rn() * (S.bends[1] - S.bends[0] + 1)) | 0);
  for (let tries = 0; tries < 40; tries++) {
    if (tries && tries % 8 === 0 && nb > S.bends[0]) nb--;
    const shrink = Math.pow(0.85, tries % 8);
    // offsets of the bends: 0 at both mouths, groups of one or two between
    const off = [0];
    let o = 0;
    while (off.length < nb - 1) {
      const left = nb - 1 - off.length,
        n = left >= 2 && Rn() < 0.6 ? 2 : 1,
        j = (S.jog[0] + Rn() * (S.jog[1] - S.jog[0])) * shrink;
      let s = Rn() < 0.5 ? -1 : 1;
      if (Math.abs(o + s * j) > S.side) s = -s;
      o = clamp(o + s * j, -S.side, S.side);
      for (let k = 0; k < n; k++) off.push(o);
    }
    off.push(0);
    const gap = t1 - t0,
      step = gap / (nb - 1),
      pos = [];
    for (let k = 0; k < nb; k++)
      pos.push(
        k === 0 || k === nb - 1
          ? t0 + k * step
          : t0 + (k + (Rn() - 0.5) * 0.4) * step,
      );
    const pts = [{ x: A.x, z: A.z }];
    for (let k = 0; k < nb; k++) pts.push(at(pos[k], off[k]));
    pts.push({ x: B.x, z: B.z });
    if (gap > 2 && lineOk(pts)) return pts;
  }
  // no room for bends: a straight tunnel
  return [
    { x: A.x, z: A.z },
    { x: B.x, z: B.z },
  ];
}
// Every run at least 2 m and every corner a bend of at most SEWER.turnMax.
function lineOk(pts) {
  for (let i = 1; i < pts.length; i++)
    if (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) < 2)
      return false;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
      b = Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z),
      turn = Math.abs(angDiff(a, b));
    if (turn > SEWER.turnMax || turn < 0.1) return false;
  }
  return true;
}

function genSewer(seed) {
  const S = SEWER,
    Rn = rng(seed);
  const plan = planGraph(Rn, {
    GX: S.GX,
    GZ: S.GZ,
    SP: S.SP,
    jit: S.jit,
    rMin: 0,
    rVar: 0,
    startR: 0,
    bossR: S.bossR,
    diagP: S.diagP,
    loopP: S.loopP,
    loopDiagP: S.loopDiagP,
  });
  const { nodes, edges, boss } = plan;
  // grid neighbours (not diagonal), in a seeded order, for joining rooms
  const gridPairs = () => {
    const more = [];
    for (let gz = 0; gz < S.GZ; gz++)
      for (let gx = 0; gx < S.GX; gx++) {
        const a = gz * S.GX + gx;
        if (gx < S.GX - 1) more.push([a, a + 1]);
        if (gz < S.GZ - 1) more.push([a, a + S.GX]);
      }
    for (let i = more.length - 1; i > 0; i--) {
      const j = (Rn() * (i + 1)) | 0;
      [more[i], more[j]] = [more[j], more[i]];
    }
    return more;
  };
  const has = (a, b) =>
    edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  // ---- one way into the boss cavern ----
  // The first boss edge in plan order is a tree edge and is kept; the rest
  // go. Rooms that cut off are joined again by grid neighbours away from the
  // boss (the grid less one corner is always connected).
  {
    const bossEdges = edges.filter((e) => e.a === boss.id || e.b === boss.id);
    for (const e of bossEdges.slice(1)) edges.splice(edges.indexOf(e), 1);
    const par = nodes.map((_, i) => i),
      find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))),
      join = (a, b) => {
        const ra = find(a),
          rb = find(b);
        if (ra === rb) return false;
        par[ra] = rb;
        return true;
      };
    for (const e of edges) join(e.a, e.b);
    for (const [a, b] of gridPairs())
      if (a !== boss.id && b !== boss.id && join(a, b)) edges.push({ a, b });
  }
  // ---- dead ends ----
  // At least S.spurs rooms off the path keep one tunnel. A leaf of the
  // spanning tree is never inside the path, so it becomes a dead end once its
  // loop edges go. Rooms that are dead ends already count first, and a loop
  // edge is dropped only while S.loopsMin loops remain.
  {
    const par = nodes.map((_, i) => i),
      find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))),
      tree = new Set(),
      tdeg = nodes.map(() => 0),
      deg = nodes.map(() => 0);
    for (const e of edges) {
      const ra = find(e.a),
        rb = find(e.b);
      if (ra !== rb) {
        par[ra] = rb;
        tree.add(e);
        tdeg[e.a]++;
        tdeg[e.b]++;
      }
      deg[e.a]++;
      deg[e.b]++;
    }
    const cands = nodes.filter(
      (n) => n !== boss && n.id !== 0 && tdeg[n.id] === 1,
    );
    for (let i = cands.length - 1; i > 0; i--) {
      const j = (Rn() * (i + 1)) | 0;
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    cands.sort((a, b) => deg[a.id] - deg[b.id]);
    const spurs = new Set();
    for (const n of cands.slice(0, S.spurs)) {
      const loops = edges.filter(
        (e) => !tree.has(e) && (e.a === n.id || e.b === n.id),
      );
      if (edges.length - nodes.length + 1 - loops.length < S.loopsMin) break;
      for (const e of loops) edges.splice(edges.indexOf(e), 1);
      spurs.add(n.id);
    }
    // too few loops from the plan: join grid neighbours that are not yet
    // joined, away from the boss and the dead ends
    const free = (i) => i !== boss.id && !spurs.has(i);
    for (const [a, b] of gridPairs()) {
      if (edges.length - nodes.length + 1 >= S.loopsMin) break;
      if (free(a) && free(b) && !has(a, b)) edges.push({ a, b });
    }
  }
  // ---- rooms ----
  for (const n of nodes) {
    n.kind = n === boss ? "boss" : "room";
    n.hw = S.roomHW[0] + Rn() * (S.roomHW[1] - S.roomHW[0]);
    n.hd = S.roomHD[0] + Rn() * (S.roomHD[1] - S.roomHD[0]);
  }
  boss.x += S.bossOff;
  boss.z += S.bossOff;
  boss.hw = boss.hd = S.bossR;
  // the arrival hall, out past corner (0, 0) along -X or -Z, long along that line
  const n0 = nodes[0],
    alongX = Rn() < 0.5,
    out = alongX ? { x: -1, z: 0 } : { x: 0, z: -1 };
  const start = {
    id: nodes.length,
    x: n0.x + out.x * S.startD,
    z: n0.z + out.z * S.startD,
    hw: alongX ? S.startHW : S.startHD,
    hd: alongX ? S.startHD : S.startHW,
    adj: [],
    depth: -1,
    seen: false,
    kind: "start",
  };
  nodes.push(start);
  edges.unshift({ a: start.id, b: n0.id });
  for (const n of nodes) n.r = Math.min(n.hw, n.hd);
  // ---- tunnels ----
  const runs = [];
  for (const e of edges) {
    const A = nodes[e.a],
      B = nodes[e.b],
      line = sewerLine(Rn, A, B);
    e.bends = line.slice(1, -1);
    e.seen = false;
    e.pts = [];
    for (let i = 0; i < line.length - 1; i++) {
      const p = line[i],
        q = line[i + 1],
        k = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 2.5));
      runs.push({ ax: p.x, az: p.z, bx: q.x, bz: q.z });
      for (let j = 0; j < k; j++)
        e.pts.push({
          x: lerp(p.x, q.x, j / k),
          z: lerp(p.z, q.z, j / k),
          r: S.tunR,
        });
    }
    const end = line[line.length - 1];
    e.pts.push({ x: end.x, z: end.z, r: S.tunR });
  }
  const path = linkGraph(nodes, edges, start, boss);

  // ---- field ----
  let minX = 1e9,
    minZ = 1e9,
    maxX = -1e9,
    maxZ = -1e9;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.hw);
    maxX = Math.max(maxX, n.x + n.hw);
    minZ = Math.min(minZ, n.z - n.hd);
    maxZ = Math.max(maxZ, n.z + n.hd);
  }
  for (const s of runs) {
    minX = Math.min(minX, s.ax, s.bx);
    maxX = Math.max(maxX, s.ax, s.bx);
    minZ = Math.min(minZ, s.az, s.bz);
    maxZ = Math.max(maxZ, s.az, s.bz);
  }
  minX = Math.floor(minX - 8);
  minZ = Math.floor(minZ - 8);
  maxX = Math.ceil(maxX + 8);
  maxZ = Math.ceil(maxZ + 8);
  const W = maxX - minX,
    H = maxZ - minZ,
    W1 = W + 1,
    NP = W1 * (H + 1),
    F = new Float32Array(NP).fill(-3),
    V = new Float32Array(NP).fill(S.vault.tunnel),
    Wt = new Float32Array(NP),
    // where the drawn shore runs: above 0 is drawn as water. Wt - 0.5 but
    // along tunnel gutters, which hold the distance past a straight shore
    Sd = new Float32Array(NP).fill(NaN),
    bodyIds = new Int16Array(NP).fill(-1);
  // calls fn(k, x, z) for every grid point in a box
  const each = (x0, z0, x1, z1, fn) => {
    const ia = Math.max(0, Math.floor(x0 - minX)),
      ib = Math.min(W, Math.ceil(x1 - minX)),
      ja = Math.max(0, Math.floor(z0 - minZ)),
      jb = Math.min(H, Math.ceil(z1 - minZ));
    for (let j = ja; j <= jb; j++)
      for (let i = ia; i <= ib; i++) fn(j * W1 + i, i + minX, j + minZ);
  };
  for (const n of nodes) {
    const vk = n.kind === "boss" ? S.vault.boss : S.vault.room;
    each(
      n.x - n.hw - 3,
      n.z - n.hd - 3,
      n.x + n.hw + 3,
      n.z + n.hd + 3,
      (k, x, z) => {
        const d =
          n.kind === "boss"
            ? n.r - Math.hypot(x - n.x, z - n.z)
            : roomField(n, x, z);
        if (d > F[k]) F[k] = d;
        const v = 1 + (vk - 1) * sat(d / S.vaultIn);
        if (v > V[k]) V[k] = v;
      },
    );
  }
  for (const s of runs) {
    const dx = s.bx - s.ax,
      dz = s.bz - s.az,
      l2 = dx * dx + dz * dz || 1,
      m = S.tunR + 3;
    each(
      Math.min(s.ax, s.bx) - m,
      Math.min(s.az, s.bz) - m,
      Math.max(s.ax, s.bx) + m,
      Math.max(s.az, s.bz) + m,
      (k, x, z) => {
        const t = sat(((x - s.ax) * dx + (z - s.az) * dz) / l2),
          d = S.tunR - Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
        if (d > F[k]) F[k] = d;
      },
    );
  }
  // the room a point is in, if any (the arrival hall and the cavern included)
  const roomAt = (x, z, pad = 0) => {
    for (const n of nodes) {
      const d =
        n.kind === "boss"
          ? n.r - Math.hypot(x - n.x, z - n.z)
          : roomField(n, x, z);
      if (d > -pad) return n;
    }
    return null;
  };
  // crumble: a few collapsed wall sections in tunnels, away from rooms
  const crumble = [],
    nCrumble = S.crumble[0] + ((Rn() * (S.crumble[1] - S.crumble[0] + 1)) | 0);
  for (let t = 0; t < 200 && crumble.length < nCrumble; t++) {
    const e = edges[(Rn() * edges.length) | 0],
      i = 1 + ((Rn() * (e.pts.length - 2)) | 0),
      p = e.pts[i - 1],
      q = e.pts[i],
      l = Math.hypot(q.x - p.x, q.z - p.z) || 1,
      s = Rn() < 0.5 ? -1 : 1,
      x = q.x + (-(q.z - p.z) / l) * S.tunR * s,
      z = q.z + ((q.x - p.x) / l) * S.tunR * s;
    if (roomAt(x, z, 5)) continue;
    if (crumble.some((c) => Math.hypot(c.x - x, c.z - z) < 12)) continue;
    crumble.push({ x, z });
    const R = S.crumbleR;
    each(x - R, z - R, x + R, z + R, (k, gx, gz) => {
      const f = 1 - Math.hypot(gx - x, gz - z) / R;
      if (f <= 0) return;
      F[k] += f * ((vnoise(gx * 0.9 + 3.1, gz * 0.9 + 8.7) - 0.5) * 1.4 - 0.5);
    });
  }
  // pillars in big rooms, off the centre and off the axes the tunnels leave by
  const pillars = [];
  for (const n of nodes) {
    if (n.kind !== "room" || n.hw < S.pillarAt || n.hd < S.pillarAt) continue;
    const sx = Rn() < 0.5 ? -1 : 1,
      sz = Rn() < 0.5 ? -1 : 1;
    pillars.push({ x: n.x + sx * n.hw * 0.5, z: n.z + sz * n.hd * 0.5 });
    if (Rn() < 0.5)
      pillars.push({ x: n.x - sx * n.hw * 0.5, z: n.z - sz * n.hd * 0.5 });
  }
  // over the whole room (no room is more than 12 m from wall to middle), so
  // the field and the vault that follows it have no step round a pillar
  for (const c of pillars)
    each(c.x - 12, c.z - 12, c.x + 12, c.z + 12, (k, x, z) => {
      const d = Math.hypot(x - c.x, z - c.z) - S.pillarR;
      if (d < F[k]) F[k] = d;
    });
  const fns = fieldFns(F, minX, minZ, W, H, Wt),
    { fieldAt, resolve, waterAt } = fns;
  const vaultAt = (x, z) => {
    const fx = clamp(x - minX, 0, W - 1e-3),
      fz = clamp(z - minZ, 0, H - 1e-3),
      i = fx | 0,
      j = fz | 0,
      u = fx - i,
      v = fz - j,
      k = j * W1 + i;
    return lerp(lerp(V[k], V[k + 1], u), lerp(V[k + W1], V[k + W1 + 1], u), v);
  };
  const ceilOf = (f, v) =>
    Math.min(S.ceilTop, 3 + v * Math.sqrt(Math.max(f, 0) + 0.4));
  const ceilAt = (x, z) => ceilOf(fieldAt(x, z), vaultAt(x, z));

  // ---- rest points and room kinds ----
  const L = path.length,
    restIds = [];
  for (const id of [
    start.id,
    path[Math.round((L - 1) / 3)],
    path[Math.round((2 * (L - 1)) / 3)],
    path[L - 2],
  ])
    if (!restIds.includes(id)) restIds.push(id);
  for (const id of restIds)
    if (nodes[id].kind === "room") nodes[id].kind = "shrine";
  const fights = nodes.filter((n) => n.kind === "room");
  for (let i = fights.length - 1; i > 0; i--) {
    const j = (Rn() * (i + 1)) | 0;
    [fights[i], fights[j]] = [fights[j], fights[i]];
  }
  fights.forEach((n, i) => (n.kind = i % 2 ? "brood" : "pool"));

  // the one tunnel into the boss cavern runs straight in toward its centre;
  // ea is the direction from the centre out along it
  const entry = edges.find(
      (e) =>
        (e.a === boss.id && e.b === path[L - 2]) ||
        (e.b === boss.id && e.a === path[L - 2]),
    ),
    ep = entry.a === boss.id ? entry.pts.slice().reverse() : entry.pts;
  let mouth = ep[0];
  for (const q of ep)
    if (Math.hypot(q.x - boss.x, q.z - boss.z) >= boss.r) mouth = q;
    else break;
  const ea = Math.atan2(mouth.x - boss.x, mouth.z - boss.z);
  // Decoration draws from its own stream, so the layout above and the
  // spawns below never move when it changes.
  const Rd = rng((seed * 7919 + 17) >>> 0);
  // the wall tunnels: spread across the far wall, each facing the centre
  const wallTunnels = [];
  {
    const n = S.mouths[0] + ((Rd() * (S.mouths[1] - S.mouths[0] + 1)) | 0);
    for (let k = 0; k < n; k++) {
      const a =
          ea + PI + (k - (n - 1) / 2) * S.mouthGap + (Rd() - 0.5) * 0.04,
        x = boss.x + Math.sin(a) * boss.r,
        z = boss.z + Math.cos(a) * boss.r;
      wallTunnels.push({
        x,
        y: S.mouthY,
        z,
        yaw: Math.atan2(boss.x - x, boss.z - z),
      });
    }
  }

  // ---- water ----
  // Wt is 1 in water and 0 on dry ground. Pools fill pool rooms inside a dry
  // ring along the walls, which joins every tunnel mouth to every other; a
  // gutter runs down one side of some tunnels and one wall of some brood
  // rooms; the boss cavern has its moat, centre pool and fall pools. fieldFns
  // already holds Wt, so waterAt reads what is written here.
  const inBox = (n, x, z, pad) =>
    Math.abs(x - n.x) < n.hw + pad && Math.abs(z - n.z) < n.hd + pad;
  const paint = (r, v) =>
    each(r.x0, r.z0, r.x1, r.z1, (k, x, z) => {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) Wt[k] = v;
    });
  // where each tunnel meets room n: its first run leaves the centre straight
  const mouthsOf = (n) =>
    edges
      .filter((e) => e.a === n.id || e.b === n.id)
      .map((e) => {
        const q = e.a === n.id ? e.pts[1] : e.pts[e.pts.length - 2],
          l = Math.hypot(q.x - n.x, q.z - n.z),
          ux = (q.x - n.x) / l,
          uz = (q.z - n.z) / l,
          t = roomReach(n, ux, uz);
        return { x: n.x + ux * t, z: n.z + uz * t, ux, uz };
      });
  // whether dry floor with a metre of clearance joins every mouth of room n
  const dryJoined = (n) => {
    const ms = mouthsOf(n);
    if (ms.length < 2) return true;
    const i0 = Math.max(0, Math.floor(n.x - n.hw - 4 - minX)),
      i1 = Math.min(W, Math.ceil(n.x + n.hw + 4 - minX)),
      j0 = Math.max(0, Math.floor(n.z - n.hd - 4 - minZ)),
      j1 = Math.min(H, Math.ceil(n.z + n.hd + 4 - minZ)),
      bw = i1 - i0 + 1,
      seen = new Uint8Array(bw * (j1 - j0 + 1)),
      ok = (i, j) =>
        i >= i0 &&
        i <= i1 &&
        j >= j0 &&
        j <= j1 &&
        F[j * W1 + i] >= 1 &&
        Wt[j * W1 + i] < 0.5;
    // a dry grid point just inside each mouth
    const seeds = ms.map((m) => {
      const ci = Math.round(m.x - m.ux * 1.5 - minX),
        cj = Math.round(m.z - m.uz * 1.5 - minZ);
      for (let r = 0; r <= 2; r++)
        for (let j = cj - r; j <= cj + r; j++)
          for (let i = ci - r; i <= ci + r; i++) if (ok(i, j)) return [i, j];
      return null;
    });
    if (seeds.some((q) => !q)) return false;
    const q = [seeds[0]];
    seen[(seeds[0][1] - j0) * bw + seeds[0][0] - i0] = 1;
    while (q.length) {
      const [i, j] = q.pop();
      for (const [a, b] of [
        [i - 1, j],
        [i + 1, j],
        [i, j - 1],
        [i, j + 1],
      ]) {
        if (!ok(a, b) || seen[(b - j0) * bw + a - i0]) continue;
        seen[(b - j0) * bw + a - i0] = 1;
        q.push([a, b]);
      }
    }
    return seeds.every(([i, j]) => seen[(j - j0) * bw + i - i0]);
  };
  // the pool layouts a room can take, in a seeded order, then the plainest:
  // two pools either side of a crossing through the middle
  const poolLayouts = (n) => {
    const P = S.pool,
      onX = n.hw >= n.hd,
      A = (onX ? n.hw : n.hd) - P.edge,
      B = (onX ? n.hd : n.hw) - P.edge;
    // a pool from spans along the room's long axis (u) and short axis (v)
    const rect = ([u0, u1], [v0, v1]) =>
      onX
        ? { x0: n.x + u0, x1: n.x + u1, z0: n.z + v0, z1: n.z + v1 }
        : { x0: n.x + v0, x1: n.x + v1, z0: n.z + u0, z1: n.z + u1 };
    // cuts [-h, h] into spans at least P.min long with these gaps between
    const cut = (h, gaps) => {
      const spare =
        2 * h - gaps.reduce((s, g) => s + g, 0) - (gaps.length + 1) * P.min;
      if (spare < 0) return null;
      const wt = [0, ...gaps].map(() => 0.5 + Rn()),
        sum = wt.reduce((s, w) => s + w, 0),
        out = [];
      let a = -h;
      wt.forEach((w, i) => {
        const b = i === gaps.length ? h : a + P.min + (spare * w) / sum;
        out.push([a, b]);
        a = b + (gaps[i] || 0);
      });
      return out;
    };
    // a side facing a wall draws back, leaving the pool at least P.min across
    const shrink = (us, vs) =>
      us.flatMap((u) =>
        vs.map((v) => {
          const s = [u.slice(), v.slice()];
          for (const [d, h] of [
            [0, A],
            [1, B],
          ]) {
            if (s[d][0] === -h)
              s[d][0] += Rn() * Math.min(P.shrink, s[d][1] - s[d][0] - P.min);
            if (s[d][1] === h)
              s[d][1] -= Rn() * Math.min(P.shrink, s[d][1] - s[d][0] - P.min);
          }
          return rect(s[0], s[1]);
        }),
      );
    const whole = (h) => [[-h, h]],
      walkFirst = Rn() < 0.5,
      made = [
        [cut(A, [P.cross]), cut(B, [P.walk])],
        [cut(A, walkFirst ? [P.walk, P.cross] : [P.cross, P.walk]), whole(B)],
        [whole(A), cut(B, [P.cross])],
        [cut(A, [P.cross]), whole(B)],
      ]
        .filter(([us, vs]) => us && vs)
        .map(([us, vs]) => shrink(us, vs));
    for (let i = made.length - 1; i > 0; i--) {
      const j = (Rn() * (i + 1)) | 0;
      [made[i], made[j]] = [made[j], made[i]];
    }
    const c = P.cross / 2;
    made.push([
      rect([-A, -c], [-B, B]),
      rect([c, A], [-B, B]),
    ]);
    return made;
  };
  // a pillar stands well inside a pool, or clear of every pool by a walkway
  const pillarFits = (rs, c) =>
    rs.some(
      (r) =>
        c.x - r.x0 >= 1 && r.x1 - c.x >= 1 && c.z - r.z0 >= 1 && r.z1 - c.z >= 1,
    ) ||
    rs.every(
      (r) =>
        Math.hypot(
          Math.max(r.x0 - c.x, 0, c.x - r.x1),
          Math.max(r.z0 - c.z, 0, c.z - r.z1),
        ) >=
        S.pool.walk + S.pillarR,
    );
  for (const n of nodes) {
    if (n.kind === "pool") {
      const mine = pillars.filter((c) => inBox(n, c.x, c.z, 0)),
        lays = poolLayouts(n);
      for (let li = 0; li < lays.length; li++) {
        const rs = lays[li],
          last = li === lays.length - 1;
        if (!last && !mine.every((c) => pillarFits(rs, c))) continue;
        for (const r of rs) paint(r, 1);
        if (last || dryJoined(n)) break;
        for (const r of rs) paint(r, 0);
      }
    } else if (n.kind === "brood" && Rn() < S.broodGutterP) {
      // a gutter along one wall that no tunnel leaves by, short of the corners
      const ms = mouthsOf(n),
        g = S.gutterW,
        first = (Rn() * 4) | 0;
      for (let t = 0; t < 4; t++) {
        const sd = (first + t) % 4,
          onX = sd < 2, // the wall faces along X: it is a side at x = n.x +- hw
          sg = sd % 2 ? -1 : 1,
          half = onX ? n.hd : n.hw,
          span = half - S.corner,
          wall = onX ? n.x + sg * n.hw : n.z + sg * n.hd,
          hit = ms.some((m) => Math.abs((onX ? m.x : m.z) - wall) < 0.01);
        if (hit) continue;
        const lo = Math.min(wall - sg * g, wall + sg * 0.5),
          hi = Math.max(wall - sg * g, wall + sg * 0.5),
          r = onX
            ? { x0: lo, x1: hi, z0: n.z - span, z1: n.z + span }
            : { x0: n.x - span, x1: n.x + span, z0: lo, z1: hi };
        paint(r, 1);
        if (!dryJoined(n)) paint(r, 0);
        break;
      }
    }
  }
  // tunnel gutters: a strip along one wall, off every room and every other
  // tunnel's floor, reaching a metre into the wall so waterAt reads 1 at it
  for (const e of edges) {
    if (Rn() >= S.gutterP) continue;
    const side = Rn() < 0.5 ? -1 : 1,
      pts = e.pts;
    let x0 = 1e9,
      z0 = 1e9,
      x1 = -1e9,
      z1 = -1e9;
    for (const q of pts) {
      x0 = Math.min(x0, q.x);
      z0 = Math.min(z0, q.z);
      x1 = Math.max(x1, q.x);
      z1 = Math.max(z1, q.z);
    }
    const m = S.tunR + 1,
      near = (x, z, ps) => {
        let best = 1e9,
          sgn = 0;
        for (let i = 1; i < ps.length; i++) {
          const a = ps[i - 1],
            b = ps[i],
            dx = b.x - a.x,
            dz = b.z - a.z,
            t = sat(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
            d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
          if (d < best) {
            best = d;
            sgn = Math.sign(dx * (z - a.z) - dz * (x - a.x));
          }
        }
        return [best, sgn];
      };
    each(x0 - m, z0 - m, x1 + m, z1 + m, (k, x, z) => {
      const [d, sgn] = near(x, z, pts);
      if (sgn !== side || d < 1 || d > m) return;
      for (const n of nodes) {
        if (inBox(n, x, z, S.gutterEnd)) return;
        if (n === boss && Math.hypot(x - n.x, z - n.z) < n.r + 2) return;
      }
      for (const o of edges)
        if (o !== e && near(x, z, o.pts)[0] < S.tunR + 0.3) return;
      // drawn, the shore runs straight along the tunnel where the grid's
      // shore runs on average
      Sd[k] = d - (S.tunR - S.gutterW - 0.25);
      if (d >= S.tunR - S.gutterW) Wt[k] = 1;
    });
  }
  // the boss cavern: a moat along the wall but for a dry crossing at the
  // entrance, a centre pool, and fall pools at the far wall joined to the moat
  {
    const R = boss.r,
      ex = Math.sin(ea),
      ez = Math.cos(ea),
      // a fall pool at the far wall, and one under each wall tunnel
      falls = [
        { x: boss.x - ex * (R - 1), z: boss.z - ez * (R - 1) },
        ...wallTunnels.map((q) => ({
          x: boss.x + ((q.x - boss.x) * (R - 1)) / R,
          z: boss.z + ((q.z - boss.z) * (R - 1)) / R,
        })),
      ];
    each(boss.x - R - 2, boss.z - R - 2, boss.x + R + 2, boss.z + R + 2, (k, x, z) => {
      const dx = x - boss.x,
        dz = z - boss.z,
        d = Math.hypot(dx, dz),
        along = dx * ex + dz * ez,
        across = Math.abs(dx * ez - dz * ex),
        moat =
          d >= R - S.moatW &&
          d <= R + 0.9 &&
          (d <= R || F[k] < 0) &&
          !(along > 0 && across < S.crossW / 2);
      if (
        moat ||
        d <= S.centreR ||
        (falls.some((f) => Math.hypot(x - f.x, z - f.z) <= S.fallR) &&
          (d <= R || F[k] < 0))
      )
        Wt[k] = 1;
    });
  }
  for (let k = 0; k < NP; k++)
    if (Sd[k] !== Sd[k] || (Wt[k] > 0.5 && Sd[k] <= 0)) Sd[k] = Wt[k] - 0.5;
  // the bodies of water: one id per region of grid points joined side to
  // side, each with its room (-1 in a tunnel) and its most open point
  const bodies = [],
    stack = [];
  for (let k0 = 0; k0 < NP; k0++) {
    if (Wt[k0] < 0.5 || bodyIds[k0] >= 0) continue;
    const id = bodies.length;
    let cnt = 0,
      best = k0;
    bodyIds[k0] = id;
    stack.push(k0);
    while (stack.length) {
      const k = stack.pop(),
        i = k % W1,
        j = (k / W1) | 0;
      cnt++;
      if (F[k] > F[best]) best = k;
      for (const q of [
        i > 0 ? k - 1 : -1,
        i < W ? k + 1 : -1,
        j > 0 ? k - W1 : -1,
        j < H ? k + W1 : -1,
      ])
        if (q >= 0 && Wt[q] > 0.5 && bodyIds[q] < 0) {
          bodyIds[q] = id;
          stack.push(q);
        }
    }
    const x = (best % W1) + minX,
      z = ((best / W1) | 0) + minZ,
      home = roomAt(x, z, 0.5);
    bodies.push({ id, room: home ? home.id : -1, n: cnt, x, z });
  }

  // ---- mesh: brick floor, walls and vault; water sunk below the floor ----
  const { P, C, M, tri, triC } = meshSink();
  const mulc = (c, m) => [c[0] * m, c[1] * m, c[2] * m],
    mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
    stain = (x, z, f) => vnoise(x * f + 5.3, z * f + 1.7);
  const sink = WATER.sink,
    wcol = hexc(0x24423a),
    damp = mulc(BRICK, 0.3);
  // The drawn vault: ceilAt's, and in the boss cavern a dome on walls
  // S.bossWall high. It is never below ceilAt, so the camera stays under it.
  const domeAt = (x, z) => {
    const d = Math.hypot(x - boss.x, z - boss.z) / boss.r;
    return d < 1
      ? S.bossWall + (S.ceilTop - S.bossWall) * Math.sqrt(1 - d * d)
      : 0;
  };
  const roofAt = (x, z) => Math.max(ceilAt(x, z), domeAt(x, z)),
    roofK = (i, j) =>
      Math.max(ceilOf(F[j * W1 + i], V[j * W1 + i]), domeAt(i + minX, j + minZ)),
    // where a wall meets the vault: the vault's height at the wall's line,
    // and the cavern's wall height round the boss
    wallTop = (x, z) =>
      Math.max(
        ceilOf(0, vaultAt(x, z)),
        Math.hypot(x - boss.x, z - boss.z) < boss.r + 0.5 ? S.bossWall : 0,
      );
  // colours: damp and moss toward the walls and the water, stains overhead
  const nearWet = (x, z) =>
    Math.max(
      waterAt(x + 0.8, z),
      waterAt(x - 0.8, z),
      waterAt(x, z + 0.8),
      waterAt(x, z - 0.8),
    );
  const floorCol = (x, z) => {
    const wall = 1 - sat(fieldAt(x, z) / 1.4),
      wet = nearWet(x, z),
      s = stain(x, z, 0.4);
    let c = mulc(BRICK, 0.44 + 0.12 * s);
    c = mix(c, damp, 0.45 * wall + 0.3 * wet);
    return mix(c, mulc(SEWER_MOSS, 0.7), (0.5 * wall + 0.4 * wet) * stain(x, z, 0.9));
  };
  const ceilCol = (x, z) =>
    mix(
      mulc(BRICK, 0.34 + 0.08 * stain(x, z, 0.3)),
      mulc(SEWER_MOSS, 0.3),
      0.5 * sat(stain(x + 31, z, 0.15) * 2 - 1),
    );
  // the manhole beside where the player lands: a hole in the vault over the
  // one cell it is centred in, between the lowest and highest of its corners
  const spawn = { x: start.x + out.x * 4, z: start.z + out.z * 4 };
  resolve(spawn, 1);
  const perp = { x: out.z, z: -out.x },
    hole = {
      x: Math.floor(spawn.x - perp.x * 1.4) + 0.5,
      z: Math.floor(spawn.z - perp.z * 1.4) + 0.5,
    },
    hk = [0, 1].flatMap((dj) =>
      [0, 1].map((di) => roofK(hole.x - 0.5 - minX + di, hole.z - 0.5 - minZ + dj)),
    ),
    holeY = Math.min(...hk) - 0.04,
    holeTop = Math.max(...hk) + 0.1;
  // a convex polygon of floor points, as a fan, coloured per corner
  const fan = (pts, y, col, mat) => {
    const cs = pts.map((p) => (typeof col === "function" ? col(p[0], p[1]) : col));
    for (let q = 1; q + 1 < pts.length; q++)
      triC(
        [pts[0][0], y, pts[0][1]],
        [pts[q][0], y, pts[q][1]],
        [pts[q + 1][0], y, pts[q + 1][1]],
        cs[0],
        cs[q],
        cs[q + 1],
        0,
        mat,
      );
  };
  // dressed stone along a shore from a to b: a coping 0.4 wide on the dry
  // side (toward dc), and its face down to the water
  const coping = (a, b, dc) => {
    let nx = a[1] - b[1],
      nz = b[0] - a[0];
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    if ((dc[0] - a[0]) * nx + (dc[1] - a[1]) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const h = hash2(Math.round((a[0] + b[0]) * 2), Math.round((a[1] + b[1]) * 2)),
      y = h > 0.5 ? 0.043 : 0.04,
      col = mulc(SEWER_STONE, 0.6 + 0.2 * h),
      A = [a[0], y, a[1]],
      B = [b[0], y, b[1]];
    tri(A, B, [b[0] + nx * 0.4, y, b[1] + nz * 0.4], col);
    tri(A, [b[0] + nx * 0.4, y, b[1] + nz * 0.4], [a[0] + nx * 0.4, y, a[1] + nz * 0.4], col);
    tri(A, B, [b[0], -sink, b[1]], mulc(col, 0.8));
    tri(A, [b[0], -sink, b[1]], [a[0], -sink, a[1]], mulc(col, 0.8));
  };
  // the vault over one cell, cut where the wall stands (as marchWalls cuts
  // it), so the vault meets the top of the wall along one clean line
  const vaultCell = (i, j, x, z, k) => {
    const v = [F[k], F[k + 1], F[k + W1 + 1], F[k + W1]],
      ins = v.map((f) => f > 0),
      n = ins.filter(Boolean).length;
    if (n === 0) return;
    const cs = [
        [x, z],
        [x + 1, z],
        [x + 1, z + 1],
        [x, z + 1],
      ],
      hs = [roofK(i, j), roofK(i + 1, j), roofK(i + 1, j + 1), roofK(i, j + 1)],
      V3 = (c) => [cs[c][0], hs[c], cs[c][1]],
      cut = [
        () => [x + v[0] / (v[0] - v[1]), z],
        () => [x + 1, z + v[1] / (v[1] - v[2])],
        () => [x + v[3] / (v[3] - v[2]), z + 1],
        () => [x, z + v[0] / (v[0] - v[3])],
      ].map((f) => () => {
        const p = f();
        return [p[0], wallTop(p[0], p[1]), p[1]];
      }),
      poly = (ps) => {
        const cols = ps.map((p) => ceilCol(p[0], p[2]));
        for (let q = 1; q + 1 < ps.length; q++)
          triC(ps[0], ps[q], ps[q + 1], cols[0], cols[q], cols[q + 1], 0, MAT.BRICK);
      };
    if (n === 4) {
      // split along the diagonal nearer the vault at the middle of the cell
      const mid = roofAt(x + 0.5, z + 0.5);
      if (Math.abs((hs[0] + hs[2]) / 2 - mid) <= Math.abs((hs[1] + hs[3]) / 2 - mid))
        poly([V3(0), V3(1), V3(2), V3(3)]);
      else poly([V3(1), V3(2), V3(3), V3(0)]);
      return;
    }
    const ctr = (v[0] + v[1] + v[2] + v[3]) / 4 > 0;
    if (n === 2 && ins[0] === ins[2] && !ctr) {
      // a saddle whose middle is rock: two corners apart
      if (ins[0]) {
        poly([V3(0), cut[0](), cut[3]()]);
        poly([V3(2), cut[2](), cut[1]()]);
      } else {
        poly([V3(1), cut[1](), cut[0]()]);
        poly([V3(3), cut[3](), cut[2]()]);
      }
      return;
    }
    const ps = [];
    for (let c = 0; c < 4; c++) {
      if (ins[c]) ps.push(V3(c));
      if (ins[c] !== ins[(c + 1) % 4]) ps.push(cut[c]());
    }
    poly(ps);
  };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W1 + i,
        mx = Math.max(F[k], F[k + 1], F[k + W1], F[k + W1 + 1]);
      if (mx < -1.3) continue;
      const x = i + minX,
        z = j + minZ;
      // the floor splits along the drawn shore
      const cs = [
          [x, z],
          [x + 1, z],
          [x + 1, z + 1],
          [x, z + 1],
        ],
        s = [k, k + 1, k + W1 + 1, k + W1].map((q) => Sd[q]),
        nWet = s.filter((v) => v > 0).length;
      if (nWet === 0) fan(cs, 0, floorCol, MAT.BRICK);
      else if (nWet === 4) fan(cs, -sink, wcol, MAT.WATER);
      else {
        const dry = [],
          wet = [],
          cut = [];
        for (let c = 0; c < 4; c++) {
          const d = (c + 1) % 4;
          (s[c] > 0 ? wet : dry).push(cs[c]);
          if (s[c] > 0 !== s[d] > 0) {
            const t = s[c] / (s[c] - s[d]),
              e = [
                cs[c][0] + (cs[d][0] - cs[c][0]) * t,
                cs[c][1] + (cs[d][1] - cs[c][1]) * t,
              ];
            dry.push(e);
            wet.push(e);
            cut.push(e);
          }
        }
        fan(dry, 0, floorCol, MAT.BRICK);
        const dc = [
          dry.reduce((a, p) => a + p[0], 0) / dry.length,
          dry.reduce((a, p) => a + p[1], 0) / dry.length,
        ];
        if (nWet === 2 && s[0] > 0 === s[2] > 0) {
          // a saddle: the dry floor joins across, the two wet corners part
          for (let c = 0; c < 4; c++)
            if (s[c] > 0) {
              fan([cs[c], cut[c], cut[(c + 3) % 4]], -sink, wcol, MAT.WATER);
              coping(cut[(c + 3) % 4], cut[c], dc);
            }
        } else {
          fan(wet, -sink, wcol, MAT.WATER);
          coping(cut[0], cut[1], dc);
        }
      }
      // the vault, open over the manhole
      if (x === hole.x - 0.5 && z === hole.z - 0.5) continue;
      vaultCell(i, j, x, z, k);
    }
  // The walls stand straight from below the water to the line where the
  // vault meets them: wet and mossy at the foot, damp low down, stained
  // above, and darker where they have crumbled.
  marchWalls(F, minX, minZ, W, H, (ax, az, bx, bz) => {
    let nx = az - bz,
      nz = bx - ax;
    const l = Math.hypot(nx, nz) || 1,
      mx = (ax + bx) / 2,
      mz = (az + bz) / 2;
    nx /= l;
    nz /= l;
    if (fieldAt(mx + nx * 0.5, mz + nz * 0.5) < fieldAt(mx - nx * 0.5, mz - nz * 0.5)) {
      nx = -nx;
      nz = -nz;
    }
    const rows = [-sink - 0.1, 1.1],
      cols = (x, z) => {
        const wet = waterAt(x + nx * 0.7, z + nz * 0.7),
          broken = crumble.some((c) => Math.hypot(c.x - x, c.z - z) < S.crumbleR + 1)
            ? 0.75
            : 1;
        return [
          mulc(mix(damp, SEWER_MOSS, 0.25 + 0.5 * stain(x, z, 0.7)), 1 - 0.3 * wet),
          mulc(BRICK, (0.74 + 0.2 * stain(x, z, 0.35) - 0.12 * wet) * broken),
          mulc(BRICK, (0.8 + 0.3 * stain(x + 9, z + 3, 0.2)) * broken),
        ];
      },
      ca = cols(ax, az),
      cb = cols(bx, bz),
      A = [rows[0], rows[1], wallTop(ax, az)].map((y) => [ax, y, az]),
      B = [rows[0], rows[1], wallTop(bx, bz)].map((y) => [bx, y, bz]);
    for (let r = 0; r < 2; r++) {
      triC(A[r], B[r], B[r + 1], ca[r], cb[r], cb[r + 1], 0, MAT.BRICK);
      triC(A[r], B[r + 1], A[r + 1], ca[r], cb[r + 1], ca[r + 1], 0, MAT.BRICK);
    }
  });

  // ---- rest points: the arrival hall's beside where the player lands ----
  const shrines = [];
  for (const sid of restIds) {
    const n = nodes[sid],
      sx = sid === start.id ? spawn.x + out.z * 3.5 : n.x + 2,
      sz = sid === start.id ? spawn.z - out.x * 3.5 : n.z;
    shrines.push({ x: sx, z: sz, node: sid, lit: sid === start.id, restT: 0 });
  }
  // ---- dressing, lamps and the boss cavern's set ----
  const dress = dressSewer({
    S,
    Rd,
    nodes,
    edges,
    boss,
    ea,
    fieldAt,
    waterAt,
    roofAt,
    roomAt,
    wallTop,
    tri,
    wcol,
    crumble,
    pillars,
    shrines,
    wallTunnels,
    hole,
    holeY,
    holeTop,
    perp,
  });

  // ---- spawns ----
  const PACK = {
    pool: [
      ["husk", "spit"],
      ["husk", "husk", "spit"],
    ],
    brood: [
      ["brute", "husk"],
      ["brute", "husk", "husk"],
    ],
  };
  const spawns = [];
  for (const n of nodes) {
    if (n.kind !== "pool" && n.kind !== "brood") continue;
    const pk = PACK[n.kind][Rn() < 0.5 ? 0 : 1],
      // a pool room's dry floor is mostly the walkway along its walls
      sx = n.kind === "pool" ? n.hw - 1.5 : (n.hw - 3) * 0.7,
      sz = n.kind === "pool" ? n.hd - 1.5 : (n.hd - 3) * 0.7;
    for (const type of pk) {
      let o = null;
      for (let t = 0; t < 40; t++) {
        const q = {
          x: n.x + (Rn() * 2 - 1) * sx,
          z: n.z + (Rn() * 2 - 1) * sz,
        };
        resolve(q, 1.2);
        if (fieldAt(q.x, q.z) >= 1 && waterAt(q.x, q.z) === 0) {
          o = q;
          break;
        }
      }
      if (o)
        spawns.push({
          type,
          x: o.x,
          z: o.z,
          yaw: Rn() * TAU,
          node: n.id,
          kind: n.kind,
        });
    }
  }
  const keep = boss.r + PURSUIT.bossPad;
  for (const e of edges) {
    if (Rn() > 0.5) continue;
    const A = nodes[e.a],
      B = nodes[e.b],
      far = A.depth <= B.depth ? B : A,
      mi = (e.pts.length / 2) | 0,
      m = { x: e.pts[mi].x, z: e.pts[mi].z };
    // a tunnel post stays out of every room and out of the boss cavern's pad
    if (roomAt(m.x, m.z, 2) || Math.hypot(m.x - boss.x, m.z - boss.z) < keep)
      continue;
    resolve(m, 1);
    if (fieldAt(m.x, m.z) < 1 || waterAt(m.x, m.z) > 0) continue;
    spawns.push({
      type: "husk",
      x: m.x,
      z: m.z,
      yaw: Math.atan2(far.x - m.x, far.z - m.z),
      node: -1,
      kind: "tunnel",
    });
  }
  // the boss stands on the dry ring between the entrance and the centre
  // pool, facing the entrance
  spawns.push({
    type: "warden",
    x: boss.x + Math.sin(ea) * S.wardenD,
    z: boss.z + Math.cos(ea) * S.wardenD,
    yaw: ea,
    node: boss.id,
    kind: "boss",
  });

  const cutUp = sewerPieces({ nodes, edges, F, W, H, minX, minZ, P, C, M, los: fns.los });
  return {
    seed,
    sewer: true,
    nodes,
    edges,
    start,
    boss,
    path,
    minX,
    minZ,
    W,
    H,
    F,
    Wt,
    bodyIds,
    fieldAt,
    ceilAt,
    resolve,
    los: fns.los,
    route: fns.route,
    addRock: fns.addRock,
    removeRock: fns.removeRock,
    clearRocks: fns.clearRocks,
    waterAt,
    bodyAt: (x, z) => fns.bodyAt(x, z, bodyIds),
    bodies,
    grates: dress.grates,
    wallTunnels,
    shafts: dress.shafts,
    pieces: cutUp.pieces,
    pieceGrid: cutUp.pieceGrid,
    pieceAt: cutUp.pieceAt,
    crumble,
    pos: cutUp.pos,
    col: cutUp.col,
    mat: cutUp.mat,
    lights: dress.lights,
    halos: dress.halos,
    shrines,
    spawns,
    spawn,
    plaques: [],
    spawnYaw: Math.atan2(n0.x - spawn.x, n0.z - spawn.z),
  };
}
