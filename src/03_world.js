// ---------- cave generation ----------
const ROCK_A = hexc(0x7b8698),
  ROCK_B = hexc(0x8f755e),
  ROCK_BOSS = hexc(0x7d4a44);
const CRY = {
  cyan: hexc(0x4de8ff),
  violet: hexc(0xa978ff),
  red: hexc(0xff5136),
  amber: hexc(0xffb347),
};

// Collision and line of sight over a walkable field sampled on a one-unit grid.
// Shared by the cave and the hall so both collide the same way.
// Wt (optional) is water depth 0 to 1 on the same grid; ids (optional, passed to
// bodyAt) is an Int16Array of water body ids. Water blocks nothing.
function fieldFns(F, minX, minZ, W, H, Wt) {
  const W1 = W + 1;
  function waterAt(x, z) {
    if (!Wt) return 0;
    const fx = x - minX,
      fz = z - minZ;
    if (fx < 0 || fz < 0 || fx >= W || fz >= H) return 0;
    const i = fx | 0,
      j = fz | 0,
      u = fx - i,
      v = fz - j,
      k = j * W1 + i;
    return lerp(lerp(Wt[k], Wt[k + 1], u), lerp(Wt[k + W1], Wt[k + W1 + 1], u), v);
  }
  function bodyAt(x, z, ids) {
    if (!ids) return -1;
    const i = Math.round(x - minX),
      j = Math.round(z - minZ);
    if (i < 0 || j < 0 || i > W || j > H) return -1;
    return ids[j * W1 + i];
  }
  function fieldAt(x, z) {
    const fx = x - minX,
      fz = z - minZ;
    if (fx < 0 || fz < 0 || fx >= W || fz >= H) return -3;
    const i = fx | 0,
      j = fz | 0,
      u = fx - i,
      v = fz - j,
      k = j * W1 + i;
    return lerp(lerp(F[k], F[k + 1], u), lerp(F[k + W1], F[k + W1 + 1], u), v);
  }
  function resolve(o, rad) {
    for (let it = 0; it < 4; it++) {
      const f = fieldAt(o.x, o.z);
      if (f >= rad) return;
      const e = 0.3;
      let gx = fieldAt(o.x + e, o.z) - fieldAt(o.x - e, o.z),
        gz = fieldAt(o.x, o.z + e) - fieldAt(o.x, o.z - e);
      const l = Math.hypot(gx, gz);
      if (l < 1e-5) return;
      const push = Math.min(rad - f + 0.01, 0.6) * 0.9;
      o.x += (gx / l) * push;
      o.z += (gz / l) * push;
    }
  }
  function los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az),
      n = Math.max(1, Math.ceil(d / 0.8));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (fieldAt(lerp(ax, bx, t), lerp(az, bz, t)) < 0.05) return false;
    }
    return true;
  }
  // ---- routes ----
  // A* over the grid points of F. Buffers are made on the first call and
  // reused, so a search allocates nothing in proportion to the grid.
  const NP = W1 * (H + 1);
  let rG = null,
    rFrom,
    rSeen,
    rDone,
    rEpoch = 0;
  const hK = [],
    hI = [];
  function hPush(k, i) {
    let c = hK.length;
    hK.push(k);
    hI.push(i);
    while (c > 0) {
      const q = (c - 1) >> 1;
      if (hK[q] <= k) break;
      hK[c] = hK[q];
      hI[c] = hI[q];
      c = q;
    }
    hK[c] = k;
    hI[c] = i;
  }
  function hPop() {
    const top = hI[0],
      k = hK.pop(),
      i = hI.pop(),
      n = hK.length;
    if (n) {
      let c = 0;
      for (;;) {
        let l = c * 2 + 1;
        if (l >= n) break;
        if (l + 1 < n && hK[l + 1] < hK[l]) l++;
        if (hK[l] >= k) break;
        hK[c] = hK[l];
        hI[c] = hI[l];
        c = l;
      }
      hK[c] = k;
      hI[c] = i;
    }
    return top;
  }
  // true when the straight line keeps at least min clearance, sampled every
  // half metre. The first point is not tested: it is where the walker stands.
  function lineClear(ax, az, bx, bz, min) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (fieldAt(lerp(ax, bx, t), lerp(az, bz, t)) < min) return false;
    }
    return true;
  }
  // A walkable route from (ax, az) to (bx, bz) for a body of radius rad: the
  // points to walk to in order, not including the start. null when there is
  // none. The last point is the goal itself when a body fits there, otherwise
  // the nearest grid point where it does.
  function route(ax, az, bx, bz, rad) {
    if (!(isFinite(ax) && isFinite(az) && isFinite(bx) && isFinite(bz)))
      return null;
    const need = rad + 0.25;
    // The nearest usable grid point within 4 cells. One in plain view of
    // (x, z) is preferred, so a body pressed against a thin wall is not
    // started from the far side of it.
    const snap = (x, z) => {
      const ci = Math.round(x - minX),
        cj = Math.round(z - minZ);
      let best = -1,
        bd = 1e9,
        seen = -1,
        sd = 1e9;
      for (let j = cj - 4; j <= cj + 4; j++)
        for (let i = ci - 4; i <= ci + 4; i++) {
          if (i < 0 || j < 0 || i > W || j > H) continue;
          const k = j * W1 + i;
          if (F[k] < need) continue;
          const d = Math.hypot(i + minX - x, j + minZ - z);
          if (d < bd) {
            bd = d;
            best = k;
          }
          if (d < sd && los(x, z, i + minX, j + minZ)) {
            sd = d;
            seen = k;
          }
        }
      return seen >= 0 ? seen : best;
    };
    const s = snap(ax, az),
      g = snap(bx, bz);
    if (s < 0 || g < 0) return null;
    if (!rG) {
      rG = new Float32Array(NP);
      rFrom = new Int32Array(NP);
      rSeen = new Uint32Array(NP);
      rDone = new Uint32Array(NP);
    }
    const ep = ++rEpoch,
      gi = g % W1,
      gj = (g / W1) | 0;
    const est = (k) => {
      const dx = Math.abs((k % W1) - gi),
        dz = Math.abs(((k / W1) | 0) - gj);
      return dx + dz - 0.5858 * Math.min(dx, dz);
    };
    hK.length = hI.length = 0;
    rG[s] = 0;
    rFrom[s] = -1;
    rSeen[s] = ep;
    hPush(est(s), s);
    let pops = 0,
      found = false;
    while (hK.length) {
      const k = hPop();
      if (rDone[k] === ep) continue;
      rDone[k] = ep;
      if (k === g) {
        found = true;
        break;
      }
      if (++pops > 60000) break;
      const i = k % W1,
        j = (k / W1) | 0,
        gk = rG[k];
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di,
            nj = j + dj;
          if (ni < 0 || nj < 0 || ni > W || nj > H) continue;
          const nk = nj * W1 + ni;
          if (F[nk] < need || rDone[nk] === ep) continue;
          // a diagonal may not squeeze past a blocked corner
          if (di && dj && (F[k + di] < need || F[k + dj * W1] < need)) continue;
          const ng = gk + (di && dj ? 1.4142 : 1);
          if (rSeen[nk] === ep && rG[nk] <= ng) continue;
          rSeen[nk] = ep;
          rG[nk] = ng;
          rFrom[nk] = k;
          hPush(ng + est(nk), nk);
        }
    }
    if (!found) return null;
    const pts = [];
    for (let k = g; k !== s && k >= 0; k = rFrom[k])
      pts.push({ x: (k % W1) + minX, z: ((k / W1) | 0) + minZ });
    pts.push({ x: (s % W1) + minX, z: ((s / W1) | 0) + minZ });
    pts.reverse();
    if (fieldAt(bx, bz) >= rad) pts.push({ x: bx, z: bz });
    // thin: keep a point only when the walk cannot go straight past it
    const out = [],
      thin = rad + 0.1;
    let cx = ax,
      cz = az,
      i = 0;
    while (i < pts.length) {
      let j = i;
      while (
        j + 1 < pts.length &&
        lineClear(cx, cz, pts[j + 1].x, pts[j + 1].z, thin)
      )
        j++;
      out.push(pts[j]);
      cx = pts[j].x;
      cz = pts[j].z;
      i = j + 1;
    }
    return out;
  }
  // Rock: a capsule written into F for a while, as the Sapper's rubble.
  // Each grid point a rock covers holds min(base, distance to the capsule
  // less its radius) over every live rock, so the field stays a distance
  // estimate and every reader of F treats rock as wall. Taking a rock out
  // recomputes its points from the base copy and the rocks still live.
  const rocks = new Map();
  let base = null,
    rockN = 0;
  const segD = (x, z, q) => {
    const dx = q.bx - q.ax,
      dz = q.bz - q.az,
      l2 = dx * dx + dz * dz,
      t = l2 ? clamp(((x - q.ax) * dx + (z - q.az) * dz) / l2, 0, 1) : 0;
    return Math.hypot(x - q.ax - dx * t, z - q.az - dz * t) - q.r;
  };
  function repaint(q) {
    const i0 = Math.max(0, Math.floor(q.x0 - minX)),
      i1 = Math.min(W, Math.ceil(q.x1 - minX)),
      j0 = Math.max(0, Math.floor(q.z0 - minZ)),
      j1 = Math.min(H, Math.ceil(q.z1 - minZ));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * W1 + i,
          x = minX + i,
          z = minZ + j;
        let f = base[k];
        for (const o of rocks.values())
          if (x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1)
            f = Math.min(f, segD(x, z, o));
        F[k] = f;
      }
  }
  function addRock(ax, az, bx, bz, r) {
    if (!base) base = Float32Array.from(F);
    const pad = r + ROCK_PAD,
      q = {
        ax, az, bx, bz, r,
        x0: Math.min(ax, bx) - pad,
        x1: Math.max(ax, bx) + pad,
        z0: Math.min(az, bz) - pad,
        z1: Math.max(az, bz) + pad,
      },
      id = ++rockN;
    rocks.set(id, q);
    repaint(q);
    return id;
  }
  function removeRock(id) {
    const q = rocks.get(id);
    if (!q) return;
    rocks.delete(id);
    repaint(q);
  }
  function clearRocks() {
    const all = [...rocks.values()];
    rocks.clear();
    for (const q of all) repaint(q);
  }
  return {
    fieldAt,
    resolve,
    los,
    route,
    addRock,
    removeRock,
    clearRocks,
    waterAt,
    bodyAt,
  };
}
// how far past a rock's capsule its points are kept as a distance estimate
const ROCK_PAD = 3;
// What the world shader draws on a triangle: 0 is plain, as the cave and the
// hall are throughout.
const MAT = { BRICK: 1, WATER: 2 };
// Collects world triangles: positions as floats, colours square-root encoded
// in bytes with the glow amount in the alpha byte, and one material byte per
// vertex. tri takes one colour for the face, triC one per corner.
function meshSink() {
  const P = [],
    C = [],
    M = [];
  const b8 = (v) => clamp(Math.sqrt(Math.max(v, 0)) * 255, 0, 255) | 0;
  function tri(a, b, c, col, glow = 0, mat = 0) {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const r = b8(col[0]),
      g = b8(col[1]),
      bl = b8(col[2]),
      gl2 = (glow * 255) | 0;
    C.push(r, g, bl, gl2, r, g, bl, gl2, r, g, bl, gl2);
    M.push(mat, mat, mat);
  }
  // the same with a colour per corner, for shading that runs across a face
  function triC(a, b, c, ca, cb, cc, glow = 0, mat = 0) {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const g = (glow * 255) | 0;
    for (const k of [ca, cb, cc]) C.push(b8(k[0]), b8(k[1]), b8(k[2]), g);
    M.push(mat, mat, mat);
  }
  return { P, C, M, tri, triC };
}

