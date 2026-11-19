// ---- bodies and poses for the D gate's enemies ----
// EFIG maps an enemy type to a function that returns its finished figure
// (makeEnemyFig calls it first). EPOSE maps a type to { pose(e) }, which
// replaces poseEnemy's body (the dummy still goes first), or { after(e) },
// called at the end of poseEnemy just before the glow is set.
const EFIG = {};
const EPOSE = {};

// ---- the rat ----
// Built on makeFigure with the chest pitched forward (chest.r[0] near PI/2) so
// the torso lies flat: the arms are forelegs, the legs short hind legs. The
// pitch is posed, never built in, so a rat can rear up on its hind legs.
// headN is pitched back by the same amount in poseRat, so the head's own
// frame stays level (+Z forward) and the eye sprites sit on its face.
// opts (all optional, for the bigger rats built on this body): sc, body, trim,
// skin, limb, feet, rim, eye.
function makeRatFig(opts = {}) {
  const o = Object.assign(
    {
      sc: 1,
      body: C_(0x6b5f55),
      trim: C_(0x4a403a),
      skin: C_(0x7a6b60),
      limb: C_(0x5d5149),
      feet: C_(0xd9b3a6),
      rim: [0.22, 0.2, 0.18],
      eye: [1, 0.3, 0.2],
    },
    opts,
  );
  const f = makeFigure({
    sc: o.sc,
    leg: 0.26,
    w: 0.34,
    th: 0.62,
    d: 0.3,
    hs: 0.26,
    aw: 0.09,
    al: 0.26,
    lw: 0.13,
    body: o.body,
    trim: o.trim,
    skin: o.skin,
    limb: o.limb,
    headPrim: "oct",
  });
  // head: a long wedge facing +Z once headN is counter-pitched
  f.head.s = [0.3, 0.27, 0.4];
  f.head.p = [0, 0, 0.03];
  const snout = f.headN.add(part("cone", o.skin, 0.17, 0.3, 0.17, 0, -0.02, 0.28));
  snout.r[0] = PI / 2;
  f.headN.add(part("sph", C_(0xe0a0a0), 0.09, 0.08, 0.08, 0, -0.03, 0.43));
  for (const s of [-1, 1]) {
    f.headN.add(part("sph", C_(0xd7a9a3), 0.15, 0.19, 0.05, s * 0.13, 0.14, -0.06));
  }
  // a furred, rounded body in place of the box and its trim slab, with the
  // forelegs set in from its tapering front
  f.torso.prim = "sph";
  f.torso.s = [0.4, 0.72, 0.34];
  f.torso.p = [0, 0.3, 0];
  const slab = f.chest.ch.find((n) => n !== f.torso && n.prim === "box");
  if (slab) f.chest.ch.splice(f.chest.ch.indexOf(slab), 1);
  for (const a of [f.armR, f.armL]) {
    a.p[0] = Math.sign(a.p[0]) * 0.17;
    a.p[1] = 0.5;
  }
  // pale feet and claws
  for (const l of [f.legR, f.legL])
    l.add(part("box", o.feet, 0.15, 0.05, 0.26, 0, -0.26, 0.06));
  for (const h of [f.handR, f.handL])
    h.add(part("box", o.feet, 0.12, 0.05, 0.2, 0, -0.01, 0.05));
  // a thin tail off the hips, pointing back when r[0] is about PI/2
  f.tail = f.hips.add(new Nd());
  f.tail.p = [0, 0.02, -0.04];
  f.tail.add(part("cone", C_(0xc99a95), 0.07, 0.8, 0.07, 0, -0.4, 0)).r[0] = PI;
  f.rim = o.rim;
  f.eye = o.eye;
  return finishFigure(f);
}
EFIG.rat = () => makeRatFig({ sc: 1.2 });

