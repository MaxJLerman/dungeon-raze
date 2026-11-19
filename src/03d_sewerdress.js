// ---------- the sewer's dressing ----------

// The corners of each face of a box, as -1 or 1 along its facing, its right
// and up.
const BOX_FACES = [
  [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
  [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
];

// The shapes and wall fittings the dressing is built from, and the lists it
// fills: lights, halos, grates and drains, and shafts. o is what genSewer
// hands dressSewer.
function sewerKit(o) {
  const { Rd, fieldAt, waterAt, roofAt, tri } = o;
  const sink = WATER.sink,
    mulc = (c, m) => [c[0] * m, c[1] * m, c[2] * m],
    BLACK = [0.003, 0.004, 0.003],
    ribCol = mulc(BRICK, 1.08);
  const lights = [],
    halos = [],
    grates = [],
    shafts = [];

  // ---- shapes ----
  const quad = (a, b, c, d, col, glow = 0, mat = 0) => {
    tri(a, b, c, col, glow, mat);
    tri(a, c, d, col, glow, mat);
  };
  // a box from its centre, its facing, and half its depth along the facing,
  // its width and its height
  const box = (x, y, z, yaw, hf, hr, hy, col, mat = 0, glow = 0) => {
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      v = ([i, j, k]) => [
        x + fx * hf * i - fz * hr * j,
        y + hy * k,
        z + fz * hf * i + fx * hr * j,
      ];
    for (const [a, b, c, d] of BOX_FACES)
      quad(v(a), v(b), v(c), v(d), col, glow, mat);
  };
  // the sides of an n-sided tube from a to b; returns the two directions
  // across it
  const tube = (a, b, rad, n, col, mat = 0, glow = 0) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      L = Math.hypot(d[0], d[1], d[2]),
      t = d.map((v) => v / L),
      u0 = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
      ud = u0[0] * t[0] + u0[1] * t[1] + u0[2] * t[2],
      u1 = [u0[0] - t[0] * ud, u0[1] - t[1] * ud, u0[2] - t[2] * ud],
      ul = Math.hypot(u1[0], u1[1], u1[2]),
      u = u1.map((v) => v / ul),
      w = [
        t[1] * u[2] - t[2] * u[1],
        t[2] * u[0] - t[0] * u[2],
        t[0] * u[1] - t[1] * u[0],
      ];
    const at = (p, k) => {
      const an = (k / n) * TAU,
        c = Math.cos(an) * rad,
        s = Math.sin(an) * rad;
      return [
        p[0] + u[0] * c + w[0] * s,
        p[1] + u[1] * c + w[1] * s,
        p[2] + u[2] * c + w[2] * s,
      ];
    };
    for (let k = 0; k < n; k++)
      quad(at(a, k), at(a, k + 1), at(b, k + 1), at(b, k), col, glow, mat);
    return { u, w };
  };
  const prism = (x, z, r, y0, y1, n, col, glow = 0, mat = 0) =>
    tube([x, y0, z], [x, y1, z], r, n, col, mat, glow);
  // a pyramid of n sides, its base at y, its tip h above (or below)
  const cone = (x, y, z, r, h, n, col) => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU,
        a1 = ((k + 1) / n) * TAU;
      tri(
        [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r],
        [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r],
        [x, y + h, z],
        col,
      );
    }
  };
  // a flat ring in the plane y, from radius r0 to r1
  const annulus = (x, y, z, r0, r1, n, col, glow = 0) => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU,
        a1 = ((k + 1) / n) * TAU,
        P = (a, r) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      quad(P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), col, glow);
    }
  };
  // An arch across a passage: c its middle on the floor, n across it and t
  // along it. Its legs stand against walls `half` out either side; between
  // them it follows the drawn vault, d below it, and it is w either side of c
  // along the passage. Its edges run 0.15 into the wall and vault so no gap
  // shows. alt shades every other stone.
  const arch = (c, n, t, half, w, d, col, mat, segs, alt) => {
    const s0 = half - d,
      I = [],
      Q = [];
    const foot = (s) =>
      waterAt(c.x + n[0] * s, c.z + n[1] * s) > 0 ? -sink - 0.05 : -0.02;
    I.push([-s0, foot(-s0)]);
    Q.push([-half - 0.15, foot(-s0)]);
    for (let k = 0; k <= segs; k++) {
      const s = -s0 + (2 * s0 * k) / segs,
        y = roofAt(c.x + n[0] * s, c.z + n[1] * s);
      I.push([s, y - d]);
      Q.push([(s * (half + 0.15)) / s0, y + 0.15]);
    }
    I.push([s0, foot(s0)]);
    Q.push([half + 0.15, foot(s0)]);
    const P3 = ([s, y], e) => [
      c.x + n[0] * s + t[0] * e,
      y,
      c.z + n[1] * s + t[1] * e,
    ];
    for (let k = 0; k + 1 < I.length; k++) {
      const cl = alt && k % 2 ? mulc(col, 0.84) : col;
      quad(P3(I[k], -w), P3(I[k + 1], -w), P3(I[k + 1], w), P3(I[k], w), cl, 0, mat);
      for (const e of [-w, w])
        quad(P3(I[k], e), P3(I[k + 1], e), P3(Q[k + 1], e), P3(Q[k], e), cl, 0, mat);
    }
  };
  // whether a straight wall stands s across n from c (s signed), for 0.4
  // either way along t
  const wallAt = (c, n, t, s) => {
    const g = Math.sign(s);
    for (const e of [-0.4, 0, 0.4]) {
      const x = c.x + t[0] * e,
        z = c.z + t[1] * e,
        fin = fieldAt(x + n[0] * (s - g * 0.3), z + n[1] * (s - g * 0.3)),
        fout = fieldAt(x + n[0] * (s + g * 0.3), z + n[1] * (s + g * 0.3));
      if (fin < 0.1 || fin > 0.5 || fout > -0.1) return false;
    }
    return true;
  };
  const nearCrumble = (x, z, r) =>
    o.crumble.some((q) => Math.hypot(q.x - x, q.z - z) < r);
  const out = (n, sd) => Math.atan2(-n[0] * sd, -n[1] * sd);

  // ---- things on walls ----
  // a lamp: (x, z) on the wall's face, yaw facing out of it, y the middle of
  // its glass. About one in three flickers.
  const lamp = (x, z, yaw, y) => {
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      gx = x + fx * 0.4,
      gz = z + fz * 0.4;
    box(x + fx * 0.03, y + 0.3, z + fz * 0.03, yaw, 0.03, 0.08, 0.11, SEWER_IRON);
    box(x + fx * 0.22, y + 0.3, z + fz * 0.22, yaw, 0.2, 0.025, 0.025, SEWER_IRON);
    prism(gx, gz, 0.1, y - 0.12, y + 0.12, 6, mulc(SEWER_LAMP, 0.55), 0.5);
    cone(gx, y + 0.12, gz, 0.14, 0.17, 6, SEWER_IRON);
    cone(gx, y - 0.12, gz, 0.11, -0.07, 6, SEWER_IRON);
    const ph = Rd() * TAU,
      flick = Rd() < 1 / 3;
    lights.push({ x: gx + fx * 0.2, y, z: gz + fz * 0.2, c: SEWER_LAMP, i: 1.1, r: 13, ph, flick });
    halos.push({ x: gx, y, z: gz, c: SEWER_LAMP, s: 1.1, ph, flick, lamp: true });
  };
  // a barred grate at the foot of a wall: (x, z) on the wall's face, yaw
  // facing out of it
  const grate = (x, z, yaw) => {
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      at = (r, y, f) => [x - fz * r + fx * f, y, z + fx * r + fz * f],
      B = (r, y, f, hf, hr, hy, col) => {
        const p = at(r, y, f);
        box(p[0], p[1], p[2], yaw, hf, hr, hy, col);
      };
    quad(at(-0.56, -sink - 0.1, 0.02), at(0.56, -sink - 0.1, 0.02), at(0.56, 0.64, 0.02), at(-0.56, 0.64, 0.02), BLACK);
    B(-0.66, 0.3, 0.06, 0.08, 0.11, 0.66, SEWER_STONE);
    B(0.66, 0.3, 0.06, 0.08, 0.11, 0.66, SEWER_STONE);
    B(0, 0.76, 0.07, 0.09, 0.77, 0.12, mulc(SEWER_STONE, 0.9));
    for (let k = -2; k <= 2; k++) B(k * 0.21, 0.13, 0.06, 0.022, 0.022, 0.5, SEWER_IRON);
    B(0, 0.36, 0.07, 0.02, 0.56, 0.025, SEWER_IRON);
    grates.push({ x, z, yaw, kind: "grate" });
  };
  // a drain pipe's mouth low in a wall, with its flange and dark inside
  const drain = (x, z, yaw) => {
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      y = 0.55,
      P = (e) => [x + fx * e, y, z + fz * e],
      { u, w } = tube(P(-0.2), P(0.36), 0.19, 8, SEWER_RUST);
    tube(P(-0.05), P(0.06), 0.27, 8, mulc(SEWER_STONE, 0.8));
    const c = P(0.32),
      rim = (k) => {
        const an = (k / 8) * TAU,
          a = Math.cos(an) * 0.17,
          b = Math.sin(an) * 0.17;
        return [c[0] + u[0] * a + w[0] * b, c[1] + u[1] * a + w[1] * b, c[2] + u[2] * a + w[2] * b];
      };
    for (let k = 0; k < 8; k++) tri(c, rim(k), rim(k + 1), BLACK);
    grates.push({ x, z, yaw, kind: "drain" });
  };
  return {
    sink, mulc, BLACK, ribCol, lights, halos, grates, shafts,
    quad, box, tube, prism, cone, annulus, arch, wallAt, nearCrumble, out,
    lamp, grate, drain,
  };
}

