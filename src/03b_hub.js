// ---------- base of operations: the hall ----------
// Portal grades, lowest to highest. Difficulty and rewards are not attached
// yet; a grade is only an id, a display name and a colour.
const GRADE_IDS = ["E", "D", "C", "B", "A", "S"];
const GRADES = {};
[0x4de8ff, 0x6dff9a, 0xffe45c, 0xff9a3c, 0xff4a3a, 0xc070ff].forEach(
  (hex, i) => {
    const id = GRADE_IDS[i];
    GRADES[id] = { id, name: id + "-rank gate", col: hexc(hex) };
  },
);
const STONE = hexc(0x8791a6),
  STONE_DARK = hexc(0x1b1e26),
  STONE_TRIM = hexc(0x596275);

// A portal's position is a point on the floor in front of its frame. The wall
// the frame stands against is PORTAL_WALL behind that point, the frame stands
// FRAME_DEPTH out from the wall, the opening sits PORTAL_IN behind the point,
// and a circle of PORTAL_R in the opening takes the player through.
const PORTAL_WALL = 1,
  FRAME_DEPTH = 0.5,
  PORTAL_IN = 0.75,
  PORTAL_R = 1;
// Where the six frames stand: a row along the north wall in rank order, with
// E at +X. An entry is all the hall needs to build, collide, light and label
// a portal, so opening or moving one is a change to this list.
function hubPortals() {
  return GRADE_IDS.map((grade, i) => ({
    x: 11.5 - i * 4.6,
    z: 16,
    yaw: PI,
    grade,
    open: i === 0,
  }));
}
// Plaques on the hall's +X wall, the player's left at the start, one per
// hidden class, between the pillars. A plaque is { id, cls, x, z, yaw }: x, z
// is the middle of its face and yaw faces into the hall. cls null is sealed.
// They sit in the gaps between the pillars (z -9, -1) and braziers (z -5).
const PLAQUE_Y = 1.7;
function hubPlaques() {
  return [
    ["enforcer", "enforcer", -11],
    ["sapper", "sapper", -7],
    ["riftwalker", null, -3],
  ].map(([id, cls, z]) => ({ id, cls, x: 14.85, z, yaw: -PI / 2 }));
}
// The point d metres in front of a plaque.
function plaqueFront(q, d) {
  return portalFront(q, d);
}
// The point d metres in front of a portal, along the way it faces.
function portalFront(q, d) {
  return { x: q.x + Math.sin(q.yaw) * d, z: q.z + Math.cos(q.yaw) * d };
}