// Room graph: a jittered grid of rooms, a spanning tree and some loop edges.
// Consumes Rn in a fixed order. Edges come back without pts. o = { GX, GZ, SP,
// jit, rMin, rVar, startR, bossR, diagP, loopP, loopDiagP }.
function planGraph(Rn, o) {
  const { GX, GZ, SP } = o;
  const nodes = [];
  for (let gz = 0; gz < GZ; gz++)
    for (let gx = 0; gx < GX; gx++)
      nodes.push({
        id: nodes.length,
        x: gx * SP + (Rn() - 0.5) * o.jit,
        z: gz * SP + (Rn() - 0.5) * o.jit,
        r: o.rMin + Rn() * o.rVar,
        adj: [],
        depth: -1,
        seen: false,
        kind: "room",
      });
  const start = nodes[0],
    boss = nodes[GX * GZ - 1];
  start.r = o.startR;
  start.kind = "start";
  boss.r = o.bossR;
  boss.kind = "boss";

  // graph: spanning tree + extra edges for loops
  const id = (gx, gz) => gz * GX + gx,
    cand = [];
  for (let gz = 0; gz < GZ; gz++)
    for (let gx = 0; gx < GX; gx++) {
      if (gx < GX - 1) cand.push({ a: id(gx, gz), b: id(gx + 1, gz), w: Rn() });
      if (gz < GZ - 1) cand.push({ a: id(gx, gz), b: id(gx, gz + 1), w: Rn() });
      if (gx < GX - 1 && gz < GZ - 1 && Rn() < o.diagP) {
        if (Rn() < 0.5)
          cand.push({
            a: id(gx, gz),
            b: id(gx + 1, gz + 1),
            w: 1 + Rn(),
            diag: 1,
          });
        else
          cand.push({
            a: id(gx + 1, gz),
            b: id(gx, gz + 1),
            w: 1 + Rn(),
            diag: 1,
          });
      }
    }
  cand.sort((p, q) => p.w - q.w);
  const par = nodes.map((_, i) => i),
    find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  const edges = [];
  for (const c of cand) {
    const ra = find(c.a),
      rb = find(c.b);
    if (ra !== rb) {
      par[ra] = rb;
      edges.push(c);
    } else if (
      Rn() < (c.diag ? o.loopDiagP : o.loopP) &&
      c.a !== boss.id &&
      c.b !== boss.id
    )
      edges.push(c);
  }
  return { nodes, edges, start, boss };
}