// Everything in the sewer that is drawn and blocks nothing: brick ribs and
// stone portals across tunnels and rooms, pipes, grates and drains, lamps,
// brick heaps, the ladder and manhole, the rest points, pillar bases and the
// boss cavern's set. It reads the field and never writes it, and draws from
// its own random stream o.Rd. Returns the lamps (and other lights), their
// halos, the grates and drains, and the shafts.
function dressSewer(o) {
  const kit = sewerKit(o);
  dressTunnels(o, kit);
  dressHeaps(o, kit);
  dressRooms(o, kit);
  dressArrival(o, kit);
  dressRests(o, kit);
  dressBoss(o, kit);
  return { lights: kit.lights, halos: kit.halos, grates: kit.grates, shafts: kit.shafts };
}

// Tunnels: a stone portal where each leaves a room, brick ribs between, a
// lamp on every third rib, grates and drains low in the walls, and a pipe
// along some.
function dressTunnels(o, kit) {
  const { S, Rd, nodes, edges, roomAt } = o,
    { ribCol, arch, wallAt, nearCrumble, out, lamp, grate, drain, tube } = kit;
  const gap = () => S.ribGap[0] + Rd() * (S.ribGap[1] - S.ribGap[0]);
  for (const e of edges) {
    const line = [nodes[e.a], ...e.bends, nodes[e.b]],
      segs = [];
    let tot = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const p = line[i],
        q = line[i + 1],
        L = Math.hypot(q.x - p.x, q.z - p.z),
        t = [(q.x - p.x) / L, (q.z - p.z) / L];
      segs.push({ p, L, t, n: [-t[1], t[0]], a0: tot });
      tot += L;
    }
    // the point at arc length a, its run's directions and how far it is
    // from the nearest bend
    const at = (a) => {
      let g = segs[segs.length - 1];
      for (const sg of segs)
        if (a < sg.a0 + sg.L) {
          g = sg;
          break;
        }
      const l = clamp(a - g.a0, 0, g.L);
      return {
        x: g.p.x + g.t[0] * l,
        z: g.p.z + g.t[1] * l,
        t: g.t,
        n: g.n,
        bend: Math.min(l, g.L - l),
      };
    };
    const inRoom = (a, pad) => {
      const q = at(a);
      return !!roomAt(q.x, q.z, pad);
    };
    // the stretch outside every room
    let a0 = 0,
      a1 = tot;
    while (a0 < tot && inRoom(a0, 0.6)) a0 += 0.25;
    while (a1 > a0 && inRoom(a1, 0.6)) a1 -= 0.25;
    if (a1 - a0 < 2) continue;
    const both = (q) =>
      q.bend >= 0.8 &&
      wallAt(q, q.n, q.t, S.tunR) &&
      wallAt(q, q.n, q.t, -S.tunR);
    // a stone portal where the tunnel leaves each room
    const portal = (from, dir) => {
      for (let a = from; Math.abs(a - from) < 4; a += dir * 0.25) {
        const q = at(a);
        if (!both(q)) continue;
        arch(q, q.n, q.t, S.tunR, 0.36, 0.32, SEWER_STONE, 0, 12, true);
        return a;
      }
      return from;
    };
    const pa = portal(a0, 1),
      pb = portal(a1, -1);
    // brick ribs between the portals, a lamp on every third
    const ribs = [pa];
    let k = 0;
    for (let a = pa + gap(); a < pb - 2; ) {
      const q = at(a);
      if (q.bend < 1.2 || !both(q) || inRoom(a, 1) || nearCrumble(q.x, q.z, 2.6)) {
        a += 0.5;
        continue;
      }
      arch(q, q.n, q.t, S.tunR, 0.2, S.ribD, ribCol, MAT.BRICK, 10, false);
      if (k % 3 === 1) {
        const sd = (k / 3) & 1 ? 1 : -1,
          s = sd * (S.tunR - S.ribD);
        lamp(q.x + q.n[0] * s, q.z + q.n[1] * s, out(q.n, sd), 2.6);
      }
      k++;
      ribs.push(a);
      a += gap();
    }
    ribs.push(pb);
    // grates and drains between ribs, S.grateGap apart at least; the first
    // in a tunnel is a grate
    let last = -1e9,
      placed = 0;
    const fit = (a, sd, kind) => {
      const q = at(a);
      if (q.bend < 1 || inRoom(a, 1.5) || nearCrumble(q.x, q.z, 3)) return false;
      if (!wallAt(q, q.n, q.t, sd * S.tunR)) return false;
      const x = q.x + q.n[0] * sd * S.tunR,
        z = q.z + q.n[1] * sd * S.tunR;
      (kind === "drain" ? drain : grate)(x, z, out(q.n, sd));
      return true;
    };
    for (let i = 0; i + 1 < ribs.length; i++) {
      const a = (ribs[i] + ribs[i + 1]) / 2;
      if (a - last < S.grateGap) continue;
      const sd = Rd() < 0.5 ? -1 : 1,
        kind = placed && Rd() < 0.4 ? "drain" : "grate";
      if (fit(a, sd, kind) || fit(a, -sd, kind)) {
        last = a;
        placed++;
      }
    }
    for (let a = a0 + 1; !placed && a < a1 - 1; a += 0.5)
      if (fit(a, 1, "grate") || fit(a, -1, "grate")) placed++;
    // a pipe along one wall, where the wall runs straight behind it, turning
    // into the wall at each end
    if (Rd() < 0.55) {
      const sd = Rd() < 0.5 ? -1 : 1,
        rad = 0.11 + Rd() * 0.08,
        y = 1.6 + Rd() * 0.4,
        off = sd * (S.tunR - rad - 0.05);
      for (const g of segs) {
        const P = (l, o2) => [
          g.p.x + g.t[0] * l + g.n[0] * o2,
          y,
          g.p.z + g.t[1] * l + g.n[1] * o2,
        ];
        const pipe = (l0, l1) => {
          tube(P(l0, off), P(l1, off), rad, 6, SEWER_RUST);
          tube(P(l0, off), P(l0, off + sd * 0.7), rad, 6, SEWER_RUST);
          tube(P(l1, off), P(l1, off + sd * 0.7), rad, 6, SEWER_RUST);
        };
        let s0 = null,
          s1 = 0;
        for (let l = 0.6; l <= g.L - 0.6; l += 0.5) {
          const q = at(g.a0 + l);
          const a = g.a0 + l;
          if (a > pa + 0.7 && a < pb - 0.7 && wallAt(q, q.n, q.t, sd * S.tunR)) {
            if (s0 === null) s0 = l;
            s1 = l;
          } else {
            if (s0 !== null && s1 - s0 >= 1.5) pipe(s0, s1);
            s0 = null;
          }
        }
        if (s0 !== null && s1 - s0 >= 1.5) pipe(s0, s1);
      }
    }
  }
}