// Builds the hall. Returns the same shape genWorld does, so everything that
// reads G.world works here unchanged; cave-only fields are empty.
function genHub(layout = hubPortals()) {
  const HX = 15,
    HZ = 17,
    TOP = 7;
  const minX = -18,
    minZ = -20,
    W = 36,
    H = 40,
    W1 = W + 1;
  const pillars = [],
    braziers = [];
  for (const x of [-12, 12]) {
    for (const z of [-9, -1, 7]) pillars.push({ x, z, r: 1 });
    for (const z of [-5, 3]) braziers.push({ x, z, r: 0.8 });
  }
  const portals = layout.map((q) => ({ ...q }));
  // a portal's own axes: (fx, fz) points out of it into the hall, (ax, az)
  // runs along the wall. local() gives a world point from u along the wall,
  // height y and w behind the portal's position.
  const frameOf = (q) => {
    const fx = Math.sin(q.yaw),
      fz = Math.cos(q.yaw),
      ax = fz,
      az = -fx;
    return {
      fx,
      fz,
      ax,
      az,
      local: (u, y, w) => [q.x + ax * u - fx * w, y, q.z + az * u - fz * w],
    };
  };
  const spawn = { x: 0, z: -10 },
    dummySpot = { x: -5, z: -1, yaw: PI };

  // ---- walkable field: distance to the nearest wall, pillar or brazier ----
  const F = new Float32Array(W1 * (H + 1));
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const x = i + minX,
        z = j + minZ;
      let f = Math.min(HX - Math.abs(x), HZ - Math.abs(z));
      // each frame is a solid block from its front face back into the wall,
      // so nothing can walk into the posts or the sealed brickwork
      for (const q of portals) {
        const o = frameOf(q),
          u = (x - q.x) * o.ax + (z - q.z) * o.az,
          w = -((x - q.x) * o.fx + (z - q.z) * o.fz),
          du = Math.abs(u) - 1.95,
          dw = Math.abs(w - (PORTAL_WALL - FRAME_DEPTH + 1)) - 1;
        f = Math.min(
          f,
          Math.hypot(Math.max(du, 0), Math.max(dw, 0)) +
            Math.min(Math.max(du, dw), 0),
        );
      }
      for (const o of pillars)
        f = Math.min(f, Math.hypot(x - o.x, z - o.z) - o.r);
      for (const o of braziers)
        f = Math.min(f, Math.hypot(x - o.x, z - o.z) - o.r);
      F[j * W1 + i] = Math.max(-3, f);
    }
  const { fieldAt, resolve, los, route, addRock, removeRock, clearRocks } =
    fieldFns(F, minX, minZ, W, H);
  const ceilAt = () => TOP;

  // ---- mesh ----
  const { P, C, tri } = meshSink();
  const sh = (c, m) => [c[0] * m, c[1] * m, c[2] * m];
  const quad = (a, b, c, d, col, glow = 0) => {
    tri(a, b, c, col, glow);
    tri(a, c, d, col, glow);
  };
  // axis-aligned block; the underside is left out
  function box(x0, y0, z0, x1, y1, z1, col) {
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], sh(col, 0.82));
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], sh(col, 0.82));
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], sh(col, 0.7));
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], sh(col, 0.7));
  }
  // n-sided column or bowl between two radii, optionally capped on top
  function prism(x, z, r0, r1, y0, y1, n, col, cap = null, capGlow = 0) {
    for (let i = 0; i < n; i++) {
      const a0 = ((i + 0.5) / n) * TAU,
        a1 = ((i + 1.5) / n) * TAU,
        c0 = Math.cos(a0),
        s0 = Math.sin(a0),
        c1 = Math.cos(a1),
        s1 = Math.sin(a1);
      quad(
        [x + c0 * r0, y0, z + s0 * r0],
        [x + c1 * r0, y0, z + s1 * r0],
        [x + c1 * r1, y1, z + s1 * r1],
        [x + c0 * r1, y1, z + s0 * r1],
        sh(col, 0.78 + 0.22 * (i % 2)),
      );
      if (cap)
        tri(
          [x, y1, z],
          [x + c0 * r1, y1, z + s0 * r1],
          [x + c1 * r1, y1, z + s1 * r1],
          cap,
          capGlow,
        );
    }
  }
  // flat ring on the floor
  function floorRing(x, z, r0, r1, n, col, glow = 0) {
    const y = 0.03;
    for (let i = 0; i < n; i++) {
      const p = (TAU * i) / n,
        q = (TAU * (i + 1)) / n;
      quad(
        [x + Math.cos(p) * r0, y, z + Math.sin(p) * r0],
        [x + Math.cos(q) * r0, y, z + Math.sin(q) * r0],
        [x + Math.cos(q) * r1, y, z + Math.sin(q) * r1],
        [x + Math.cos(p) * r1, y, z + Math.sin(p) * r1],
        sh(col, 0.85 + 0.15 * (i % 2)),
        glow,
      );
    }
  }

  // floor slabs and ceiling panels, two metres square
  for (let z = -HZ - 1; z < HZ + 1; z += 2)
    for (let x = -HX - 1; x < HX + 1; x += 2) {
      const h = hash2(x * 3 + 5, z * 3 + 11),
        fc = sh(STONE, 0.5 + 0.22 * h);
      quad([x, 0, z], [x + 2, 0, z], [x + 2, 0, z + 2], [x, 0, z + 2], fc);
      const cc = sh(STONE, 0.3 + 0.12 * hash2(x + 41, z + 17));
      quad(
        [x, TOP, z],
        [x + 2, TOP, z],
        [x + 2, TOP, z + 2],
        [x, TOP, z + 2],
        cc,
      );
    }
  // walls: a dark plinth, a tall course, a trim band and an upper course
  const ROWS = [
    [0, 0.6, 0.5],
    [0.6, 4.3, 0.8],
    [4.3, 4.7, 0.55],
    [4.7, TOP, 0.68],
  ];
  function wallRun(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az),
      n = Math.round(len / 2);
    for (let i = 0; i < n; i++) {
      const x0 = lerp(ax, bx, i / n),
        z0 = lerp(az, bz, i / n),
        x1 = lerp(ax, bx, (i + 1) / n),
        z1 = lerp(az, bz, (i + 1) / n);
      ROWS.forEach(([y0, y1, m], r) => {
        const h = hash2(Math.round(x0 * 7 + z0 * 13) + r * 31, r * 17 + i);
        quad(
          [x0, y0, z0],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z0],
          sh(STONE, m * (0.9 + 0.2 * h)),
        );
      });
    }
  }
  wallRun(-HX, HZ, HX, HZ);
  wallRun(-HX, -HZ, HX, -HZ);
  wallRun(-HX, -HZ, -HX, HZ);
  wallRun(HX, -HZ, HX, HZ);

  for (const o of pillars) {
    box(o.x - 0.95, 0, o.z - 0.95, o.x + 0.95, 0.5, o.z + 0.95, STONE_TRIM);
    prism(o.x, o.z, 0.8, 0.8, 0.5, TOP - 0.5, 8, sh(STONE, 0.9));
    box(o.x - 0.95, TOP - 0.5, o.z - 0.95, o.x + 0.95, TOP, o.z + 0.95, STONE_TRIM);
  }
  for (const o of braziers) {
    prism(o.x, o.z, 0.42, 0.3, 0, 0.75, 6, STONE_TRIM);
    prism(o.x, o.z, 0.3, 0.68, 0.75, 1.1, 8, sh(STONE_TRIM, 0.8), CRY.amber, 1);
  }

  // portal frames: two posts and a lintel against the wall behind each
  // portal. The open one is left empty for the glowing surface; the rest are
  // bricked up. Everything is placed in the portal's own axes.
  portals.forEach((q, qi) => {
    const g = GRADES[q.grade].col,
      L = frameOf(q).local,
      wf = PORTAL_WALL - FRAME_DEPTH;
    // a block in the portal's axes; the face against the wall is left out
    const block = (u0, y0, w0, u1, y1, col) => {
      const w1 = PORTAL_WALL;
      quad(L(u0, y1, w0), L(u1, y1, w0), L(u1, y1, w1), L(u0, y1, w1), col);
      quad(L(u0, y0, w0), L(u1, y0, w0), L(u1, y1, w0), L(u0, y1, w0), sh(col, 0.82));
      quad(L(u0, y0, w0), L(u0, y0, w1), L(u0, y1, w1), L(u0, y1, w0), sh(col, 0.7));
      quad(L(u1, y0, w0), L(u1, y0, w1), L(u1, y1, w1), L(u1, y1, w0), sh(col, 0.7));
    };
    const panel = (u0, y0, u1, y1, w, col, glow = 0) =>
      quad(L(u0, y0, w), L(u1, y0, w), L(u1, y1, w), L(u0, y1, w), col, glow);
    block(-1.7, 0, wf, -1.2, 3.4, STONE_TRIM);
    block(1.2, 0, wf, 1.7, 3.4, STONE_TRIM);
    block(-1.95, 3.4, wf - 0.1, 1.95, 4.0, sh(STONE_TRIM, 1.15));
    // keystone gem in the grade's colour: lit when open, dull when sealed
    const gw = wf - 0.12;
    quad(
      L(0, 3.95, gw),
      L(0.22, 3.7, gw),
      L(0, 3.45, gw),
      L(-0.22, 3.7, gw),
      q.open ? g : sh(g, 0.12),
      q.open ? 1 : 0,
    );
    // dark recess behind the opening
    panel(-1.2, 0, 1.2, 3.4, PORTAL_WALL - 0.02, STONE_DARK);
    if (!q.open) {
      // sealed: offset courses of dark blocks filling the opening
      const ws = PORTAL_WALL - 0.3;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 4; c++) {
          const off = r % 2 ? 0.4 : 0,
            u0 = clamp(-1.2 + c * 0.8 - off, -1.2, 1.2),
            u1 = clamp(-0.4 + c * 0.8 - off, -1.2, 1.2),
            m = 0.7 + 0.6 * hash2(c * 7 + r * 13 + qi * 29, r * 5 + c);
          if (u1 - u0 < 0.05) continue;
          panel(
            u0 + 0.02,
            r * 0.68 + 0.02,
            u1 - 0.02,
            r * 0.68 + 0.66,
            ws,
            sh(STONE_TRIM, 0.34 * m),
          );
        }
    }
    // half ring on the floor in front of the frame, opening into the hall
    const n = 10,
      rc = q.open ? sh(g, 0.8) : STONE_TRIM;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * PI,
        t1 = ((i + 1) / n) * PI,
        pt = (t, r) => L(Math.cos(t) * r, 0.03, PORTAL_WALL - Math.sin(t) * r);
      quad(
        pt(t0, 1.9),
        pt(t1, 1.9),
        pt(t1, 2.25),
        pt(t0, 2.25),
        sh(rc, 0.85 + 0.15 * (i % 2)),
        q.open ? 0.5 : 0,
      );
    }
  });
  // plaques: a stone slab with a trim and a dark face for the emblem. The
  // glow of an unlocked class is drawn each frame, not baked in here.
  const plaques = hubPlaques();
  for (const q of plaques) {
    const L = frameOf(q).local,
      slab = (u0, y0, u1, y1, w0, col) => {
        const w1 = 0.2;
        quad(L(u0, y1, w0), L(u1, y1, w0), L(u1, y1, w1), L(u0, y1, w1), col);
        quad(L(u0, y0, w0), L(u1, y0, w0), L(u1, y1, w0), L(u0, y1, w0), sh(col, 0.82));
        quad(L(u0, y0, w0), L(u0, y0, w1), L(u0, y1, w1), L(u0, y1, w0), sh(col, 0.7));
        quad(L(u1, y0, w0), L(u1, y0, w1), L(u1, y1, w1), L(u1, y1, w0), sh(col, 0.7));
      };
    slab(-0.62, PLAQUE_Y - 0.78, 0.62, PLAQUE_Y + 0.78, -0.06, STONE_TRIM);
    slab(-0.5, PLAQUE_Y - 0.66, 0.5, PLAQUE_Y + 0.66, -0.1, sh(STONE, 0.75));
    quad(
      L(-0.32, PLAQUE_Y - 0.4, -0.11),
      L(0.32, PLAQUE_Y - 0.4, -0.11),
      L(0.32, PLAQUE_Y + 0.4, -0.11),
      L(-0.32, PLAQUE_Y + 0.4, -0.11),
      STONE_DARK,
    );
  }
  // the training dummy's floor mark
  floorRing(dummySpot.x, dummySpot.z, 1.35, 1.6, 16, STONE_TRIM);

  // ---- lights ----
  const lights = [],
    halos = [];
  braziers.forEach((o, i) => {
    lights.push({ x: o.x, y: 1.8, z: o.z, c: CRY.amber, i: 2.2, r: 17, ph: i * 1.7 });
    halos.push({ x: o.x, y: 1.3, z: o.z, c: CRY.amber, s: 1.5 });
  });
  for (const q of portals)
    if (q.open)
      lights.push({
        x: portalFront(q, 0.4).x,
        y: 2,
        z: portalFront(q, 0.4).z,
        c: GRADES[q.grade].col,
        i: 2.1,
        r: 15,
        ph: 0,
      });
  // one cool wash so the row of sealed frames can be read from the start
  lights.push({ x: -2, y: 4.6, z: 12.5, c: [0.62, 0.72, 0.95], i: 1.7, r: 22, ph: 2 });

  return {
    seed: 0,
    hub: true,
    nodes: [],
    edges: [],
    start: null,
    boss: null,
    path: [],
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
    pos: new Float32Array(P),
    col: new Uint8Array(C),
    lights,
    halos,
    shrines: [],
    spawns: [
      {
        type: "dummy",
        x: dummySpot.x,
        z: dummySpot.z,
        yaw: dummySpot.yaw,
        node: -1,
      },
    ],
    spawn,
    spawnYaw: 0,
    portals,
    plaques,
    dummySpot,
  };
}
