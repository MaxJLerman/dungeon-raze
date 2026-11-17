// ---------- characters built from primitives ----------
function makeFigure(o) {
  o = Object.assign(
    {
      sc: 1,
      leg: 0.92,
      w: 0.5,
      th: 0.62,
      d: 0.28,
      hs: 0.3,
      aw: 0.13,
      al: 0.62,
      lw: 0.17,
      headPrim: "sph",
    },
    o,
  );
  const f = { o },
    root = (f.root = new Nd());
  root.s = [o.sc, o.sc, o.sc];
  const hips = (f.hips = root.add(new Nd()));
  hips.p[1] = o.leg;
  const chest = (f.chest = hips.add(new Nd()));
  f.torso = chest.add(part("box", o.body, o.w, o.th, o.d, 0, o.th / 2, 0));
  chest.add(
    part("box", o.trim, o.w * 1.05, o.th * 0.16, o.d * 1.08, 0, o.th * 0.08, 0),
  );
  f.headN = chest.add(new Nd());
  f.headN.p[1] = o.th + o.hs * 0.52;
  f.head = f.headN.add(part(o.headPrim, o.skin, o.hs, o.hs * 1.1, o.hs));
  const arm = (side) => {
    const a = chest.add(new Nd());
    a.p = [side * (o.w / 2 + o.aw * 0.55), o.th * 0.93, 0];
    a.add(part("box", o.limb, o.aw, o.al, o.aw, 0, -o.al / 2, 0));
    const h = a.add(new Nd());
    h.p[1] = -o.al;
    return [a, h];
  };
  [f.armR, f.handR] = arm(-1);
  [f.armL, f.handL] = arm(1);
  const leg = (side) => {
    const l = hips.add(new Nd());
    l.p = [side * o.w * 0.27, 0, 0];
    l.add(part("box", o.legc || o.limb, o.lw, o.leg, o.lw, 0, -o.leg / 2, 0));
    return l;
  };
  f.legR = leg(-1);
  f.legL = leg(1);
  return f;
}
function finishFigure(f) {
  f.meshes = [];
  const rec = (n) => {
    if (n.prim) {
      n.em0 = n.em.slice();
      f.meshes.push(n);
    }
    n.ch.forEach(rec);
  };
  rec(f.root);
  return f;
}
const C_ = (h, m) => hexc(h, m);
function makePlayerFig(id) {
  let f;
  const SKIN = C_(0xd9b99b);
  const cape = (col, w, h) => {
    f.cape = f.chest.add(new Nd());
    f.cape.p = [0, f.o.th * 0.96, -f.o.d / 2 - 0.03];
    f.cape.add(part("box", col, w, h, 0.04, 0, -h / 2, 0));
  };
  if (id === "fighter") {
    f = makeFigure({
      body: C_(0x4a2f2a),
      trim: C_(0xd97a2b),
      skin: SKIN,
      limb: C_(0x5a3a33),
      legc: C_(0x2a2326),
      w: 0.58,
      d: 0.32,
      aw: 0.15,
    });
    f.headN.add(part("box", C_(0x2a1c18), 0.33, 0.12, 0.34, 0, 0.17, -0.02));
    f.chest.add(part("box", C_(0x8a8f99), 0.3, 0.18, 0.4, 0.36, 0.62, 0));
    cape(C_(0x8a2a1c), 0.4, 0.5);
    f.handR.add(part("box", C_(0x2a2c33), 0.07, 0.07, 0.5, 0, -0.03, 0.1));
    f.handR.add(part("box", C_(0x6d727c), 0.34, 0.07, 0.07, 0, -0.03, 0.32));
    const b = f.handR.add(
      part("box", C_(0xc9d2de), 0.06, 0.24, 1.6, 0, -0.03, 1.15),
    );
    b.em = [0.22, 0.09, 0.03];
    f.rim = [0.4, 0.2, 0.1];
    f.tips = [[f.handR, 1.9]];
  } else if (id === "tanker") {
    f = makeFigure({
      body: C_(0x566273),
      trim: C_(0xd9c27a),
      skin: SKIN,
      limb: C_(0x47515f),
      legc: C_(0x2c333d),
      w: 0.64,
      d: 0.36,
      aw: 0.17,
      lw: 0.2,
      headPrim: "box",
      hs: 0.32,
    });
    f.headN.add(part("box", C_(0xd9c27a), 0.06, 0.16, 0.38, 0, 0.2, 0));
    f.headN.add(part("box", C_(0x1a1d22), 0.26, 0.05, 0.04, 0, 0.03, 0.16));
    f.armL.add(part("box", C_(0x8d97a8), 0.1, 0.98, 0.8, 0.15, -0.42, 0.12));
    f.armL.add(part("box", C_(0xd9c27a), 0.05, 0.3, 0.26, 0.2, -0.42, 0.12));
    for (const s of [-1, 1])
      f.chest.add(
        part("box", C_(0x8d97a8), 0.26, 0.16, 0.42, s * 0.4, 0.62, 0),
      );
    cape(C_(0x2f3a4d), 0.5, 0.45);
    f.handR.add(part("box", C_(0x3a3d45), 0.06, 0.06, 0.7, 0, -0.03, 0.3));
    const b = f.handR.add(
      part("box", C_(0xb9c0cc), 0.24, 0.24, 0.24, 0, -0.03, 0.72),
    );
    b.em = [0.12, 0.1, 0.04];
    f.rim = [0.35, 0.32, 0.18];
    f.tips = [[f.handR, 0.72]];
  } else if (id === "mage") {
    f = makeFigure({
      body: C_(0x3a2a5c),
      trim: C_(0xb48cff),
      skin: SKIN,
      limb: C_(0x2f224a),
      legc: C_(0x241a3a),
      w: 0.44,
      th: 0.64,
      aw: 0.11,
    });
    f.headN.add(part("cyl", C_(0x2a1f45), 0.62, 0.04, 0.62, 0, 0.15, 0));
    f.headN.add(part("cone", C_(0x2a1f45), 0.34, 0.6, 0.34, 0, 0.44, -0.03));
    f.hips.add(part("box", C_(0x33254f), 0.5, 0.72, 0.36, 0, -0.34, 0));
    cape(C_(0x4b3580), 0.42, 0.9);
    f.handR.add(part("box", C_(0x6b4a2f), 0.05, 0.05, 1.8, 0, -0.03, 0.45));
    f.orb = f.handR.add(
      part("oct", C_(0xcbb0ff), 0.2, 0.2, 0.2, 0, -0.03, 1.42),
    );
    f.orb.em = [0.5, 0.3, 0.95];
    f.rim = [0.3, 0.18, 0.5];
    f.tips = [[f.handR, 1.42]];
  } else if (id === "ranger") {
    f = makeFigure({
      body: C_(0x2f4a35),
      trim: C_(0xa6d96a),
      skin: SKIN,
      limb: C_(0x3a5a41),
      legc: C_(0x23301f),
    });
    f.headN.add(part("cone", C_(0x263d2b), 0.42, 0.36, 0.44, 0, 0.08, -0.05));
    const q = f.chest.add(
      part("cyl", C_(0x5a3f28), 0.14, 0.55, 0.14, -0.1, 0.42, -0.2),
    );
    q.r[2] = 0.4;
    cape(C_(0x35553c), 0.44, 0.55);
    const b = f.handL.add(
      part("box", C_(0x9a6f3f), 0.04, 0.05, 1.3, 0, -0.03, 0),
    );
    b.em = [0.05, 0.1, 0.03];
    for (const s of [-1, 1])
      f.handL.add(
        part("box", C_(0x9a6f3f), 0.04, 0.16, 0.05, 0, 0.03, s * 0.66),
      );
    f.rim = [0.18, 0.36, 0.16];
    f.tips = [[f.handL, 0.66]];
  } else if (id === "enforcer") {
    // a gunman in a long dark coat and a flat-brimmed hat; no emblem
    f = makeFigure({
      body: C_(0x23232a),
      trim: C_(0x7a1f24),
      skin: SKIN,
      limb: C_(0x2a2a31),
      legc: C_(0x18181d),
      w: 0.54,
      d: 0.3,
    });
    f.headN.add(part("cyl", C_(0x16161a), 0.52, 0.03, 0.52, 0, 0.15, 0));
    f.headN.add(part("cyl", C_(0x16161a), 0.3, 0.16, 0.3, 0, 0.24, 0));
    cape(C_(0x1c1c22), 0.5, 1.05);
    // coat skirts over the hips, split at the front
    for (const sx of [-1, 1])
      f.hips.add(
        part("box", C_(0x1f1f26), 0.25, 0.62, 0.05, sx * 0.13, -0.3, 0.16),
      );
    // a hand's -Y runs along the arm, so a raised arm points the barrel
    // forward and +Z is up
    const gun = (h) => {
      const g = h.add(new Nd());
      g.add(part("box", C_(0x2b2b30), 0.05, 0.07, 0.13, 0, -0.02, -0.07));
      const b = g.add(
        part("box", C_(0x8e939c), 0.05, 0.26, 0.06, 0, -0.14, 0),
      );
      b.em = [0.12, 0.03, 0.04];
      return g;
    };
    f.pistols = [gun(f.handR), gun(f.handL)];
    // shown only while used: the shotgun for the heavy, the rifle to execute
    f.shotgun = f.handR.add(new Nd());
    f.shotgun.add(part("box", C_(0x5a3f28), 0.07, 0.36, 0.1, 0, 0.12, -0.03));
    f.shotgun.add(part("box", C_(0x6d727c), 0.08, 0.62, 0.08, 0, -0.38, 0));
    f.rifle = f.handR.add(new Nd());
    f.rifle.add(part("box", C_(0x3b2c22), 0.07, 0.42, 0.12, 0, 0.14, -0.03));
    f.rifle.add(part("box", C_(0x2b2b30), 0.05, 1.05, 0.05, 0, -0.5, 0));
    f.rifle.add(part("cyl", C_(0x16161a), 0.06, 0.2, 0.06, 0, -0.12, 0.09));
    f.shotgun.vis = f.rifle.vis = false;
    f.rim = [0.4, 0.1, 0.12];
    f.tips = [
      [f.handR, 0.3],
      [f.handL, 0.3],
    ];
  } else {
    f = makeFigure({
      body: C_(0x1d2733),
      trim: C_(0x3ad6e8),
      skin: SKIN,
      limb: C_(0x243242),
      legc: C_(0x161d27),
    });
    f.headN.add(part("cone", C_(0x18222d), 0.44, 0.46, 0.46, 0, 0.1, -0.04));
    cape(C_(0x0f5a66), 0.46, 0.8);
    for (const h of [f.handR, f.handL]) {
      const b = h.add(
        part("box", C_(0xcfe9f2), 0.045, 0.1, 0.62, 0, -0.03, 0.26),
      );
      b.em = [0.05, 0.22, 0.28];
      h.add(part("box", C_(0x2a2f38), 0.07, 0.07, 0.16, 0, -0.03, -0.06));
    }
    f.rim = [0.1, 0.32, 0.4];
    f.tips = [
      [f.handR, 0.5],
      [f.handL, 0.5],
    ];
  }
  return finishFigure(f);
}
function makeEnemyFig(type) {
  let f;
  if (type === "husk") {
    f = makeFigure({
      body: C_(0x55665a),
      trim: C_(0x2f3a33),
      skin: C_(0xb9c2a8),
      limb: C_(0x475449),
      al: 0.82,
      aw: 0.12,
      headPrim: "oct",
      hs: 0.34,
    });
    for (const h of [f.handR, f.handL]) {
      const c = h.add(
        part("cone", C_(0xe6dcc0), 0.13, 0.42, 0.13, 0, -0.16, 0.03),
      );
      c.r[0] = PI;
    }
    f.rim = [0.25, 0.3, 0.12];
    f.eye = [1, 0.75, 0.2];
  } else if (type === "brute") {
    f = makeFigure({
      sc: 1.45,
      body: C_(0x5e4638),
      trim: C_(0x8a8f99),
      skin: C_(0x9a7d68),
      limb: C_(0x4c382d),
      w: 0.8,
      th: 0.7,
      d: 0.46,
      aw: 0.2,
      lw: 0.24,
      hs: 0.3,
      headPrim: "box",
    });
    f.handR.add(part("box", C_(0x3a3d45), 0.16, 0.16, 1.5, 0, -0.04, 0.6));
    f.weapon = f.handR.add(
      part("box", C_(0x6d727c), 0.4, 0.4, 0.44, 0, -0.04, 1.3),
    );
    f.armL.add(part("box", C_(0x767b86), 0.1, 0.86, 0.74, 0.14, -0.42, 0.12));
    f.chest.add(part("box", C_(0x767b86), 0.95, 0.2, 0.52, 0, 0.66, 0));
    f.rim = [0.35, 0.2, 0.1];
    f.eye = [1, 0.4, 0.15];
  } else if (type === "dummy") {
    // a practice post: stake, padded torso, crossbar arms and a sack head
    const wood = C_(0x6b4a2e);
    f = makeFigure({
      leg: 0.95,
      w: 0.46,
      th: 0.66,
      d: 0.32,
      hs: 0.3,
      aw: 0.1,
      al: 0.56,
      body: C_(0xb59a6a),
      trim: C_(0x4d3b27),
      skin: C_(0xc9b58a),
      limb: wood,
    });
    f.legR.vis = f.legL.vis = false;
    f.root.add(part("box", wood, 0.15, 1.05, 0.15, 0, 0.525, 0));
    f.root.add(part("box", wood, 0.9, 0.1, 0.16, 0, 0.05, 0));
    f.root.add(part("box", wood, 0.16, 0.1, 0.9, 0, 0.05, 0));
    f.chest.add(part("oct", C_(0xa8402e), 0.24, 0.24, 0.06, 0, 0.36, 0.17));
    f.rim = [0.3, 0.24, 0.14];
    f.eye = [0, 0, 0];
  } else if (type === "spit") {
    f = makeFigure({
      sc: 0.95,
      body: C_(0x3c3350),
      trim: C_(0x241e33),
      skin: C_(0x8d82a8),
      limb: C_(0x322a45),
      w: 0.36,
      th: 0.72,
      aw: 0.09,
      lw: 0.12,
      hs: 0.26,
      headPrim: "oct",
    });
    f.sac = f.chest.add(
      part("sph", C_(0xff6a3d), 0.46, 0.52, 0.42, 0, 0.36, 0.15),
    );
    f.sac.em = [0.5, 0.12, 0.03];
    f.rim = [0.4, 0.15, 0.3];
    f.eye = [1, 0.35, 0.6];
  } else {
    f = makeFigure({
      sc: 2.15,
      body: C_(0x2b2630),
      trim: C_(0xb03a2a),
      skin: C_(0x1b181f),
      limb: C_(0x3a3440),
      w: 0.72,
      th: 0.82,
      d: 0.42,
      aw: 0.19,
      al: 0.72,
      lw: 0.22,
      hs: 0.3,
      headPrim: "box",
    });
    for (const s of [-1, 1]) {
      const hn = f.headN.add(
        part("cone", C_(0xd8cdb8), 0.1, 0.5, 0.1, s * 0.16, 0.26, 0),
      );
      hn.r[2] = -s * 0.5;
      f.chest.add(part("box", C_(0x4a4452), 0.36, 0.2, 0.5, s * 0.5, 0.82, 0));
    }
    f.handR.add(part("box", C_(0x2a2c33), 0.09, 0.09, 0.5, 0, -0.04, 0.05));
    f.weapon = f.handR.add(
      part("box", C_(0x8c93a3), 0.07, 0.3, 2.3, 0, -0.04, 1.35),
    );
    f.weapon.em = [0.25, 0.04, 0.02];
    f.core = f.chest.add(
      part("oct", C_(0xff4a2a), 0.3, 0.34, 0.16, 0, 0.46, 0.2),
    );
    f.core.em = [0.8, 0.12, 0.05];
    f.cape = f.chest.add(new Nd());
    f.cape.p = [0, 0.8, -0.24];
    f.cape.add(part("box", C_(0x5a1d18), 0.8, 1.3, 0.05, 0, -0.65, 0));
    f.rim = [0.5, 0.12, 0.08];
    f.eye = [1, 0.2, 0.1];
  }
  return finishFigure(f);
}
function poseBase(f, walk, amp, lean) {
  const s = Math.sin(walk) * amp,
    o = f.o;
  f.legR.r[0] = s;
  f.legL.r[0] = -s;
  f.armR.r[0] = -s * 0.6;
  f.armL.r[0] = s * 0.6;
  f.armR.r[1] = f.armL.r[1] = 0;
  f.armR.r[2] = -0.1;
  f.armL.r[2] = 0.1;
  f.hips.p[1] = o.leg + Math.abs(Math.cos(walk)) * amp * 0.05;
  f.hips.r[0] = 0;
  f.chest.r[0] = lean;
  f.chest.r[1] = 0;
  f.chest.r[2] = 0;
  f.headN.r[0] = 0;
  f.root.r[0] = 0;
  f.root.p[1] = 0;
}
const POSE_CH = (f) => [f.armR.r, f.armL.r, f.chest.r, f.legR.r, f.legL.r];
function snapPose(f) {
  return POSE_CH(f)
    .map((a) => a.slice())
    .concat([[f.hips.p[1]]]);
}
function blendPose(f, snap, w) {
  // w=1 keep current, w=0 -> snap
  POSE_CH(f).forEach((a, i) => {
    for (let k = 0; k < 3; k++) a[k] = lerp(snap[i][k], a[k], w);
  });
  f.hips.p[1] = lerp(snap[5][0], f.hips.p[1], w);
}
// enemy attack poses. ph: 'wind'|'act', k in 0..1
function atkPose(f, style, ph, k, hunch) {
  const sk = smooth(k),
    o = f.o;
  if (style === "over") {
    if (ph === "wind") {
      f.armR.r[0] = lerp(-0.3, -2.9, sk);
      f.chest.r[0] = hunch - 0.35 * sk;
    } else {
      f.armR.r[0] = lerp(-2.9, -0.45, k);
      f.chest.r[0] = hunch - 0.35 + 0.95 * k;
    }
  } else if (style === "sweep") {
    f.armR.r[0] = -1.35;
    if (ph === "wind") {
      f.chest.r[1] = -0.95 * sk;
      f.armR.r[1] = -0.8 * sk;
    } else {
      f.chest.r[1] = lerp(-0.95, 1.0, k);
      f.armR.r[1] = lerp(-0.8, 0.9, k);
    }
  } else if (style === "thrust") {
    if (ph === "wind") {
      f.armR.r[0] = lerp(-0.2, 0.9, sk);
      f.chest.r[1] = -0.5 * sk;
      f.chest.r[0] = hunch + 0.2 * sk;
      f.hips.p[1] = o.leg - 0.15 * sk;
    } else {
      f.armR.r[0] = -1.55;
      f.chest.r[0] = hunch + 0.45;
      f.legR.r[0] = -0.7;
      f.legL.r[0] = 0.6;
    }
  } else if (style === "slam") {
    if (ph === "wind") {
      f.armR.r[0] = f.armL.r[0] = lerp(-0.3, -2.9, sk);
      f.hips.p[1] = o.leg - 0.3 * sk;
      f.legR.r[0] = -0.5 * sk;
      f.legL.r[0] = 0.4 * sk;
    } else {
      f.armR.r[0] = f.armL.r[0] = lerp(-2.9, -0.4, k * k);
      f.chest.r[0] = hunch + 0.6 * k * k;
    }
  } else {
    // cast
    if (ph === "wind") {
      f.armR.r[0] = f.armL.r[0] = -2.3 * sk;
      f.chest.r[0] = hunch - 0.3 * sk;
    } else {
      f.armR.r[0] = f.armL.r[0] = -1.5;
      f.chest.r[0] = hunch + 0.3;
    }
  }
}