// Brick heaps where a wall has fallen in.
function dressHeaps(o, kit) {
  const { Rd, fieldAt } = o,
    { box, mulc } = kit;
  for (const c of o.crumble) {
    let gx = fieldAt(c.x + 0.5, c.z) - fieldAt(c.x - 0.5, c.z),
      gz = fieldAt(c.x, c.z + 0.5) - fieldAt(c.x, c.z - 0.5);
    const gl = Math.hypot(gx, gz) || 1;
    gx /= gl;
    gz /= gl;
    // from where the wall stands now, out into the tunnel
    let u0 = -1.5;
    while (u0 < 1.5 && fieldAt(c.x + gx * u0, c.z + gz * u0) < 0.05) u0 += 0.1;
    const bx = c.x + gx * u0,
      bz = c.z + gz * u0;
    for (let i = 0; i < 48; i++) {
      const u = Math.pow(Rd(), 1.4) * 2.1,
        v = (Rd() - 0.5) * 3.4 * (1 - u / 3),
        h = 0.85 * (1 - u / 2.1) * (1 - Math.abs(v) / 1.9) * Rd(),
        sc = 0.8 + Rd() * 0.7;
      box(
        bx + gx * u - gz * v,
        Math.max(0, h) + 0.05 * sc,
        bz + gz * u + gx * v,
        Rd() * TAU,
        0.12 * sc,
        0.06 * sc,
        0.05 * sc,
        mulc(BRICK, 0.5 + Rd() * 0.5),
      );
    }
    for (let i = 0; i < 6; i++) {
      const u = Rd() * 0.9,
        v = (Rd() - 0.5) * 2;
      box(bx + gx * u - gz * v, 0.15, bz + gz * u + gx * v, Rd() * TAU, 0.34, 0.24, 0.2, mulc(BRICK, 0.45), MAT.BRICK);
    }
  }
}