// Poses any rat-built figure (the rat, and bigger rats made with makeRatFig).
// Chest pitch near PI/2 is on all fours, near 0 is reared up on the hind legs.
// A rat in water (reading above 0.5, the same line canAttack uses) swims flat
// with its legs paddling and never rears.
function poseRat(e) {
  const f = e.fig,
    d = e.def,
    o = f.o,
    FLAT = 1.52,
    wet = G.world.waterAt(e.x, e.z) > 0.5,
    mv = sat(e.speed / d.speed),
    ph = e.walk * 1.4,
    s = Math.sin(ph) * 0.95 * mv;
  // the pose, then written to the nodes at the end: chest pitch, the world
  // swing of the forelegs and of each hind leg, hip height, head tilt, tail
  let pitch = FLAT + Math.sin(ph * 2) * 0.07 * mv,
    arms = -s,
    legR = s,
    legL = s * 0.85,
    hips = o.leg + Math.abs(Math.cos(ph)) * 0.07 * mv,
    tilt = -0.1 + Math.sin(ph * 2) * 0.05 * mv,
    tail = 1.3 + Math.sin(ph) * 0.12 * mv,
    tailY = Math.sin(ph) * 0.25 * mv,
    armSpread = 0.12,
    tr = 0,
    tg = 0,
    tb = 0,
    roll = 0,
    rootY = 0;
  const flat = (k) => {
    // the stance all the others lean on, at 0 on all fours and 1 reared
    pitch = lerp(FLAT, -0.08, k);
    arms = lerp(-s, -1.55, k);
    legR = lerp(s, 0.1, k);
    legL = lerp(s * 0.85, 0.1, k);
    hips = lerp(hips, o.leg - 0.03, k);
    tilt = lerp(tilt, 0.32, k);
    tail = lerp(tail, 1.12, k);
  };
  if (e.state === "idle") {
    pitch = FLAT - 0.1 + Math.sin(G.t * 1.6 + e.ph) * 0.03;
    tilt = Math.sin(G.t * 5 + e.ph) * 0.18;
    tailY = Math.sin(G.t * 1.3 + e.ph) * 0.3;
  } else if (e.state === "alert" || e.state === "roar") {
    flat(0.55);
    tilt = 0.1;
  }
  const swim = wet && e.state !== "hit" && e.state !== "stagger" && e.state !== "dead" && e.state !== "recoil";
  if (swim) {
    // flat on the surface, nose up a little, all four legs paddling
    const q = G.t * 13 + e.ph;
    pitch = FLAT - 0.3;
    arms = Math.sin(q) * 0.9;
    legR = Math.sin(q + PI) * 0.9;
    legL = Math.sin(q) * 0.9;
    armSpread = 0.7;
    hips = o.leg + 0.16;
    tilt = 0.06 + Math.sin(q * 0.5) * 0.04;
    tail = 1.45;
    tailY = Math.sin(q * 0.5) * 0.35;
  } else if (e.state === "wind") {
    // up on the hind legs: the opening the player reads. Mostly up by the
    // middle of the wind-up so a short one still shows it
    const k = sat(e.t / e.atk.wind);
    flat(smooth(sat(k * 1.7)));
    tr = 0.14 * k;
    tg = 0.09 * k;
    tb = 0.03 * k;
  } else if (e.state === "act" || e.state === "rec") {
    // thrown forward from the rear: nose down, forelegs reaching, hind legs
    // trailing; a pounce also leaves the ground
    const act = e.state === "act",
      k = act ? sat(e.t / e.atk.act) : 1,
      back = act ? 0 : smooth(sat(e.t / e.atk.rec)),
      long = e.atk.lunge > 2;
    pitch = lerp(-0.08, 1.15, k);
    arms = lerp(-1.55, -1.25, k);
    legR = lerp(0.1, 0.85, k);
    legL = lerp(0.1, 0.65, k);
    hips = o.leg + (long ? Math.sin(k * PI) * 0.12 : 0);
    tilt = lerp(0.32, -0.05, k);
    tail = 1.2;
    // and back to all fours
    pitch = lerp(pitch, FLAT, back);
    arms = lerp(arms, 0, back);
    legR = lerp(legR, 0, back);
    legL = lerp(legL, 0, back);
    hips = lerp(hips, o.leg, back);
    tilt = lerp(tilt, -0.1, back);
  } else if (e.state === "hit" || e.state === "recoil") {
    const k = 1 - sat(e.t / 0.32);
    pitch = FLAT - 0.9 * k;
    arms = -0.9 * k;
    legR = legL = 0.3 * k;
    tilt = 0.3 * k;
    tail = 1.3 - 0.3 * k;
  } else if (e.state === "stagger") {
    // sat back on its haunches, forelegs limp, wobbling
    pitch = 0.55 + Math.sin(G.t * 6) * 0.06;
    arms = -0.35;
    armSpread = 0.4;
    legR = -1.0;
    legL = -0.9;
    hips = o.leg * 0.55;
    tilt = 0.5;
    tail = 1.2;
    const pu = 0.5 + 0.5 * Math.sin(G.t * 10);
    tr = 0.5 + 0.3 * pu;
    tg = 0.3 + 0.15 * pu;
  } else if (e.state === "dead") {
    const k = smooth(sat(e.t / 0.35));
    roll = (PI / 2) * k;
    rootY = 0.17 * k - Math.max(0, e.t - 1.4) * 0.9;
    pitch = FLAT;
    arms = -0.6 * k;
    legR = 0.6 * k;
    legL = 0.4 * k;
    hips = o.leg - 0.1 * k;
    tilt = 0.1;
    tail = 1.3;
    armSpread = 0.1;
  }
  f.root.p[0] = e.x;
  f.root.p[1] = e.y + rootY;
  f.root.p[2] = e.z;
  f.root.r[0] = 0;
  f.root.r[1] = e.yaw;
  f.root.r[2] = roll;
  f.hips.p[1] = hips;
  f.hips.r[0] = 0;
  f.chest.r[0] = pitch;
  f.chest.r[1] = f.chest.r[2] = 0;
  // limbs turn through the chest's pitch, so they are given as world swings
  f.armR.r[0] = f.armL.r[0] = arms - pitch;
  f.armR.r[1] = f.armL.r[1] = 0;
  f.armR.r[2] = -armSpread;
  f.armL.r[2] = armSpread;
  f.legR.r[0] = legR;
  f.legL.r[0] = legL;
  f.legR.r[2] = -armSpread * 0.5;
  f.legL.r[2] = armSpread * 0.5;
  f.headN.r[0] = tilt - pitch;
  f.tail.r[0] = tail;
  f.tail.r[1] = tailY;
  setEm(f, tr + e.flash * 0.9, tg + e.flash * 0.85, tb + e.flash * 0.7);
  sinkInWater(f, e.x, e.z);
}
EPOSE.rat = { pose: poseRat };