// Fills adj (in edge order) and depth by BFS from start, and returns the node
// ids from start to boss. Uses no random numbers.
function linkGraph(nodes, edges, start, boss) {
  for (const e of edges) {
    nodes[e.a].adj.push(e.b);
    nodes[e.b].adj.push(e.a);
  }
  start.depth = 0;
  const q = [start],
    prev = {};
  while (q.length) {
    const n = q.shift();
    for (const j of n.adj) {
      const m = nodes[j];
      if (m.depth < 0) {
        m.depth = n.depth + 1;
        prev[j] = n.id;
        q.push(m);
      }
    }
  }
  const path = [];
  for (let c = boss.id; c !== undefined; c = prev[c]) path.unshift(c);
  return path;
}

// Calls seg(ax, az, bx, bz) once per wall segment where F crosses zero, over
// the grid whose corner is (minX, minZ), W cells wide and H cells tall.
function marchWalls(F, minX, minZ, W, H, seg) {
  const W1 = W + 1;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W1 + i,
        v0 = F[k],
        v1 = F[k + 1],
        v2 = F[k + W1 + 1],
        v3 = F[k + W1];
      const idx =
        (v0 > 0 ? 1 : 0) |
        (v1 > 0 ? 2 : 0) |
        (v2 > 0 ? 4 : 0) |
        (v3 > 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i + minX,
        z = j + minZ;
      const e0 = () => [x + v0 / (v0 - v1), z],
        e1 = () => [x + 1, z + v1 / (v1 - v2)],
        e2 = () => [x + v3 / (v3 - v2), z + 1],
        e3 = () => [x, z + v0 / (v0 - v3)];
      const S = (p, q2) => seg(p[0], p[1], q2[0], q2[1]);
      const ctr = (v0 + v1 + v2 + v3) / 4 > 0;
      switch (idx) {
        case 1:
        case 14:
          S(e3(), e0());
          break;
        case 2:
        case 13:
          S(e0(), e1());
          break;
        case 3:
        case 12:
          S(e3(), e1());
          break;
        case 4:
        case 11:
          S(e1(), e2());
          break;
        case 6:
        case 9:
          S(e0(), e2());
          break;
        case 7:
        case 8:
          S(e3(), e2());
          break;
        case 5:
          if (ctr) {
            S(e0(), e1());
            S(e2(), e3());
          } else {
            S(e3(), e0());
            S(e1(), e2());
          }
          break;
        case 10:
          if (ctr) {
            S(e3(), e0());
            S(e1(), e2());
          } else {
            S(e0(), e1());
            S(e2(), e3());
          }
          break;
      }
    }
}

