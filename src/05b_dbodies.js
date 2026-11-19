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