// ---- the drowned ----
// A waterlogged guard. Built on makeFigure, so poseEnemy poses the body and
// atkPose its attacks (they use the right arm). The left hand holds a round
// manhole cover; EPOSE.drowned.after keeps that arm up, and the cover facing
// forward whatever the chest and arm are doing. A cover disc's axis is its
// local Y, so it is turned a quarter turn about X to face +Z.
function makeDrownedFig() {
  const f = makeFigure({
    sc: 1.1,
    w: 0.6,
    th: 0.66,
    d: 0.34,
    hs: 0.3,
    aw: 0.14,
    al: 0.66,
    body: C_(0x2c3330),
    trim: C_(0x1a1f1d),
    skin: C_(0x7f9582),
    limb: C_(0x3a4640),
    headPrim: "sph",
  });
  // ragged strips of cloth hanging off the belt
  const rag = C_(0x232a27);
  for (let i = -2; i <= 2; i++)
    f.hips.add(part("box", rag, 0.1, 0.34 + (i & 1) * 0.12, 0.04, i * 0.11, -0.02 - ((i & 1) * 0.06 + 0.17) * 0.5, 0.15 - Math.abs(i) * 0.02));
  f.hips.add(part("box", rag, 0.12, 0.4, 0.04, 0.15, -0.2, -0.17));
  // lank weed hair, and a pale, sunken stare
  const weed = C_(0x24372b);
  for (let i = -2; i <= 2; i++)
    f.headN.add(part("box", weed, 0.05, 0.3 + Math.abs(i) * 0.05, 0.05, i * 0.07, -0.08, -0.17)).r[0] = 0.15;
  f.headN.add(part("box", weed, 0.3, 0.07, 0.26, 0, 0.17, -0.02));
  // swollen hands
  for (const h of [f.handR, f.handL]) h.add(part("sph", C_(0x8aa08c), 0.17, 0.17, 0.17, 0, -0.06, 0));
  // the cover on the left hand: a rim of iron round a dished disc, a boss and
  // two cross ribs, in a node that poseDrowned turns to face forward
  const iron = C_(0x6a6e73),
    dark = C_(0x44474c),
    rustc = C_(0x7b6a58);
  f.cover = f.handL.add(new Nd());
  f.cover.add(part("cyl", dark, 0.86, 0.05, 0.86, 0, 0, 0));
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU,
      seg = f.cover.add(part("box", iron, 0.2, 0.1, 0.07, Math.cos(a) * 0.4, 0.03, Math.sin(a) * 0.4));
    seg.r[1] = -a + PI / 2;
  }
  f.cover.add(part("cyl", iron, 0.2, 0.1, 0.2, 0, 0.05, 0));
  f.cover.add(part("box", rustc, 0.6, 0.06, 0.06, 0, 0.04, 0));
  f.cover.add(part("box", rustc, 0.06, 0.06, 0.6, 0, 0.04, 0));
  f.rim = [0.1, 0.18, 0.15];
  f.eye = [0.5, 0.9, 0.8];
  return finishFigure(f);
}
EFIG.drowned = makeDrownedFig;
EPOSE.drowned = {
  after(e) {
    const f = e.fig,
      lowered = e.state === "stagger" || e.state === "dead";
    if (lowered) {
      // the arm hangs limp and the cover dangles at the hand
      f.armL.r[0] = 0.15;
      f.armL.r[2] = 0.3;
      f.cover.p = [0.12, -0.18, 0.04];
      f.cover.r = [0, 0, PI / 2];
      return;
    }
    // held up in front of the chest. Only X turns act on the way down to the
    // hand, so they add: the cover is turned back by what the chest and arm
    // have added, plus a quarter turn, to face +Z.
    const up = -1.3 + Math.sin(G.t * 2 + e.ph) * 0.03,
      tot = f.chest.r[0] + up,
      ca = Math.cos(tot),
      sa = Math.sin(tot),
      // where the centre should sit from the hand, in world axes, turned back
      // into the hand's frame (y' = y cos + z sin; z' = -y sin + z cos)
      wx = -0.34,
      wy = 0.16,
      wz = 0.1;
    f.armL.r[0] = up;
    f.armL.r[2] = 0;
    f.cover.p = [wx, wy * ca + wz * sa, -wy * sa + wz * ca];
    f.cover.r = [PI / 2 - tot, 0, 0];
  },
};

// ---- the brood mother ----
// A bigger rat on the same body, with a pale, swollen belly sac slung under
// the chest. The sac is a chest child that hangs toward +Z, which is down
// while she is on all fours, so it follows her pitch. EPOSE.brood poses her as
// a rat, then lets the sac swell and glow for a moment after she sends a rat out.
function makeBroodFig() {
  const f = makeRatFig({
    sc: 1.9,
    body: C_(0x5a4a44),
    trim: C_(0x3d322e),
    skin: C_(0x8a7468),
    limb: C_(0x4e423c),
    rim: [0.26, 0.2, 0.18],
    eye: [1, 0.55, 0.3],
  });
  f.sac = f.chest.add(part("sph", C_(0xd9bfa6), 0.56, 0.7, 0.56, 0, 0.28, 0.27));
  f.sac.s0 = f.sac.s.slice();
  // darker knots on it (beside the sac, not in it: only a leaf takes a squash)
  f.chest.add(part("sph", C_(0xb48a82), 0.2, 0.2, 0.2, 0.2, 0.22, 0.46));
  f.chest.add(part("sph", C_(0xb48a82), 0.17, 0.17, 0.17, -0.2, 0.4, 0.44));
  return finishFigure(f);
}
EFIG.brood = makeBroodFig;
EPOSE.brood = {
  pose(e) {
    poseRat(e);
    const f = e.fig,
      s = f.sac,
      since = G.t - (e.birthAt === undefined ? -99 : e.birthAt),
      k = sat(1 - since / 0.9),
      slow = 0.5 + 0.5 * Math.sin(G.t * 2.2 + e.ph),
      sw = 1 + 0.05 * slow + 0.22 * k;
    s.s[0] = s.s0[0] * sw;
    s.s[1] = s.s0[1] * sw;
    s.s[2] = s.s0[2] * sw;
    const g = 0.04 + 0.04 * slow + 0.5 * k;
    s.em[0] = s.em0[0] + g;
    s.em[1] = s.em0[1] + g * 0.85;
    s.em[2] = s.em0[2] + g * 0.6;
  },
};

