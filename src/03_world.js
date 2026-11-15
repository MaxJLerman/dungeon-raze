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
function fieldFns(F, minX, minZ, W, H) {
  const W1 = W + 1;
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
  return { fieldAt, resolve, los };
}
// Collects world triangles: positions as floats, colours square-root encoded
// in bytes with the glow amount in the alpha byte.
function meshSink() {
  const P = [],
    C = [];
  const b8 = (v) => clamp(Math.sqrt(Math.max(v, 0)) * 255, 0, 255) | 0;
  function tri(a, b, c, col, glow = 0) {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const r = b8(col[0]),
      g = b8(col[1]),
      bl = b8(col[2]),
      gl2 = (glow * 255) | 0;
    C.push(r, g, bl, gl2, r, g, bl, gl2, r, g, bl, gl2);
  }
  return { P, C, tri };
}

function genWorld(seed) {
  const Rn = rng(seed);
  const GX = 4,
    GZ = 4,
    SP = 44;
  const nodes = [];
  for (let gz = 0; gz < GZ; gz++)
    for (let gx = 0; gx < GX; gx++)
      nodes.push({
        id: nodes.length,
        x: gx * SP + (Rn() - 0.5) * 20,
        z: gz * SP + (Rn() - 0.5) * 20,
        r: 8.5 + Rn() * 3.5,
        adj: [],
        depth: -1,
        seen: false,
        kind: "room",
      });
  const start = nodes[0],
    boss = nodes[GX * GZ - 1];
  start.r = 9.5;
  start.kind = "start";
  boss.r = 16.5;
  boss.kind = "boss";

  // graph: spanning tree + extra edges for loops
  const id = (gx, gz) => gz * GX + gx,
    cand = [];
  for (let gz = 0; gz < GZ; gz++)
    for (let gx = 0; gx < GX; gx++) {
      if (gx < GX - 1) cand.push({ a: id(gx, gz), b: id(gx + 1, gz), w: Rn() });
      if (gz < GZ - 1) cand.push({ a: id(gx, gz), b: id(gx, gz + 1), w: Rn() });
      if (gx < GX - 1 && gz < GZ - 1 && Rn() < 0.35) {
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
      Rn() < (c.diag ? 0.6 : 0.5) &&
      c.a !== boss.id &&
      c.b !== boss.id
    )
      edges.push(c);
  }
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
    A.adj.push(e.b);
    B.adj.push(e.a);
  }
  // BFS depth + path to boss
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
  const { fieldAt, resolve, los } = fieldFns(F, minX, minZ, W, H);
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
      const S = (p, q2) => wall(p[0], p[1], q2[0], q2[1]);
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
  for (let t = 0; t < 9000 && cnt < 460; t++) {
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
  for (let t = 0; t < 9000 && cnt < 520; t++) {
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
  for (let t = 0; t < 14000 && lights.length < 58; t++) {
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
  if (path.length >= 4) {
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
  const spawns = [];
  for (const n of nodes) {
    if (n.kind !== "room") continue;
    const pk =
      PACKS[clamp(n.depth - 1 + ((Rn() * 2) | 0), 0, PACKS.length - 1)];
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
      m = e.pts[(e.pts.length / 2) | 0];
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
    pos: new Float32Array(P),
    col: new Uint8Array(C),
    lights,
    halos,
    shrines,
    spawns,
    spawn: sp,
    spawnYaw: Math.atan2(
      nodes[path[1]].x - start.x,
      nodes[path[1]].z - start.z,
    ),
  };
}