// Rooms: transverse brick arches on pilasters, lamps, and the pillars'
// bases and capitals.
function dressRooms(o, kit) {
  const { S, nodes } = o,
    { sink, mulc, ribCol, arch, wallAt, out, lamp, prism, cone } = kit;
  for (const n of nodes) {
    if (n.kind === "boss") continue;
    const onX = n.hw >= n.hd,
      U = onX ? n.hw : n.hd,
      V = onX ? n.hd : n.hw,
      t = onX ? [1, 0] : [0, 1],
      nv = onX ? [0, 1] : [1, 0],
      m = Math.max(1, Math.round((2 * U - 6) / 5.5) + 1),
      // what stands in the vault's way: pillars, and the manhole
      clear = (u) =>
        [...o.pillars, o.hole].every(
          (c) => Math.abs((c.x - n.x) * t[0] + (c.z - n.z) * t[1] - u) > 1.8,
        );
    let k = 0;
    for (let i = 0; i < m; i++) {
      const u = m === 1 ? 0 : -(U - 3) + (2 * (U - 3) * i) / (m - 1),
        q = { x: n.x + t[0] * u, z: n.z + t[1] * u };
      if (!clear(u) || !wallAt(q, nv, t, V) || !wallAt(q, nv, t, -V)) continue;
      arch(q, nv, t, V, 0.3, 0.26, ribCol, MAT.BRICK, 14, false);
      if (k % 2 === 0) {
        const sd = (k / 2) % 2 ? 1 : -1,
          s = sd * (V - 0.26);
        lamp(q.x + nv[0] * s, q.z + nv[1] * s, out(nv, sd), 3);
      }
      k++;
    }
    // lamps on the end walls where no tunnel leaves
    for (const sd of [-1, 1])
      if (wallAt(n, t, nv, sd * U))
        lamp(n.x + t[0] * sd * U, n.z + t[1] * sd * U, out(t, sd), 3);
  }
  // pillars get a stone base and a capital under the vault
  for (const c of o.pillars) {
    prism(c.x, c.z, 1, -sink - 0.05, 0.35, 8, SEWER_STONE);
    const top = o.wallTop(c.x + S.pillarR, c.z);
    prism(c.x, c.z, 1, top - 0.75, top - 0.45, 8, SEWER_STONE);
    cone(c.x, top - 0.75, c.z, 1, -0.25, 8, mulc(SEWER_STONE, 0.85));
  }
}