// ---- the bloater ----
// A swollen sac that floats on the water, pale green-grey and veined, with a
// small blind head on its front and stub limbs. The chest origin is the middle
// of the sac, so a uniform scale of the chest swells it about that point. The
// veins are flattened beads set on the ellipsoid: each is turned so that its
// local Z points out of the sac and its long local Y runs along a meridian.
function makeBloaterFig() {
  const f = makeFigure({
    sc: 1,
    leg: 0.3,
    w: 0.9,
    th: 0.8,
    d: 0.9,
    hs: 0.26,
    aw: 0.09,
    al: 0.3,
    lw: 0.1,
    body: C_(0xb3c48a),
    trim: C_(0x5d6b56),
    skin: C_(0xc4cf9a),
    limb: C_(0x8f9f70),
    headPrim: "sph",
  });
  const RX = 0.47,
    RY = 0.4,
    RZ = 0.45;
  const slab = f.chest.ch.find((n) => n !== f.torso && n.prim === "box");
  if (slab) f.chest.ch.splice(f.chest.ch.indexOf(slab), 1);
  f.torso.prim = "sph";
  f.torso.s = [RX * 2, RY * 2, RZ * 2];
  f.torso.p = [0, 0, 0];
  // a blind little head on the front, and stub arms and legs at the sides
  f.headN.p = [0, 0.1, 0.4];
  f.head.s = [0.24, 0.22, 0.24];
  f.armR.p = [-0.46, -0.02, 0.06];
  f.armL.p = [0.46, -0.02, 0.06];
  f.legR.p = [-0.15, -0.3, 0.05];
  f.legL.p = [0.15, -0.3, 0.05];
  // veins: dark, in a ring of meridians with a twist each, and a few blotches
  const vein = C_(0x2c4a2c),
    blot = C_(0x7d8f45);
  const bead = (col, a, el, sx, sy, tw) => {
    const nx = Math.sin(a) * Math.cos(el),
      ny = Math.sin(el),
      nz = Math.cos(a) * Math.cos(el),
      n = chestPart(col, sx, sy, nx * RX * 0.97, ny * RY * 0.97, nz * RZ * 0.97);
    n.r = [-el, a, tw];
  };
  const chestPart = (col, sx, sy, x, y, z) => f.chest.add(part("sph", col, sx, sy, 0.03, x, y, z));
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + 0.3,
      el = ((i * 5) % 7) / 7 * 1.1 - 0.4,
      tw = Math.sin(i * 2.7) * 0.8;
    bead(vein, a, el, 0.07, 0.34 + (i % 3) * 0.1, tw);
    // a branch off it
    bead(vein, a + 0.25, el + 0.2, 0.05, 0.2, tw + 1.1);
  }
  for (let i = 0; i < 6; i++)
    bead(blot, i * 1.05 + 0.5, ((i * 3) % 5) / 5 * 1.2 - 0.5, 0.16 + (i % 2) * 0.06, 0.12, i);
  f.rim = [0.2, 0.28, 0.16];
  f.eye = [0.7, 1, 0.35];
  return finishFigure(f);
}
EFIG.bloater = makeBloaterFig;
// Floats and bobs, and swells and shrinks with a pulse that quickens as its
// hp falls. A wind-up swells it and a bump throws it forward. A death pops it
// (the cloud takes over).
function poseBloater(e) {
  const f = e.fig,
    d = e.def,
    FLOAT = -0.02,
    low = sat(1 - e.hp / d.hp),
    mv = sat(e.speed / d.speed);
  // the pulse phase advances by the frame time at the current rate
  const dt = e.pt === undefined ? 0 : Math.min(0.1, Math.max(0, G.t - e.pt));
  e.pt = G.t;
  e.pph = (e.pph || e.ph || 0) + dt * (2.2 + 7 * low);
  let sw = 1 + (0.035 + 0.05 * low) * Math.sin(e.pph),
    pitch = 0.12 * mv,
    roll = 0,
    tg = 0.06 + 0.04 * low,
    tr = 0.02,
    tb = 0,
    rise = 0,
    arms = 0.25 + Math.sin(G.t * 1.7 + e.ph) * 0.12;
  const bob = Math.sin(G.t * 1.5 + e.ph) * 0.045 + Math.sin(G.t * 2.3 + e.ph * 2) * 0.02;
  switch (e.state) {
    case "wind": {
      const k = sat(e.t / e.atk.wind);
      sw *= 1 + 0.22 * k;
      pitch = -0.35 * k;
      tg += 0.16 * k;
      tr += 0.1 * k;
      arms = 0.25 + 0.7 * k;
      break;
    }
    case "act":
      pitch = 0.55;
      sw *= 1.12;
      tg += 0.2;
      arms = -0.4;
      break;
    case "rec": {
      const k = smooth(sat(e.t / e.atk.rec));
      pitch = lerp(0.4, 0, k);
      sw *= lerp(0.92, 1, k);
      break;
    }
    case "hit":
    case "recoil": {
      const k = 1 - sat(e.t / 0.32);
      sw *= 1 - 0.18 * k;
      roll = 0.3 * k;
      break;
    }
    case "stagger": {
      const pu = 0.5 + 0.5 * Math.sin(G.t * 10);
      roll = Math.sin(G.t * 5) * 0.18;
      sw *= 1 + 0.08 * pu;
      tr = 0.45 + 0.3 * pu;
      tg += 0.3 + 0.15 * pu;
      break;
    }
    case "dead": {
      // a quick swell, a pop, and nothing left but the cloud
      const k = sat(e.t / 0.12);
      sw *= 1 + 0.5 * k;
      tr += 0.8 * k;
      tg += 1.0 * k;
      tb += 0.4 * k;
      if (e.t > 0.12) sw = 0.001;
      break;
    }
  }
  f.root.p[0] = e.x;
  f.root.p[1] = e.y + FLOAT + bob + rise;
  f.root.p[2] = e.z;
  f.root.r[0] = 0;
  f.root.r[1] = e.yaw;
  f.root.r[2] = roll;
  f.hips.p[1] = 0;
  f.chest.r[0] = pitch;
  f.chest.s = [sw, sw, sw];
  f.armR.r[0] = f.armL.r[0] = -0.2;
  f.armR.r[2] = -arms;
  f.armL.r[2] = arms;
  f.legR.r[2] = -0.2;
  f.legL.r[2] = 0.2;
  f.legR.r[0] = f.legL.r[0] = Math.sin(G.t * 2.1 + e.ph) * 0.15;
  f.headN.r[0] = -pitch * 0.5;
  setEm(f, tr + e.flash * 0.7, tg + e.flash * 0.7, tb + e.flash * 0.5);
}
EPOSE.bloater = { pose: poseBloater };
// ---- the eel ----
// A long, low eel of eight tapering segments, each a pivot hung behind the
// last (-Z) so the whole body can wave and arch. Dark olive back, pale belly,
// a low dorsal ridge and glowing spots along the flanks (marked `spot`, which
// poseEel brightens through the shock's glow). The head is the first segment,
// with a lower jaw on a pivot.
const EEL_W = [0.5, 0.56, 0.56, 0.52, 0.45, 0.37, 0.28, 0.17],
  EEL_STEP = 0.5;