// The cave's room graph. The big cave is the same on a 6 by 6 grid.
const CAVE_PLAN = {
  GX: 4,
  GZ: 4,
  SP: 44,
  jit: 20,
  rMin: 8.5,
  rVar: 3.5,
  startR: 9.5,
  bossR: 16.5,
  diagP: 0.35,
  loopP: 0.5,
  loopDiagP: 0.6,
};
// The big cave's culling, as the sewer's (SEWER.piece): a tunnel piece is
// runs segments of its polyline, its cells are looked for within reach of
// it, a piece reaches pad past its cells, sight samples are sample apart and
// on every edge-th rim cell. slack: the sight lines that make the lists count
// walls this much thinner than world.los does, in metres. genWorld reads
// ENV_CAVE (06_game.js), SEWER.piece.fog (03c) and COOP_HEADLESS_HERE (06c)
// at call time, all inside the host copy. Changing the sewer's fog constant
// moves the cave's cut distance and so the piece hashes in tests/t31.mjs
const CAVE_PIECE = { runs: 6, reach: 6, pad: 3, sample: 3, edge: 2, slack: 0.5 };
// The big cave's layout for a seed, with linkGraph applied, and the stream
// that made it, for genWorld to carry on with. Draw k plans from
// rng(seed + k * 7919); the first whose route holds at least 10 rooms is
// kept. Draw 8 has no diagonals, so its route is at least 11 rooms and it
// always ends there.
function bigCaveGraph(seed) {
  for (let k = 0; ; k++) {
    const Rn = rng(seed + k * 7919),
      g = planGraph(Rn, {
        ...CAVE_PLAN,
        GX: 6,
        GZ: 6,
        diagP: k < 8 ? CAVE_PLAN.diagP : 0,
      }),
      path = linkGraph(g.nodes, g.edges, g.start, g.boss);
    if (path.length >= 10 || k === 8) return { Rn, ...g, path };
  }
}