// The arrival: the manhole, its shaft up through the vault and the ladder
// down from it.
function dressArrival(o, kit) {
  const { mulc, lights, prism, annulus, box } = kit;
  {
    const h = o.hole,
      top = o.holeY,
      p = o.perp,
      tall = top + 2.6;
    // the shaft, a stone collar under the vault wide enough to hide the cut
    // cell's corners, and a skirt from it up past the cell's highest corner
    prism(h.x, h.z, 0.46, top - 0.05, tall, 10, mulc(BRICK, 0.6), 0, MAT.BRICK);
    annulus(h.x, top, h.z, 0.44, 0.88, 12, mulc(SEWER_STONE, 0.7));
    prism(h.x, h.z, 0.88, top - 0.14, o.holeTop, 12, mulc(SEWER_STONE, 0.6));
    annulus(h.x, tall - 0.05, h.z, 0, 0.48, 10, SEWER_SKY, 1);
    const ry = Math.atan2(p.z, -p.x);
    for (const sd of [-1, 1])
      box(h.x + p.x * 0.24 * sd, tall / 2, h.z + p.z * 0.24 * sd, ry, 0.025, 0.03, tall / 2, SEWER_IRON);
    for (let y = 0.3; y < tall - 0.2; y += 0.3)
      box(h.x, y, h.z, ry, 0.02, 0.24, 0.018, SEWER_IRON);
    lights.push({ x: h.x, y: top - 0.6, z: h.z, c: SEWER_SKY, i: 0.9, r: 9, ph: 0, flick: false });
  }
}