function makeEelFig() {
  const back = C_(0x39421f),
    belly = C_(0xbdb98c),
    ridge = C_(0x262d17),
    spotC = C_(0x5aa8a8),
    teeth = C_(0xe8e4cf),
    eyeC = C_(0xe8d36a);
  const f = { o: { sc: 1 }, root: new Nd(), segs: [] };
  let parent = f.root;
  for (let i = 0; i < EEL_W.length; i++) {
    const W = EEL_W[i],
      sg = parent.add(new Nd());
    sg.p = [0, 0, i ? -EEL_STEP : 0];
    sg.add(part("sph", back, W, W * 0.8, 0.8, 0, 0, 0));
    sg.add(part("sph", belly, W * 0.8, W * 0.46, 0.72, 0, -W * 0.22, 0));
    if (i > 0 && i < 7) sg.add(part("box", ridge, 0.04, 0.12, 0.56, 0, W * 0.4 + 0.02, 0));
    if (i > 0)
      for (const s of [-1, 1]) {
        const sp = sg.add(part("sph", spotC, 0.1, 0.1, 0.1, s * W * 0.44, W * 0.05, 0.08));
        sp.em = [0.04, 0.22, 0.26];
        sp.spot = true;
      }
    f.segs.push(sg);
    parent = sg;
  }
  // head: a blunt upper jaw, a lower jaw that hinges, teeth and two eyes
  const hd = f.segs[0];
  hd.add(part("sph", back, 0.4, 0.24, 0.5, 0, -0.01, 0.36));
  f.jaw = hd.add(new Nd());
  f.jaw.p = [0, -0.1, 0.12];
  f.jaw.add(part("sph", belly, 0.32, 0.1, 0.52, 0, -0.01, 0.26));
  for (const z of [0.22, 0.4, 0.58])
    for (const s of [-1, 1]) {
      f.jaw.add(part("cone", teeth, 0.04, 0.1, 0.04, s * 0.12, 0.05, z - 0.1));
      const t = hd.add(part("cone", teeth, 0.04, 0.1, 0.04, s * 0.12, -0.1, z + 0.12));
      t.r[0] = PI;
    }
  for (const s of [-1, 1]) {
    const eye = hd.add(part("sph", eyeC, 0.07, 0.07, 0.07, s * 0.19, 0.1, 0.34));
    eye.em = [0.7, 0.55, 0.1];
  }
  // marker nodes for the shared effects: headN puts the eye glints on the
  // eyes (it is stretched across the head), weapon is the mouth, where a
  // wind-up gathers
  f.headN = hd.add(new Nd());
  f.headN.p = [0, 0.1, 0.2];
  f.headN.s = [2.6, 1, 1];
  f.weapon = f.jaw.add(new Nd());
  f.weapon.p = [0, 0.05, 0.5];
  f.rim = [0.14, 0.2, 0.14];
  f.eye = [0.5, 0.95, 0.95];
  return finishFigure(f);
}
EFIG.eel = makeEelFig;
// Under the water it lies low (its ridge breaks the surface), waving gently;
// it rises to bite, to flinch and to glow. The travelling wave runs down the
// body and widens toward the tail. A bite rears the head back and strikes
// forward with the jaw open. Spots brighten through the shock's glow.
function poseEel(e) {
  const f = e.fig,
    mv = sat(e.speed / e.def.speed),
    dt = e.pt === undefined ? 0 : Math.min(0.1, Math.max(0, G.t - e.pt));
  e.pt = G.t;
  // 0 under, 1 surfaced: quick up, slow down
  let up = e.glowT > 0 ? 1 : 0,
    rear = 0,
    jaw = 0,
    amp = 0.35 + 0.8 * mv,
    rate = 3.5 + 4 * mv,
    roll = 0,
    tr = 0;
  switch (e.state) {
    case "wind": {
      const k = smooth(sat(e.t / e.atk.wind));
      up = 1;
      rear = -0.6 * k;
      jaw = 0.9 * k;
      amp *= 1 - 0.6 * k;
      break;
    }
    case "act": {
      const k = sat(e.t / e.atk.act);
      up = 1;
      rear = lerp(-0.6, 0.4, k);
      jaw = 0.9;
      amp *= 0.3;
      break;
    }
    case "rec": {
      const k = smooth(sat(e.t / e.atk.rec));
      up = 1;
      rear = lerp(0.4, 0, k);
      jaw = 0.9 * (1 - k);
      break;
    }
    case "hit":
    case "recoil": {
      const k = 1 - sat(e.t / 0.32);
      up = 1;
      rear = -0.35 * k;
      roll = 0.4 * k;
      amp += 0.8 * k;
      rate += 6 * k;
      jaw = 0.5 * k;
      break;
    }
    case "stagger": {
      const pu = 0.5 + 0.5 * Math.sin(G.t * 10);
      up = 1;
      rear = -0.25 + 0.15 * pu;
      roll = Math.sin(G.t * 6) * 0.35;
      amp = 1.1;
      rate = 9;
      jaw = 0.6;
      tr = 0.25 + 0.3 * pu;
      break;
    }
    case "dead": {
      // turns belly up and floats
      up = 0.8;
      roll = PI * sat(e.t / 0.6);
      amp = 0.15 * (1 - sat(e.t / 1.2));
      jaw = 0.5;
      break;
    }
  }
  // the first pose finds it at rest where it is (a frame drawn with no time passed too)
  e.surf = e.surf === undefined ? up : damp(e.surf, up, up > e.surf ? 14 : 3.5, dt);
  e.wph = (e.wph || e.ph || 0) + dt * rate;
  f.root.p[0] = e.x;
  f.root.p[1] = e.y - 0.3 + 0.38 * e.surf + Math.sin(G.t * 1.3 + e.ph) * 0.02;
  f.root.p[2] = e.z;
  f.root.r[0] = 0;
  f.root.r[1] = e.yaw;
  f.root.r[2] = roll;
  // the head's pitch and a counter-pitch behind it that levels the body again
  const n = f.segs.length;
  for (let i = 0; i < n; i++) {
    const s = f.segs[i];
    s.r[0] = i === 0 ? rear : i < 4 ? -rear * [0, 0.5, 0.3, 0.2][i] : 0;
    s.r[1] = (i === 0 ? 0.6 : 0.5 + i * 0.25) * amp * 0.3 * Math.sin(e.wph - i * 0.85);
  }
  f.jaw.r[0] = jaw;
  // glow in the spots, the hit flash and a stagger's red over everything
  const g = e.glowT > 0 ? (0.4 + 1.4 * sat(1 - e.glowT / EEL.glow)) * (0.75 + 0.25 * Math.sin(G.t * 30)) : 0,
    fl = e.flash * 0.6;
  for (const m of f.meshes) {
    const s = m.spot ? g : 0;
    m.em[0] = m.em0[0] + fl + tr + s * 0.5;
    m.em[1] = m.em0[1] + fl + s * 1.1;
    m.em[2] = m.em0[2] + fl + s * 1.3;
  }
}
EPOSE.eel = { pose: poseEel };
// ---- the siren ----
// A woman's upper body on makeFigure (chest, arms, head), with long dark hair
// hung off the back of the head as boxes and a band of weed across the chest.
// Her legs are gone: the hips carry a scaled tail of seven tapering segments,
// each a pivot hung behind the last (-Z), ending in a two-lobed fluke. She is
// posed by poseSiren in world heights (the water's surface is at -WATER.sink),
// so only the chest and head show when she waits and the tail runs back just
// under the surface, its fin and fluke breaking it.
const SIREN_SC = 1.3,
  SIREN_TW = [0.46, 0.42, 0.36, 0.3, 0.23, 0.16],
  SIREN_TL = 0.3;