// big builds the 36-room cave for two players; without it the stream is
// drawn exactly as before the big cave.
function genWorld(seed, big = false) {
  let Rn, nodes, edges, start, boss, path;
  if (big) ({ Rn, nodes, edges, start, boss, path } = bigCaveGraph(seed));
  else {
    Rn = rng(seed);
    ({ nodes, edges, start, boss } = planGraph(Rn, CAVE_PLAN));
    path = linkGraph(nodes, edges, start, boss);
  }
  // the dressing counts scale with the grid's area
  const DR = big ? 2 : 1;
  const segs = [];
  for (const e of edges) {
    const A = nodes[e.a],
      B = nodes[e.b],
      dx = B.x - A.x,
      dz = B.z - A.z,
      L = Math.hypot(dx, dz),
      nx = -dz / L,
      nz = dx / L;
    const a1 = 5 + Rn() * 4,
      f1 = 1 + Rn() * 0.7,
      p1 = Rn() * TAU,
      a2 = 1.8 + Rn() * 1.8,
      f2 = 2.3 + Rn() * 1.2,
      p2 = Rn() * TAU,
      rb = 3.3 + Rn() * 0.8,
      rp = Rn() * TAU;
    const K = Math.max(14, Math.round(L / 2.6));
    e.pts = [];
    e.seen = false;
    for (let i = 0; i <= K; i++) {
      const t = i / K,
        off =
          Math.sin(PI * t) *
          (a1 * Math.sin(TAU * f1 * t + p1) + a2 * Math.sin(TAU * f2 * t + p2));
      e.pts.push({
        x: A.x + dx * t + nx * off,
        z: A.z + dz * t + nz * off,
        r: rb + 0.6 * Math.sin(t * 9 + rp),
      });
    }
    for (let i = 0; i < K; i++) {
      const p = e.pts[i],
        q = e.pts[i + 1];
      segs.push({ ax: p.x, az: p.z, bx: q.x, bz: q.z, r: (p.r + q.r) / 2 });
    }
  }

  // ---- walkable field on a grid ----
  let minX = 1e9,
    minZ = 1e9,
    maxX = -1e9,
    maxZ = -1e9;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minZ = Math.min(minZ, n.z);
    maxZ = Math.max(maxZ, n.z);
  }
  minX = Math.floor(minX - 32);
  minZ = Math.floor(minZ - 32);
  maxX = Math.ceil(maxX + 32);
  maxZ = Math.ceil(maxZ + 32);
  const W = maxX - minX,
    H = maxZ - minZ,
    W1 = W + 1,
    F = new Float32Array(W1 * (H + 1)).fill(-3);
  const stamp = (x0, z0, x1, z1, fn) => {
    const ia = Math.max(0, Math.floor(x0 - minX)),
      ib = Math.min(W, Math.ceil(x1 - minX)),
      ja = Math.max(0, Math.floor(z0 - minZ)),
      jb = Math.min(H, Math.ceil(z1 - minZ));
    for (let j = ja; j <= jb; j++)
      for (let i = ia; i <= ib; i++) {
        const d = fn(i + minX, j + minZ),
          k = j * W1 + i;
        if (d > F[k]) F[k] = d;
      }
  };
  for (const n of nodes)
    stamp(
      n.x - n.r - 3,
      n.z - n.r - 3,
      n.x + n.r + 3,
      n.z + n.r + 3,
      (x, z) => n.r - Math.hypot(x - n.x, z - n.z),
    );
  for (const s of segs) {
    const dx = s.bx - s.ax,
      dz = s.bz - s.az,
      l2 = dx * dx + dz * dz || 1,
      m = s.r + 3;
    stamp(
      Math.min(s.ax, s.bx) - m,
      Math.min(s.az, s.bz) - m,
      Math.max(s.ax, s.bx) + m,
      Math.max(s.az, s.bz) + m,
      (x, z) => {
        const t = sat(((x - s.ax) * dx + (z - s.az) * dz) / l2);
        return s.r - Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
      },
    );
  }
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const k = j * W1 + i;
      if (F[k] <= -3) continue;
      const x = i + minX,
        z = j + minZ;
      F[k] = Math.max(
        -3,
        F[k] +
          (vnoise(x * 0.21 + 7.3, z * 0.21 + 1.9) - 0.5) * 1.3 +
          (vnoise(x * 0.63, z * 0.63) - 0.5) * 0.55,
      );
    }
  const {
    fieldAt,
    resolve,
    los,
    route,
    addRock,
    removeRock,
    clearRocks,
    waterAt,
    bodyAt,
  } = fieldFns(F, minX, minZ, W, H);
  const ceilRaw = (f) => 3.1 + 1.45 * Math.sqrt(Math.max(f + 0.5, 0));
  const ceilAt = (x, z) => ceilRaw(fieldAt(x, z));
  // ---- mesh ----
  const { P, C, tri } = meshSink();
  const mulc = (c, m) => [c[0] * m, c[1] * m, c[2] * m];
  function rock(x, z) {
    const t = smooth(vnoise(x * 0.018 + 3, z * 0.018 + 9) * 1.6 - 0.3);
    let c = [
      lerp(ROCK_A[0], ROCK_B[0], t),
      lerp(ROCK_A[1], ROCK_B[1], t),
      lerp(ROCK_A[2], ROCK_B[2], t),
    ];
    const db = sat(1 - Math.hypot(x - boss.x, z - boss.z) / 46);
    if (db > 0)
      c = [
        lerp(c[0], ROCK_BOSS[0], db),
        lerp(c[1], ROCK_BOSS[1], db),
        lerp(c[2], ROCK_BOSS[2], db),
      ];
    return c;
  }
  // floor + ceiling sheets
  const fy = (i, j) => {
    const f = F[j * W1 + i],
      jit = (hash2(i * 3 + 1, j * 3 + 2) - 0.5) * 0.16;
    return f < 0 ? Math.min(1.8, -f * 1.15) + jit : jit;
  };
  const cy = (i, j) =>
    ceilRaw(F[j * W1 + i]) + (hash2(i * 5 + 3, j * 5 + 7) - 0.5) * 0.7;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W1 + i,
        mx = Math.max(F[k], F[k + 1], F[k + W1], F[k + W1 + 1]);
      if (mx < -1.3) continue;
      const x = i + minX,
        z = j + minZ,
        h = hash2(i + 11, j + 5),
        rc = rock(x, z),
        fc = (F[k] + F[k + 1] + F[k + W1] + F[k + W1 + 1]) / 4;
      const a = [x, fy(i, j), z],
        b = [x + 1, fy(i + 1, j), z],
        c = [x + 1, fy(i + 1, j + 1), z + 1],
        d = [x, fy(i, j + 1), z + 1];
      const fcol = mulc(rc, (0.5 + 0.3 * h) * (fc < 0.9 ? 0.75 : 1));
      if (h < 0.5) {
        tri(a, b, c, fcol);
        tri(a, c, d, mulc(fcol, 0.9));
      } else {
        tri(a, b, d, fcol);
        tri(b, c, d, mulc(fcol, 0.9));
      }
      const a2 = [x, cy(i, j), z],
        b2 = [x + 1, cy(i + 1, j), z],
        c2 = [x + 1, cy(i + 1, j + 1), z + 1],
        d2 = [x, cy(i, j + 1), z + 1];
      const ccol = mulc(rc, 0.4 + 0.3 * hash2(i + 77, j + 31));
      tri(a2, b2, c2, ccol);
      tri(a2, c2, d2, mulc(ccol, 0.85));
    }
  // walls via marching squares
  const WY = [-0.3, 1.3, 2.9, 4.9],
    WO = [-0.3, 0.32, 0.15, -1.0],
    WJ = [0.15, 0.55, 0.55, 0.4];
  function wv(x, z, l) {
    const e = 0.6;
    let gx = fieldAt(x + e, z) - fieldAt(x - e, z),
      gz = fieldAt(x, z + e) - fieldAt(x, z - e);
    const gl2 = Math.hypot(gx, gz) || 1;
    gx /= gl2;
    gz /= gl2;
    const h = hash2(
        Math.round(x * 16) * 7 + l * 131,
        Math.round(z * 16) * 13 + l * 71,
      ),
      out = WO[l] + (h - 0.5) * WJ[l];
    return [
      x - gx * out,
      WY[l] + (l > 0 && l < 3 ? (h - 0.5) * 0.5 : 0),
      z - gz * out,
    ];
  }
  function wall(ax, az, bx, bz) {
    const rc = rock((ax + bx) / 2, (az + bz) / 2);
    for (let l = 0; l < 3; l++) {
      const a = wv(ax, az, l),
        b = wv(bx, bz, l),
        c = wv(bx, bz, l + 1),
        d = wv(ax, az, l + 1);
      const m =
        [0.62, 0.9, 1.0][l] *
        (0.75 + 0.5 * hash2(Math.round(ax * 9) + l * 17, Math.round(bz * 9)));
      tri(a, b, c, mulc(rc, m));
      tri(a, c, d, mulc(rc, m * 0.88));
    }
  }
  marchWalls(F, minX, minZ, W, H, (ax, az, bx, bz) => wall(ax, az, bx, bz));
  // decor
  function cone(x, y0, z, rad, h, col, glow = 0, lx = 0, lz = 0) {
    const n = 5,
      ph = hash2(x * 31, z * 17) * TAU,
      tip = [x + lx, y0 + h, z + lz];
    for (let i = 0; i < n; i++) {
      const a0 = ph + (i / n) * TAU,
        a1 = ph + ((i + 1) / n) * TAU;
      tri(
        [x + Math.cos(a0) * rad, y0, z + Math.sin(a0) * rad],
        [x + Math.cos(a1) * rad, y0, z + Math.sin(a1) * rad],
        tip,
        mulc(col, 0.8 + 0.4 * (i % 2)),
        glow,
      );
    }
  }
  function shard(x, z, rad, h, lx, lz, col) {
    const base = [x, -0.1, z],
      top = [x + lx, h, z + lz],
      my = h * 0.38,
      n = 4,
      ph = hash2(x * 91, z * 37) * TAU,
      rg = [];
    for (let i = 0; i < n; i++) {
      const a = ph + (i / n) * TAU;
      rg.push([
        x + lx * 0.38 + Math.cos(a) * rad,
        my,
        z + lz * 0.38 + Math.sin(a) * rad,
      ]);
    }
    for (let i = 0; i < n; i++) {
      const m = 0.55 + (0.45 * ((i * 7 + 3) % 4)) / 3;
      tri(rg[i], rg[(i + 1) % n], top, mulc(col, m), 1);
      tri(rg[(i + 1) % n], rg[i], base, mulc(col, m * 0.6), 0.7);
    }
  }
  const rx = () => minX + Rn() * W,
    rz = () => minZ + Rn() * H;
  let cnt = 0;
  for (let t = 0; t < 9000 * DR && cnt < 460 * DR; t++) {
    const x = rx(),
      z = rz(),
      f = fieldAt(x, z);
    if (f > 0.1 && f < 0.5) {
      cone(
        x,
        -0.15,
        z,
        0.2 + Rn() * 0.34,
        Rn() < 0.12 ? 2 + Rn() : 0.5 + Rn() * 1.3,
        mulc(rock(x, z), 0.75),
      );
      cnt++;
    }
  }
  cnt = 0;
  for (let t = 0; t < 9000 * DR && cnt < 520 * DR; t++) {
    const x = rx(),
      z = rz(),
      f = fieldAt(x, z);
    if (f < 0.7) continue;
    const top = ceilRaw(f);
    let len = 0.5 + Rn() * Rn() * 3;
    if (top - len < 3.3) len = top - 3.3;
    if (len < 0.35) continue;
    cone(
      x,
      top + 0.45,
      z,
      0.18 + Rn() * 0.3,
      -(len + 0.45),
      mulc(rock(x, z), 0.55),
    );
    cnt++;
  }
  const lights = [],
    halos = [];
  for (let t = 0; t < 14000 * DR && lights.length < 58 * DR; t++) {
    const x = rx(),
      z = rz(),
      f = fieldAt(x, z);
    if (f < 0.12 || f > 0.6) continue;
    let ok = true;
    for (const L of lights)
      if (Math.hypot(L.x - x, L.z - z) < 12.5) {
        ok = false;
        break;
      }
    if (!ok) continue;
    const dB = Math.hypot(x - boss.x, z - boss.z);
    const key =
        dB < 40
          ? "red"
          : vnoise(x * 0.02 + 40, z * 0.02 + 12) > 0.5
            ? "violet"
            : "cyan",
      col = CRY[key];
    const n = 3 + ((Rn() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = Rn() * TAU,
        d = Rn() * 0.55,
        h = 0.7 + Rn() * 1.5,
        la = Rn() * TAU,
        lm = Rn() * 0.6 * h;
      shard(
        x + Math.cos(a) * d,
        z + Math.sin(a) * d,
        0.14 + Rn() * 0.17,
        h,
        Math.cos(la) * lm,
        Math.sin(la) * lm,
        mulc(col, 0.55 + Rn() * 0.5),
      );
    }
    lights.push({ x, y: 1.5, z, c: col, i: 1.5, r: 15, ph: Rn() * TAU });
    halos.push({ x, y: 0.9, z, c: col, s: 1.5 });
  }
  // shrines (checkpoints)
  const shrines = [];
  const shrineIds = [start.id];
  if (big) {
    // every third room along the route while three short of the boss's, and
    // the room before the boss's. No includes guard is needed: a route of 10
    // or more rooms makes these indices distinct
    for (let i = 3; i <= path.length - 4; i += 3) shrineIds.push(path[i]);
    shrineIds.push(path[path.length - 2]);
  } else if (path.length >= 4) {
    const a = path[Math.max(1, Math.round((path.length - 1) * 0.45))],
      b = path[path.length - 2];
    if (!shrineIds.includes(a)) shrineIds.push(a);
    if (!shrineIds.includes(b)) shrineIds.push(b);
  }
  for (const sid of shrineIds) {
    const n = nodes[sid];
    if (n.kind === "room") n.kind = "shrine";
    const sx = n.x + (sid === start.id ? 0 : 2),
      sz = n.z + (sid === start.id ? 3.5 : 0),
      st = hexc(0x3b3f4a);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU,
        a1 = ((i + 1) / 8) * TAU,
        c0 = Math.cos(a0),
        s0 = Math.sin(a0),
        c1 = Math.cos(a1),
        s1 = Math.sin(a1),
        m = 0.8 + 0.4 * (i % 2);
      tri(
        [sx + c0 * 0.75, 0, sz + s0 * 0.75],
        [sx + c1 * 0.75, 0, sz + s1 * 0.75],
        [sx + c1 * 0.4, 0.8, sz + s1 * 0.4],
        mulc(st, m),
      );
      tri(
        [sx + c0 * 0.75, 0, sz + s0 * 0.75],
        [sx + c1 * 0.4, 0.8, sz + s1 * 0.4],
        [sx + c0 * 0.4, 0.8, sz + s0 * 0.4],
        mulc(st, m),
      );
      tri(
        [sx + c0 * 0.4, 0.8, sz + s0 * 0.4],
        [sx + c1 * 0.4, 0.8, sz + s1 * 0.4],
        [sx + c1 * 0.8, 1.15, sz + s1 * 0.8],
        mulc(st, m * 1.2),
      );
      tri(
        [sx + c0 * 0.4, 0.8, sz + s0 * 0.4],
        [sx + c1 * 0.8, 1.15, sz + s1 * 0.8],
        [sx + c0 * 0.8, 1.15, sz + s0 * 0.8],
        mulc(st, m * 1.2),
      );
    }
    shrines.push({ x: sx, z: sz, node: sid, lit: sid === start.id, restT: 0 });
  }
  // spawns
  const PACKS = [
    ["husk", "husk"],
    ["husk", "husk", "spit"],
    ["brute", "husk"],
    ["husk", "husk", "husk", "spit"],
    ["brute", "spit", "husk"],
    ["brute", "brute", "spit"],
  ];
  // The big cave adds two larger packs and picks by a room's depth as a
  // share of the deepest room that holds a pack.
  let deepest = 0;
  if (big) {
    PACKS.push(
      ["brute", "brute", "spit", "husk", "husk"],
      ["brute", "brute", "spit", "spit", "husk", "husk"],
    );
    for (const n of nodes)
      if (n.kind === "room") deepest = Math.max(deepest, n.depth);
  }
  const packAt = (n) =>
    !big
      ? n.depth - 1
      : deepest > 1
        ? Math.floor(((n.depth - 1) / (deepest - 1)) * 7)
        : 0;
  const spawns = [];
  for (const n of nodes) {
    if (n.kind !== "room") continue;
    const pk =
      PACKS[clamp(packAt(n) + ((Rn() * 2) | 0), 0, PACKS.length - 1)];
    pk.forEach((type, i) => {
      const a = Rn() * TAU,
        d = (0.2 + Rn() * 0.4) * n.r,
        o = { x: n.x + Math.cos(a) * d, z: n.z + Math.sin(a) * d };
      resolve(o, 1.2);
      spawns.push({ type, x: o.x, z: o.z, yaw: Rn() * TAU, node: n.id });
    });
  }
  for (const e of edges) {
    if (Rn() > 0.5) continue;
    const A = nodes[e.a],
      B = nodes[e.b],
      far = A.depth <= B.depth ? B : A,
      keep = boss.r + PURSUIT.bossPad,
      inBoss = (q) => Math.hypot(q.x - boss.x, q.z - boss.z) < keep,
      last = e.pts.length - 1;
    // A post inside the boss chamber is moved back up its tunnel, away from
    // the chamber, until it is outside. No random numbers are used for this.
    let mi = (e.pts.length / 2) | 0;
    const dir = inBoss(e.pts[0]) ? 1 : -1;
    while (mi >= 0 && mi <= last && inBoss(e.pts[mi])) mi += dir;
    if (mi < 0 || mi > last) continue;
    const m = e.pts[mi];
    spawns.push({
      type: "husk",
      x: m.x,
      z: m.z,
      yaw: Math.atan2(far.x - m.x, far.z - m.z),
      node: -1,
    });
  }
  spawns.push({
    type: "warden",
    x: boss.x,
    z: boss.z,
    yaw: Math.atan2(
      nodes[path[path.length - 2]].x - boss.x,
      nodes[path[path.length - 2]].z - boss.z,
    ),
    node: boss.id,
  });
  // the big cave is cut into pieces for culling; the co-op host never draws,
  // so it casts no sight lines (the mesh is the same either way)
  const cut = big ? SEWER.piece.fog / ENV_CAVE.fogD : 0;
  // world.los, with walls counted CAVE_PIECE.slack thinner
  const losSlack = (ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az),
      n = Math.max(1, Math.ceil(d / 0.8));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (fieldAt(lerp(ax, bx, t), lerp(az, bz, t)) < -CAVE_PIECE.slack)
        return false;
    }
    return true;
  };
  const cutUp = big
    ? cutPieces({
        nodes,
        edges,
        F,
        W,
        H,
        minX,
        minZ,
        P,
        C,
        M: null,
        los: losSlack,
        roomBox: (n) => [n.x - n.r, n.z - n.r, n.x + n.r, n.z + n.r],
        inRoom: (n, x, z) => n.r - Math.hypot(x - n.x, z - n.z),
        line: (e) => e.pts,
        runs: CAVE_PIECE.runs,
        reach: CAVE_PIECE.reach,
        pad: CAVE_PIECE.pad,
        sample: CAVE_PIECE.sample,
        edge: CAVE_PIECE.edge,
        cut,
        sees: !COOP_HEADLESS_HERE,
      })
    : null;
  const sp = { x: start.x, z: start.z };
  resolve(sp, 1);
  return {
    seed,
    nodes,
    edges,
    start,
    boss,
    path,
    minX,
    minZ,
    W,
    H,
    fieldAt,
    ceilAt,
    resolve,
    los,
    route,
    addRock,
    removeRock,
    clearRocks,
    waterAt,
    bodyAt,
    bodies: [],
    grates: [],
    wallTunnels: [],
    shafts: [],
    pieces: cutUp ? cutUp.pieces : null,
    pieceGrid: cutUp ? cutUp.pieceGrid : null,
    pieceAt: cutUp ? cutUp.pieceAt : () => -1,
    cut,
    big,
    pos: cutUp ? cutUp.pos : new Float32Array(P),
    col: cutUp ? cutUp.col : new Uint8Array(C),
    mat: null,
    lights,
    halos,
    shrines,
    spawns,
    spawn: sp,
    plaques: [],
    spawnYaw: Math.atan2(
      nodes[path[1]].x - start.x,
      nodes[path[1]].z - start.z,
    ),
  };
}
