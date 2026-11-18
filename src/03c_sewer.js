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
  fallR: 5, // the fall pool, its centre 1 m in from the far wall
};
const BRICK = hexc(0x7a5242),
  SEWER_LAMP = hexc(0x7dff9a);

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
  for (const c of pillars)
    each(c.x - 4, c.z - 4, c.x + 4, c.z + 4, (k, x, z) => {
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

  // ---- water ----
  // Wt is 1 in water and 0 on dry ground. Pools fill pool rooms inside a dry
  // ring along the walls, which joins every tunnel mouth to every other; a
  // gutter runs down one side of some tunnels and one wall of some brood
  // rooms; the boss cavern has its moat, centre pool and fall pool. fieldFns
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
      if (sgn !== side || d < S.tunR - S.gutterW || d > m) return;
      for (const n of nodes) {
        if (inBox(n, x, z, S.gutterEnd)) return;
        if (n === boss && Math.hypot(x - n.x, z - n.z) < n.r + 2) return;
      }
      for (const o of edges)
        if (o !== e && near(x, z, o.pts)[0] < S.tunR + 0.3) return;
      Wt[k] = 1;
    });
  }
  // the boss cavern: a moat along the wall but for a dry crossing at the
  // entrance, a centre pool, and a fall pool at the far wall joined to the moat
  {
    const R = boss.r,
      ex = Math.sin(ea),
      ez = Math.cos(ea),
      fx = boss.x - ex * (R - 1),
      fz = boss.z - ez * (R - 1);
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
        (Math.hypot(x - fx, z - fz) <= S.fallR && (d <= R || F[k] < 0))
      )
        Wt[k] = 1;
    });
  }
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

  // ---- mesh: a plain placeholder, brick coloured ----
  const { P, C, tri } = meshSink();
  const mulc = (c, m) => [c[0] * m, c[1] * m, c[2] * m];
  const cy = (i, j) => ceilOf(F[j * W1 + i], V[j * W1 + i]);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W1 + i,
        mx = Math.max(F[k], F[k + 1], F[k + W1], F[k + W1 + 1]);
      if (mx < -1.3) continue;
      const x = i + minX,
        z = j + minZ,
        fcol = mulc(BRICK, 0.5 + 0.12 * hash2(i + 11, j + 5)),
        ccol = mulc(BRICK, 0.35 + 0.1 * hash2(i + 77, j + 31));
      tri([x, 0, z], [x + 1, 0, z], [x + 1, 0, z + 1], fcol);
      tri([x, 0, z], [x + 1, 0, z + 1], [x, 0, z + 1], mulc(fcol, 0.92));
      const a = [x, cy(i, j), z],
        b = [x + 1, cy(i + 1, j), z],
        c = [x + 1, cy(i + 1, j + 1), z + 1],
        d = [x, cy(i, j + 1), z + 1];
      tri(a, b, c, ccol);
      tri(a, c, d, mulc(ccol, 0.9));
    }
  marchWalls(F, minX, minZ, W, H, (ax, az, bx, bz) => {
    const ta = ceilAt(ax, az) + 0.4,
      tb = ceilAt(bx, bz) + 0.4,
      col = mulc(
        BRICK,
        0.8 + 0.2 * hash2(Math.round(ax * 9), Math.round(bz * 9)),
      );
    tri([ax, -0.2, az], [bx, -0.2, bz], [bx, tb, bz], col);
    tri([ax, -0.2, az], [bx, tb, bz], [ax, ta, az], mulc(col, 0.9));
  });

  // ---- shrines: the arrival hall's beside where the player lands ----
  const spawn = { x: start.x + out.x * 4, z: start.z + out.z * 4 };
  resolve(spawn, 1);
  const shrines = [],
    st = hexc(0x3b3f4a);
  for (const sid of restIds) {
    const n = nodes[sid],
      sx = sid === start.id ? spawn.x + out.z * 3.5 : n.x + 2,
      sz = sid === start.id ? spawn.z - out.x * 3.5 : n.z;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU,
        a1 = ((i + 1) / 8) * TAU,
        p0 = [sx + Math.cos(a0) * 0.75, 0, sz + Math.sin(a0) * 0.75],
        p1 = [sx + Math.cos(a1) * 0.75, 0, sz + Math.sin(a1) * 0.75],
        q0 = [sx + Math.cos(a0) * 0.5, 1.0, sz + Math.sin(a0) * 0.5],
        q1 = [sx + Math.cos(a1) * 0.5, 1.0, sz + Math.sin(a1) * 0.5],
        m = 0.8 + 0.4 * (i % 2);
      tri(p0, p1, q1, mulc(st, m));
      tri(p0, q1, q0, mulc(st, m));
      tri(q0, q1, [sx, 1.1, sz], mulc(st, m * 1.2));
    }
    shrines.push({ x: sx, z: sz, node: sid, lit: sid === start.id, restT: 0 });
  }
  // ---- lamps: a plain green light in every room and tunnel ----
  const lights = [];
  for (const n of nodes)
    lights.push({
      x: n.x,
      y: 3.2,
      z: n.z,
      c: SEWER_LAMP,
      i: 1.1,
      r: n.kind === "boss" ? 30 : 18,
      ph: Rn() * TAU,
    });
  for (const e of edges) {
    const m = e.pts[(e.pts.length / 2) | 0];
    lights.push({
      x: m.x,
      y: 2.6,
      z: m.z,
      c: SEWER_LAMP,
      i: 0.9,
      r: 14,
      ph: Rn() * TAU,
    });
  }

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
    grates: [],
    wallTunnels: [],
    shafts: [],
    pieces: null,
    crumble,
    pos: new Float32Array(P),
    col: new Uint8Array(C),
    lights,
    halos: [],
    shrines,
    spawns,
    spawn,
    plaques: [],
    spawnYaw: Math.atan2(n0.x - spawn.x, n0.z - spawn.z),
  };
}