function makeSirenFig() {
  const skin = C_(0xa7baa8),
    scale = C_(0x3a7a6e),
    dark = C_(0x1f4741),
    belly = C_(0xa9c2a4),
    fin = C_(0x6fb3a3),
    hair = C_(0x18201d),
    weed = C_(0x2a3b27),
    claw = C_(0xd8e0cc);
  const f = makeFigure({
    sc: SIREN_SC,
    leg: 0,
    w: 0.44,
    th: 0.62,
    d: 0.26,
    hs: 0.3,
    aw: 0.095,
    al: 0.64,
    lw: 0.1,
    body: skin,
    trim: scale,
    skin,
    limb: skin,
    headPrim: "sph",
  });
  // no legs: the leg pivots stay, empty, so nothing that names them breaks
  for (const l of [f.legR, f.legL]) l.ch.length = 0;
  // a narrower waist under the ribs, rounded shoulders, and the weed band
  f.torso.s = [0.4, 0.62, 0.25];
  f.chest.add(part("box", skin, 0.48, 0.22, 0.27, 0, 0.49, 0));
  f.chest.add(part("box", weed, 0.49, 0.12, 0.28, 0, 0.42, 0.005));
  f.chest.add(part("box", weed, 0.06, 0.26, 0.02, 0.12, 0.53, 0.14)).r[2] = -0.5;
  for (const s of [-1, 1]) f.chest.add(part("sph", skin, 0.16, 0.15, 0.16, s * 0.26, 0.58, 0));
  // scales creep up from the hips to the ribs, in staggered rows
  for (let row = 0; row < 4; row++)
    for (let i = -3; i <= 3; i++) {
      if ((i + row) & 1 || Math.abs(i) > 3 - row * 0.7) continue;
      const sc = f.chest.add(part("sph", row ? scale : dark, 0.07, 0.05, 0.02, i * 0.06, 0.04 + row * 0.055, 0.126));
      sc.r[2] = 0.785;
    }
  // the hips: a scaled bulge where the body becomes the tail
  f.hips.add(part("sph", scale, 0.42, 0.3, 0.32, 0, 0.02, -0.03));
  // the head: a narrow jaw, pale lips, hair over the crown and down the back
  f.head.s = [0.27, 0.32, 0.28];
  f.headN.add(part("sph", skin, 0.18, 0.13, 0.16, 0, -0.11, 0.04));
  f.headN.add(part("box", C_(0x6f8a80), 0.07, 0.02, 0.02, 0, -0.1, 0.13));
  // hair: a cap over the crown and the back of the head, not the face
  f.headN.add(part("box", hair, 0.3, 0.09, 0.27, 0, 0.14, -0.03));
  f.headN.add(part("box", hair, 0.3, 0.26, 0.08, 0, 0.03, -0.13));
  f.hair = [];
  for (let i = -3; i <= 3; i++) {
    const L = 0.62 + (3 - Math.abs(i)) * 0.06 + (i & 1) * 0.05,
      st = f.headN.add(new Nd());
    st.p = [i * 0.04, 0.08, -0.12 - (3 - Math.abs(i)) * 0.005];
    st.add(part("box", hair, 0.065, L, 0.045, 0, -L / 2, 0));
    st.r0 = [0.12, 0, i * 0.04];
    f.hair.push(st);
  }
  // locks framing the face, over the shoulders
  for (const s of [-1, 1]) {
    const st = f.headN.add(new Nd());
    st.p = [s * 0.12, 0.05, 0.02];
    st.add(part("box", hair, 0.05, 0.48, 0.045, 0, -0.24, 0));
    st.r0 = [-0.05, 0, s * 0.12];
    f.hair.push(st);
  }
  // webbed, clawed hands and a fin down each forearm
  for (const h of [f.handR, f.handL]) {
    h.add(part("box", skin, 0.11, 0.12, 0.05, 0, -0.04, 0));
    for (const x of [-0.035, 0, 0.035])
      h.add(part("cone", claw, 0.025, 0.1, 0.025, x, -0.14, 0.01)).r[0] = PI;
  }
  for (const a of [f.armR, f.armL]) {
    const fn = a.add(part("box", fin, 0.015, 0.26, 0.09, 0, -0.42, -0.07));
    fn.em = [0.02, 0.07, 0.06];
  }
  // the tail
  f.tail = [];
  let parent = f.hips;
  for (let i = 0; i < SIREN_TW.length; i++) {
    const W = SIREN_TW[i],
      sg = parent.add(new Nd());
    sg.p = i ? [0, 0, -SIREN_TL] : [0, -0.04, -0.1];
    sg.add(part("sph", scale, W, W * 0.75, SIREN_TL * 1.5, 0, 0, -SIREN_TL * 0.45)).em = [0.01, 0.04, 0.035];
    sg.add(part("sph", belly, W * 0.75, W * 0.4, SIREN_TL * 1.3, 0, -W * 0.2, -SIREN_TL * 0.45));
    // a pair of dark scale plates on the back and a low fin along it
    for (const s of [-1, 1]) {
      const pl = sg.add(part("sph", dark, W * 0.36, 0.03, SIREN_TL * 0.5, s * W * 0.2, W * 0.33, -SIREN_TL * (0.3 + 0.3 * (s > 0))));
      pl.r[2] = s * 0.35;
    }
    if (i > 0 && i < SIREN_TW.length - 1) {
      const fn = sg.add(part("box", fin, 0.02, 0.05 + W * 0.15, SIREN_TL * 0.9, 0, W * 0.36, -SIREN_TL * 0.45));
      fn.em = [0.02, 0.07, 0.06];
    }
    f.tail.push(sg);
    parent = sg;
  }
  // the fluke: two broad lobes swept back and out, on a pivot of their own
  f.fluke = parent.add(new Nd());
  f.fluke.p = [0, 0, -SIREN_TL * 0.9];
  for (const s of [-1, 1]) {
    const lobe = f.fluke.add(part("sph", fin, 0.5, 0.05, 0.3, s * 0.2, 0, -0.18));
    lobe.r[1] = s * 0.55;
    lobe.em = [0.03, 0.1, 0.09];
  }
  f.rim = [0.16, 0.26, 0.23];
  f.eye = [0.55, 1, 0.9];
  return finishFigure(f);
}
EFIG.siren = makeSirenFig;
// World heights of her hips: low in the water while she waits, risen to the
// waist (at the surface) for the lunge and the song.
const SIREN_LOW = -0.58,
  SIREN_UP = -0.32;