// Rest points: a brick plinth with an iron fire basket.
function dressRests(o, kit) {
  const { box, tube, prism } = kit;
  for (const sh of o.shrines) {
    box(sh.x, 0.42, sh.z, 0, 0.42, 0.42, 0.44, BRICK, MAT.BRICK);
    box(sh.x, 0.9, sh.z, 0, 0.48, 0.48, 0.05, SEWER_STONE);
    const P = (a, r, y) => [sh.x + Math.cos(a) * r, y, sh.z + Math.sin(a) * r];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU,
        b = ((k + 1) / 8) * TAU;
      tube(P(a, 0.2, 0.95), P(a, 0.36, 1.45), 0.022, 4, SEWER_IRON);
      tube(P(a, 0.36, 1.45), P(b, 0.36, 1.45), 0.024, 4, SEWER_IRON);
    }
    prism(sh.x, sh.z, 0.24, 0.95, 1.02, 8, hexc(0x5a2a12), 0.3);
  }
}

// The boss cavern's set: the wall tunnels and their falls, pilasters and
// lamps round the wall, the cornice, and the cracks in the dome with their
// shafts of light.
function dressBoss(o, kit) {
  const { S, Rd, boss, ea, waterAt, roofAt, tri } = o,
    { sink, mulc, BLACK, ribCol, lights, shafts, quad, box, lamp } = kit;
  {
    const R = boss.r,
      ang = (q) => Math.atan2(q.x - boss.x, q.z - boss.z),
      P = (a, r, y) => [boss.x + Math.sin(a) * r, y, boss.z + Math.cos(a) * r];
    // the wall tunnels: brick outlets standing out of the wall, dark inside,
    // water running out over a stone lip
    for (const q of o.wallTunnels) {
      const fx = Math.sin(q.yaw),
        fz = Math.cos(q.yaw),
        a = S.mouthHW,
        th = 0.32,
        y0 = q.y - 0.8,
        ys = y0 + 0.5,
        E = S.mouthOut,
        at = (r, y, e) => [q.x - fz * r + fx * e, y, q.z + fx * r + fz * e],
        IN = [[-a, y0]],
        OUT = [[-a - th, y0 - 0.28]];
      for (let k = 0; k <= 8; k++) {
        const an = PI - (k / 8) * PI;
        IN.push([Math.cos(an) * a, ys + Math.sin(an) * a]);
        OUT.push([Math.cos(an) * (a + th), ys + Math.sin(an) * (a + th)]);
      }
      IN.push([a, y0]);
      OUT.push([a + th, y0 - 0.28]);
      for (let k = 0; k + 1 < IN.length; k++) {
        const [r0, h0] = IN[k],
          [r1, h1] = IN[k + 1],
          [s0, g0] = OUT[k],
          [s1, g1] = OUT[k + 1];
        quad(at(r0, h0, -0.1), at(r1, h1, -0.1), at(r1, h1, E), at(r0, h0, E), mulc(BRICK, 0.1));
        quad(at(s0, g0, -0.5), at(s1, g1, -0.5), at(s1, g1, E), at(s0, g0, E), mulc(BRICK, 0.9), 0, MAT.BRICK);
        quad(at(r0, h0, E), at(r1, h1, E), at(s1, g1, E), at(s0, g0, E), k % 2 ? mulc(SEWER_STONE, 0.82) : SEWER_STONE);
      }
      for (let k = 0; k + 1 < IN.length; k++)
        tri(at(0, ys, 0.05), at(IN[k][0], IN[k][1], 0.05), at(IN[k + 1][0], IN[k + 1][1], 0.05), BLACK);
      tri(at(0, ys, 0.05), at(a, y0, 0.05), at(-a, y0, 0.05), BLACK);
      quad(at(-a, y0 + 0.03, 0.05), at(a, y0 + 0.03, 0.05), at(a, y0 + 0.03, E), at(-a, y0 + 0.03, E), o.wcol, 0, MAT.WATER);
      quad(at(-a - th, y0 - 0.28, E), at(a + th, y0 - 0.28, E), at(a, y0, E), at(-a, y0, E), SEWER_STONE);
      quad(at(-a - th, y0 - 0.28, -0.5), at(a + th, y0 - 0.28, -0.5), at(a + th, y0 - 0.28, E), at(-a - th, y0 - 0.28, E), mulc(BRICK, 0.6), 0, MAT.BRICK);
      // a lamp over it, to light the fall
      lamp(q.x, q.z, q.yaw, ys + a + th + 0.75);
    }
    // pilasters round the wall, clear of the outlets and the entrance, a lamp
    // on every other one
    const N = 20,
      y0 = -sink - 0.1,
      y1 = S.bossWall - 0.35;
    let k = 0;
    for (let i = 0; i < N; i++) {
      const a = ea + ((i + 0.5) / N) * TAU;
      if (Math.abs(angDiff(a, ea)) < 0.22) continue;
      if (o.wallTunnels.some((q) => Math.abs(angDiff(a, ang(q))) < 0.15)) continue;
      const p = P(a, R - 0.12, (y0 + y1) / 2);
      box(p[0], p[1], p[2], a + PI, 0.3, 0.4, (y1 - y0) / 2, ribCol, MAT.BRICK);
      if (k++ % 2 === 0) {
        const f = P(a, R - 0.42, 0);
        lamp(f[0], f[2], a + PI, 3.6);
      }
    }
    // a stone cornice where the walls end and the dome begins
    const M = 72,
      c0 = S.bossWall - 0.4,
      c1 = S.bossWall - 0.1;
    for (let i = 0; i < M; i++) {
      const a0 = (i / M) * TAU,
        a1 = ((i + 1) / M) * TAU;
      quad(P(a0, R - 0.45, c0), P(a1, R - 0.45, c0), P(a1, R + 0.3, c0), P(a0, R + 0.3, c0), mulc(SEWER_STONE, 0.7));
      quad(P(a0, R - 0.45, c0), P(a1, R - 0.45, c0), P(a1, R - 0.45, c1), P(a0, R - 0.45, c1), mulc(SEWER_STONE, 0.9));
    }
    // cracks in the dome over the dry ring, each letting down a shaft of
    // light; the shafts themselves are drawn each frame
    const nS = S.shafts[0] + ((Rd() * (S.shafts[1] - S.shafts[0] + 1)) | 0);
    for (let t = 0; t < 400 && shafts.length < nS; t++) {
      const a = Rd() * TAU,
        d = S.centreR + 2.5 + Rd() * (R - S.moatW - S.centreR - 5),
        x = boss.x + Math.sin(a) * d,
        z = boss.z + Math.cos(a) * d,
        r = 0.9 + Rd() * 0.6;
      if (shafts.some((h) => Math.hypot(h.x - x, h.z - z) < 7)) continue;
      let dry = waterAt(x, z) === 0;
      for (let j = 0; j < 8 && dry; j++)
        dry =
          waterAt(x + Math.sin(j * 0.785) * (r + 0.6), z + Math.cos(j * 0.785) * (r + 0.6)) === 0;
      if (!dry) continue;
      shafts.push({ x, z, r, top: roofAt(x, z) });
      lights.push({ x, y: 2.4, z, c: SEWER_SKY, i: 1.25, r: 11, ph: 0, flick: false });
    }
    for (const h of shafts) {
      const da = Rd() * PI,
        ux = Math.sin(da),
        uz = Math.cos(da),
        pts = [];
      for (let j = 0; j <= 6; j++) {
        const s = (j / 6 - 0.5) * 2.8,
          o2 = (Rd() - 0.5) * 0.5;
        pts.push({ x: h.x + ux * s + uz * o2, z: h.z + uz * s - ux * o2, w: 0.05 + 0.3 * Math.sin((j / 6) * PI) });
      }
      const C = (j, sd, k2, dy) => {
        const q = pts[j];
        return [q.x + uz * sd * q.w * k2, roofAt(q.x, q.z) - dy, q.z - ux * sd * q.w * k2];
      };
      for (let j = 0; j < 6; j++) {
        quad(C(j, -1, 2.4, 0.05), C(j + 1, -1, 2.4, 0.05), C(j + 1, 1, 2.4, 0.05), C(j, 1, 2.4, 0.05), mulc(BRICK, 0.12));
        quad(C(j, -1, 1, 0.09), C(j + 1, -1, 1, 0.09), C(j + 1, 1, 1, 0.09), C(j, 1, 1, 0.09), SEWER_SKY, 1);
      }
    }
  }
}