// The pose, in world heights (divided by SIREN_SC for the hips). The tail's
// first three segments climb (or dip) from the hips to just under the surface
// and the rest run along it with a travelling sway, the fluke lifting out.
function poseSiren(e) {
  const f = e.fig,
    d = e.def,
    sc = SIREN_SC,
    WL = -WATER.sink,
    mv = sat(e.speed / d.speed),
    dt = e.pt === undefined ? 0 : Math.min(0.1, Math.max(0, G.t - e.pt));
  e.pt = G.t;
  const bob = Math.sin(G.t * 1.4 + e.ph) * 0.03;
  let hip = SIREN_LOW + bob,
    lean = 0.08 + 0.3 * mv,
    armX = -0.45 + Math.sin(G.t * 1.1 + e.ph) * 0.1 + 0.6 * mv,
    armZ = 0.75 - 0.4 * mv,
    armY = 0,
    head = -0.05,
    headY = 0,
    surge = 0,
    amp = 0.25 + 0.35 * mv,
    rate = 2.2 + 3 * mv,
    tr = 0,
    tg = 0,
    tb = 0,
    roll = 0;
  switch (e.state) {
    case "wind": {
      const k = smooth(sat(e.t / e.atk.wind));
      hip = lerp(SIREN_LOW, SIREN_UP, k) + bob * (1 - k);
      if (e.atk.kind === "song") {
        // rising with her arms opening and her face lifted
        lean = lerp(lean, -0.12, k);
        armX = lerp(armX, -0.75, k);
        armZ = lerp(armZ, 1.25, k);
        head = -0.3 * k;
      } else {
        // coiled back with both arms drawn behind her
        lean = lerp(lean, -0.4, k);
        armX = lerp(armX, 1.0, k);
        armZ = lerp(armZ, 0.35, k);
        head = 0.12 * k;
        amp = 0.25 + 0.6 * k;
        rate = 2.2 + 5 * k;
      }
      break;
    }
    case "act": {
      if (e.atk.kind === "song") {
        // singing: arms wide and beckoning, face up, swaying
        const w = Math.sin(G.t * 3 + e.ph);
        hip = SIREN_UP + Math.sin(G.t * 2.2) * 0.02;
        lean = -0.12;
        armX = -0.85 + w * 0.2;
        armZ = 1.25 + w * 0.12;
        armY = 0.3;
        head = -0.3;
        headY = Math.sin(G.t * 1.6 + e.ph) * 0.18;
        tb = 0.06;
        tg = 0.05;
      } else {
        // thrown forward from the water, reaching
        const k = sat(e.t / e.atk.act);
        hip = SIREN_UP + 0.08 * Math.sin(k * PI);
        lean = lerp(-0.4, 0.85, smooth(sat(k * 2)));
        armX = lerp(1.0, -1.7, smooth(sat(k * 2.2)));
        armZ = 0.18;
        head = -0.2;
        surge = Math.sin(k * PI * 0.5) * 0.9;
        amp = 0.9;
        rate = 9;
      }
      break;
    }
    case "hold": {
      // leaning back into the drag with both hands on the player
      hip = SIREN_UP - 0.04;
      lean = -0.3 + Math.sin(G.t * 9) * 0.04;
      armX = -1.6;
      armZ = 0.22;
      head = 0.1;
      amp = 1.1;
      rate = 10;
      break;
    }
    case "rec": {
      const k = smooth(sat(e.t / e.atk.rec)),
        song = e.atk.kind === "song";
      hip = lerp(SIREN_UP, SIREN_LOW, k) + bob * k;
      lean = lerp(song ? -0.12 : 0.6, lean, k);
      armX = lerp(song ? -0.85 : -1.2, armX, k);
      armZ = lerp(song ? 1.25 : 0.25, armZ, k);
      head = lerp(song ? -0.3 : 0, head, k);
      break;
    }
    case "hit":
    case "recoil": {
      const k = 1 - sat(e.t / 0.32);
      lean = lerp(lean, -0.45, k);
      armX = lerp(armX, 0.6, k);
      roll = 0.15 * k;
      head = 0.25 * k;
      break;
    }
    case "stagger": {
      // up and reeling, slumped forward over the water: open to an execution
      const pu = 0.5 + 0.5 * Math.sin(G.t * 10);
      hip = SIREN_UP - 0.06;
      lean = 0.55 + Math.sin(G.t * 5) * 0.05;
      armX = 0.1;
      armZ = 0.35;
      head = 0.45;
      roll = Math.sin(G.t * 4) * 0.08;
      amp = 0.5;
      tr = 0.45 + 0.3 * pu;
      tg = 0.25 + 0.15 * pu;
      break;
    }
    case "dead": {
      // she falls back and sinks out of sight
      const k = smooth(sat(e.t / 0.5));
      hip = lerp(SIREN_LOW + 0.1, SIREN_LOW, k) - Math.max(0, e.t - 0.4) * 0.6;
      lean = -0.9 * k;
      armX = -1.2 * k;
      armZ = 1.0;
      head = -0.4 * k;
      amp = 0.25 * (1 - sat(e.t / 1.5));
      break;
    }
  }
  e.wph = (e.wph || e.ph || 0) + dt * rate;
  const fx = Math.sin(e.yaw),
    fz = Math.cos(e.yaw);
  f.root.p[0] = e.x + fx * surge;
  f.root.p[1] = e.y;
  f.root.p[2] = e.z + fz * surge;
  f.root.r[0] = 0;
  f.root.r[1] = e.yaw;
  f.root.r[2] = roll;
  f.hips.p[1] = hip / sc;
  f.hips.r[0] = f.hips.r[1] = f.hips.r[2] = 0;
  f.chest.r[0] = lean;
  f.chest.r[1] = Math.sin(e.wph * 0.5) * 0.06 * amp;
  f.chest.r[2] = 0;
  // armX is the arms' swing in the world: turned back by the chest's lean
  f.armR.r[0] = armX - lean;
  f.armL.r[0] = armX - lean + (e.state === "act" && e.atk.kind === "song" ? 0.25 * Math.sin(G.t * 3 + e.ph + 1.5) : 0);
  f.armR.r[1] = armY;
  f.armL.r[1] = -armY;
  f.armR.r[2] = -armZ;
  f.armL.r[2] = armZ;
  f.headN.r[0] = head - lean * 0.6;
  f.headN.r[1] = headY;
  f.headN.r[2] = 0;
  // hair hangs: it is turned back by the head's and the chest's pitch
  const hang = -(head - lean * 0.6) - lean;
  for (const h of f.hair) {
    h.r[0] = h.r0[0] + hang * 0.85 + Math.sin(G.t * 1.7 + h.p[0] * 9) * 0.03;
    h.r[1] = h.r0[1];
    h.r[2] = h.r0[2];
  }
  // the tail: climb to the surface over three segments, then run level along it
  const n = f.tail.length,
    centre = WL + 0.02,
    rise = (centre - hip) / (3 * SIREN_TL * sc),
    climb = Math.asin(clamp(rise, -0.9, 0.9));
  for (let i = 0; i < n; i++) {
    const s = f.tail[i],
      sway = amp * (0.12 + i * 0.07) * Math.sin(e.wph - i * 0.75);
    s.r[0] = i === 0 ? climb : i === 3 ? -climb + 0.04 : i === 5 ? 0.15 : 0;
    s.r[1] = sway;
    s.r[2] = 0;
  }
  f.fluke.r[0] = 0.45 + 0.2 * Math.sin(e.wph * 0.8 + 1);
  f.fluke.r[1] = amp * 0.4 * Math.sin(e.wph - n * 0.75);
  setEm(f, tr + e.flash * 0.8, tg + e.flash * 0.85, tb + e.flash * 0.75);
}
EPOSE.siren = { pose: poseSiren };
