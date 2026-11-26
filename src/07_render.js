// ---------- posing + scene rendering ----------
function setEm(f, r, g, b) {
  for (const n of f.meshes) {
    n.em[0] = n.em0[0] + r;
    n.em[1] = n.em0[1] + g;
    n.em[2] = n.em0[2] + b;
  }
}
// Drawing only: a body in water stands WATER.sink lower, in step with how
// wet the spot under it is. Nothing else reads it.
function sinkInWater(f, x, z) {
  f.root.p[1] -= WATER.sink * sat(G.world.waterAt(x, z));
}
// Ripples round the feet of whatever walks in water: one ring a stride, from
// the foot that has just come down.
function drawWading(x, z, yaw, walk, speed, y) {
  if (speed < 0.8 || y > 0.3 || G.world.waterAt(x, z) < 0.5) return;
  const s = walk / PI,
    k = s - Math.floor(s),
    side = Math.floor(s) % 2 ? 1 : -1,
    r = 0.12 + 0.5 * k;
  R.ring(
    x - Math.cos(yaw) * side * 0.12,
    -WATER.sink + 0.03,
    z + Math.sin(yaw) * side * 0.12,
    r - 0.05,
    r,
    0.55,
    0.85,
    0.8,
    0.55 * (1 - k),
  );
}
function posePlayer(p) {
  const f = p.fig,
    o = f.o,
    mv = Math.min(1, p.speed / 8),
    id = p.clsId;
  poseBase(f, p.walk, 0.8 * mv, 0.06 + mv * 0.24);
  f.root.p[0] = p.x;
  f.root.p[2] = p.z;
  f.root.r[1] = p.yaw;
  // hidden while the camera is up close to a plaque
  f.root.vis =
    !(G.insp && G.insp.k > 0.4) &&
    !(p.state === "blink" && p.t < 0.12) &&
    !(p.state === "dodge" && p.cls.dodge.warp);
  f.cape.r[0] = 0.12 + mv * 0.95 + Math.sin(G.t * 7) * 0.06 * mv;
  const bz = p.buff === "berserk" ? 0.35 : 0,
    ft = p.buff === "fortress" ? 0.09 : 0;
  setEm(
    f,
    p.flash * 0.9 + bz + ft,
    p.flash * 0.15 + bz * 0.25 + ft * 0.8,
    p.flash * 0.1 + ft * 0.3,
  );
  const A = f.armR.r,
    B = f.armL.r,
    ch = f.chest.r;
  if (id === "tanker") {
    B[0] = -0.95;
    B[2] = -0.2;
  } else if (id === "mage") A[0] = -0.75 - mv * 0.1;
  else if (id === "ranger") B[0] = -0.5;
  else if (id === "fighter") A[0] = -0.4;
  else if (id === "sapper") {
    // the hammer carried low across the body in both hands
    A[0] = -0.5;
    B[0] = -0.75;
    B[2] = -0.35;
  } else if (id === "riftwalker") {
    // blade low and ready, the device arm half raised
    A[0] = -0.45;
    B[0] = -0.7;
    B[2] = -0.2;
  } else if (id === "enforcer") {
    // pistols held low and ready; the long guns only while used
    A[0] = B[0] = -0.35;
    const heavy = p.state === "attack" && p.move === "eshot",
      exec = p.state === "execute";
    f.shotgun.vis = heavy;
    f.rifle.vis = exec;
    f.pistols[0].vis = !heavy && !exec;
  }
  if (p.throwT > 0) {
    A[0] = -1.6;
    ch[1] = 0.4;
    if (id === "mage") B[0] = -1.6;
  }
  switch (p.state) {
    case "attack": {
      const m = MOVES[p.move],
        t = p.t;
      let s;
      if (t < m.wind) s = -smooth(t / m.wind);
      else if (t < m.wind + m.act) s = -1 + 2 * ((t - m.wind) / m.act);
      else s = 1 - 0.7 * smooth((t - m.wind - m.act) / m.rec);
      const u = (s + 1) / 2,
        an = m.anim;
      if (!m.proj) {
        f.legR.r[0] = -0.5;
        f.legL.r[0] = 0.45;
        f.hips.p[1] = o.leg - 0.1;
      }
      if (an === "r" || an === "rb") {
        const q = an === "r" ? s : -s;
        ch[1] = q * 0.8;
        ch[0] = 0.28;
        A[0] = -1.45;
        A[1] = q * 0.9;
        A[2] = 0.1;
        if (id !== "tanker") B[0] = 0.55;
      } else if (an === "l") {
        ch[1] = -s * 0.8;
        ch[0] = 0.28;
        B[0] = -1.45;
        B[1] = -s * 0.9;
        B[2] = -0.1;
        A[0] = 0.55;
      } else if (an === "x") {
        ch[0] = 0.12 + 0.3 * u;
        A[0] = B[0] = -1.5 + 0.25 * s;
        A[2] = lerp(-1.0, 0.75, u);
        B[2] = -A[2];
      } else if (an === "gr" || an === "gl") {
        const q = an === "gr" ? s : -s;
        ch[1] = q * 0.95;
        ch[0] = 0.3;
        A[0] = -1.4;
        A[1] = q * 0.9;
        B[0] = -1.3;
        B[1] = q * 0.9 - 0.5;
        B[2] = -0.45;
        f.hips.p[1] = o.leg - 0.16;
      } else if (an === "gover" || an === "over") {
        A[0] = lerp(-2.9, -0.5, u);
        ch[0] = lerp(-0.3, 0.6, u);
        if (an === "gover") {
          B[0] = A[0];
          B[2] = -0.4;
        }
        f.hips.p[1] = o.leg - 0.16 * u;
      } else if (an === "spin") {
        const ap = sat((t - m.wind) / m.act);
        f.root.r[1] =
          p.yaw +
          (t < m.wind ? -0.7 * smooth(t / m.wind) : ap * TAU - 0.7 * (1 - ap));
        A[0] = B[0] = -0.25;
        A[2] = -1.45;
        B[2] = id === "fighter" ? -0.3 : 1.45;
        if (id === "fighter") {
          A[0] = -1.3;
          B[0] = -1.2;
          A[1] = -1.2;
          B[1] = -1.5;
          A[2] = 0;
        }
        f.hips.p[1] = o.leg - 0.18;
        ch[0] = 0.2;
      } else if (an === "hslam") {
        // both hands raise the hammer high, then drive it into the floor
        A[0] = B[0] = lerp(-3.0, -0.55, u);
        B[2] = -0.35;
        ch[0] = lerp(-0.35, 0.75, u);
        f.hips.p[1] = o.leg - 0.22 * u;
        f.legR.r[0] = -0.7 * u;
        f.legL.r[0] = 0.5 * u;
      } else if (an === "bash") {
        B[0] = lerp(-0.7, -1.55, u);
        B[2] = lerp(-0.2, -0.55, u);
        ch[1] = lerp(0.5, -0.55, u);
        ch[0] = 0.35 * u;
        f.legL.r[0] = -0.8 * u;
        f.legR.r[0] = 0.6 * u;
      } else if (an === "cast") {
        A[0] = lerp(-0.3, -1.4, u);
        ch[1] = lerp(-0.5, 0.3, u);
        ch[0] = 0.15;
      } else if (an === "castup") {
        A[0] = B[0] = lerp(-2.8, -1.3, u);
        ch[0] = lerp(-0.3, 0.35, u);
      } else if (an === "pistol" || an === "pistolL" || an === "pistol2") {
        // one arm up and firing, the other at the ready; both for the last
        const kick = t > m.wind ? 0.25 * (1 - u) : 0;
        if (an !== "pistolL") A[0] = -1.5 - kick;
        if (an !== "pistol") B[0] = -1.5 - kick;
        ch[1] = an === "pistol" ? 0.25 : an === "pistolL" ? -0.25 : 0;
      } else if (an === "shotgun") {
        A[0] = -1.45 - 0.35 * (t > m.wind ? 1 - u : 0);
        B[0] = -1.3;
        B[1] = 0.55;
        ch[1] = -0.2;
      } else if (an === "slide") {
        f.hips.p[1] = o.leg - 0.45;
        f.legR.r[0] = -1.3;
        f.legL.r[0] = 0.2;
        ch[0] = -0.35;
        A[0] = -1.5;
      } else if (an === "bow") {
        ch[1] = -0.6;
        B[0] = -1.5;
        B[1] = 0.6;
        A[0] = lerp(-1.1, -0.7, u);
        A[1] = 0.5;
        A[2] = lerp(0.7, 0.2, u);
      } else {
        A[0] = B[0] = lerp(0.75, -1.55, u);
        ch[0] = lerp(-0.25, 0.6, u);
        f.legR.r[0] = -0.85 * u;
        f.legL.r[0] = 0.65 * u;
        f.hips.p[1] = o.leg - 0.16 * u;
      }
      break;
    }
    case "dodge": {
      const k = Math.sin(sat(p.t / p.ddur) * PI);
      ch[0] = 0.25 + 0.95 * k;
      f.hips.p[1] = o.leg - 0.42 * k;
      f.legR.r[0] = -1.15 * k;
      f.legL.r[0] = 0.8 * k;
      A[0] = B[0] = 0.95 * k;
      break;
    }
    case "guard": {
      const pk = p.guardT <= p.parryWin || p.buff === "fortress" ? 1 : 0;
      if (id === "tanker") {
        B[0] = -1.5;
        B[2] = -0.5;
        A[0] = -0.3;
        ch[1] = -0.35;
      } else if (id === "mage" || id === "fighter") {
        A[0] = -1.5;
        A[1] = 0.9;
        B[0] = -1.4;
        B[2] = -0.5;
      } else if (id === "sapper") {
        // the hammer haft held across, as a bar
        A[0] = B[0] = -1.55;
        A[2] = 0.5;
        B[2] = -0.5;
        ch[1] = -0.2;
      } else if (id === "riftwalker") {
        // the device arm up across the face, the blade held back
        B[0] = -1.75;
        B[2] = -0.7;
        A[0] = -0.6;
        A[2] = 0.3;
      } else if (id === "enforcer") {
        // forearms crossed in front of the face, guns up
        A[0] = B[0] = -1.75;
        A[2] = 0.75;
        B[2] = -0.75;
      } else if (id === "ranger") {
        B[0] = -1.6;
        B[1] = 0.9;
        A[0] = -1.2;
        A[2] = 0.5;
      } else {
        A[0] = -1.8;
        A[2] = 0.6;
        B[0] = -1.5;
        B[2] = -0.6;
      }
      ch[0] = 0.16;
      f.hips.p[1] = o.leg - 0.1;
      f.legR.r[0] += -0.2;
      f.legL.r[0] += 0.2;
      if (pk) setEm(f, 0.25, 0.35, 0.4);
      break;
    }
    case "hit":
      ch[0] = -0.55 * (1 - sat(p.t / 0.34));
      A[2] = -0.6;
      B[2] = 0.6;
      break;
    case "held": {
      // seized: arms thrown up and fighting, the body twisting against the grip,
      // and a jolt on each press that breaks it
      const k = p.hold ? p.hold.jolt : 0,
        sw = Math.sin(G.t * 15);
      A[0] = -2.3 + sw * 0.3 - k * 0.5;
      B[0] = -2.1 - sw * 0.3 - k * 0.5;
      A[2] = -0.35 - k * 0.4;
      B[2] = 0.35 + k * 0.4;
      ch[0] = -0.2 - k * 0.3;
      ch[1] = Math.sin(G.t * 11) * 0.3 + k * 0.4;
      f.headN.r[0] = -0.25;
      f.headN.r[1] = Math.sin(G.t * 13) * 0.3;
      f.hips.p[1] = o.leg - 0.12;
      f.legR.r[0] = 0.4 + sw * 0.25;
      f.legL.r[0] = 0.4 - sw * 0.25;
      // seized by the Warden for two (a mate's holder comes from the host's
      // held event): drawn up against its chest, though the player stays
      // on the floor in front of it
      const by = p.hold ? p.hold.by : p.heldBy;
      if (by && by.state === "hold" && by.atk && by.atk.kind === "seize") {
        const bo = by.fig.o,
          ahead = (bo.d / 2) * bo.sc + o.d * o.sc + 0.15;
        f.root.p[0] = by.x + Math.sin(by.yaw) * ahead;
        f.root.p[2] = by.z + Math.cos(by.yaw) * ahead;
        f.root.p[1] = (bo.leg + bo.th * 0.55) * bo.sc - (o.leg + o.th * 0.5) * o.sc;
        f.root.r[1] = by.yaw + PI;
        f.legR.r[0] = 0.15 + sw * 0.3;
        f.legL.r[0] = 0.15 - sw * 0.3;
      }
      break;
    }
    case "gbreak":
      ch[0] = 0.7;
      A[2] = -0.9;
      B[2] = 0.9;
      f.hips.p[1] = o.leg - 0.2;
      f.headN.r[0] = 0.4;
      break;
    case "heal":
      B[0] = -2.3 * Math.sin(sat(p.t / 0.9) * PI);
      f.headN.r[0] = -0.3;
      break;
    case "execute": {
      const u = sat((p.t - 0.14) / 0.12);
      A[0] = lerp(0.8, -1.6, u);
      if (id === "assassin" || id === "fighter") B[0] = A[0];
      if (id === "sapper") {
        // the charge pressed in with the left hand, then a front kick
        B[0] = lerp(-1.5, -0.4, u);
        f.legR.r[0] = lerp(0, -1.5, u);
        f.legL.r[0] = 0.25 * u;
        ch[0] = lerp(0.3, -0.25, u);
        A[0] = -0.6;
        break;
      }
      if (id === "enforcer") {
        // the rifle shouldered and aimed
        A[0] = B[0] = -1.55;
        B[1] = 0.6;
        ch[1] = -0.3;
        ch[0] = 0;
        f.headN.r[0] = 0.1;
        break;
      }
      ch[0] = lerp(-0.3, 0.65, u);
      f.legR.r[0] = -0.9 * u;
      f.legL.r[0] = 0.6 * u;
      break;
    }
    case "grapple":
      // reeled in on the line: hook arm out ahead, leaning in, legs trailing
      A[0] = -1.6;
      B[0] = -0.5;
      ch[0] = 0.4;
      f.legR.r[0] = 0.5;
      f.legL.r[0] = 0.35;
      break;
    case "blink": {
      const u = sat((p.t - 0.14) / 0.08);
      A[0] = B[0] = lerp(0.7, -1.55, u);
      ch[0] = 0.5 * u;
      break;
    }
    case "dead": {
      const k = smooth(p.t / 0.6);
      f.root.r[0] = (-PI / 2) * k;
      f.root.p[1] = 0.16 * k;
      A[2] = -0.8 * k;
      B[2] = 0.8 * k;
      break;
    }
  }
  sinkInWater(f, p.x, p.z);
}
// The dummy is a post: arms out as a crossbar, rocks back when struck and
// slumps while staggered. It has no walk, attack or death pose.
function poseDummy(e) {
  const f = e.fig;
  poseBase(f, 0, 0, 0);
  f.root.p[0] = e.x;
  f.root.p[1] = e.y;
  f.root.p[2] = e.z;
  f.root.r[1] = e.yaw;
  f.armR.r[2] = -1.45;
  f.armL.r[2] = 1.45;
  const stag = e.state === "stagger",
    pu = stag ? 0.5 + 0.5 * Math.sin(G.t * 10) : 0;
  f.chest.r[0] = stag ? 0.5 + Math.sin(G.t * 6) * 0.04 : -0.35 * e.flash;
  f.headN.r[0] = stag ? 0.5 : 0;
  setEm(
    f,
    (stag ? 0.5 + 0.3 * pu : 0) + e.flash * 0.9,
    (stag ? 0.3 + 0.15 * pu : 0) + e.flash * 0.85,
    e.flash * 0.7,
  );
  sinkInWater(f, e.x, e.z);
}
function poseEnemy(e) {
  if (e.def.dummy) return poseDummy(e);
  if (EPOSE[e.type] && EPOSE[e.type].pose) return EPOSE[e.type].pose(e);
  const f = e.fig,
    d = e.def,
    o = f.o,
    mv = sat(e.speed / d.speed);
  poseBase(f, e.walk, 0.6 * mv, d.hunch + mv * 0.1);
  f.root.p[0] = e.x;
  f.root.p[1] = e.y;
  f.root.p[2] = e.z;
  f.root.r[1] = e.yaw;
  let tr = 0,
    tg = 0,
    tb = 0;
  const A = f.armR.r,
    B = f.armL.r,
    ch = f.chest.r;
  if (e.type === "brute") {
    B[0] = -0.9;
    B[2] = -0.25;
  }
  switch (e.state) {
    case "idle":
      ch[0] += Math.sin(G.t * 1.4 + e.ph) * 0.04;
      f.headN.r[0] = 0.2;
      break;
    case "alert":
      f.headN.r[0] = -0.3;
      A[2] = -0.5;
      B[2] = 0.5;
      break;
    case "wind": {
      const k = sat(e.t / e.atk.wind);
      atkPose(f, e.atk.style, "wind", k, d.hunch);
      if (e.atk.unb) {
        tr = 0.45 * k;
        tg = 0.02 * k;
      } else {
        tr = 0.13 * k;
        tg = 0.1 * k;
        tb = 0.04 * k;
      }
      break;
    }
    case "act":
      atkPose(f, e.atk.style, "act", sat(e.t / e.atk.act), d.hunch);
      break;
    case "rec": {
      const base = snapPose(f);
      atkPose(f, e.atk.style, "act", 1, d.hunch);
      blendPose(f, base, 1 - smooth(sat(e.t / e.atk.rec)));
      break;
    }
    case "hit":
      ch[0] = d.hunch - 0.5 * (1 - sat(e.t / 0.32));
      break;
    case "recoil":
      ch[0] = d.hunch - 0.6;
      A[0] = -2.5;
      A[2] = -0.9;
      f.headN.r[0] = -0.4;
      break;
    case "stagger": {
      f.hips.p[1] = o.leg * 0.6;
      f.legR.r[0] = -1.15;
      f.legL.r[0] = 0.95;
      ch[0] = 0.75 + Math.sin(G.t * 6) * 0.05;
      f.headN.r[0] = 0.45;
      A[2] = -0.25;
      B[2] = 0.25;
      const pu = 0.5 + 0.5 * Math.sin(G.t * 10);
      tr = 0.5 + 0.3 * pu;
      tg = 0.3 + 0.15 * pu;
      break;
    }
    case "hold": {
      // the Warden for two's seize: the player crushed to its chest in the
      // left arm, the right raised to strike (another hold has no pose here)
      if (!e.atk || e.atk.kind !== "seize") break;
      A[0] = -2.75;
      A[2] = -0.35;
      B[0] = -1.15;
      B[2] = -0.45;
      ch[0] = d.hunch - 0.2;
      f.headN.r[0] = 0.25;
      tr = 0.25 + 0.1 * Math.sin(G.t * 8);
      break;
    }
    case "roar": {
      // over the roar's own length (def.roarT), today's 1.2 s by default
      const k = Math.sin(sat(e.t / ((e.def.roarT && e.def.roarT[e.phase]) || 1.2)) * PI);
      A[0] = B[0] = -0.4;
      A[2] = -1.3 * k;
      B[2] = 1.3 * k;
      ch[0] = d.hunch - 0.4 * k;
      f.headN.r[0] = -0.5 * k;
      tr = 0.7 * k;
      break;
    }
    case "dead": {
      const k = smooth(e.t / 0.5);
      f.root.r[0] = (-PI / 2) * k;
      f.root.p[1] = 0.16 * o.sc * k - Math.max(0, e.t - 1.4) * 0.9;
      A[2] = -0.7 * k;
      B[2] = 0.7 * k;
      break;
    }
  }
  if (f.cape) f.cape.r[0] = 0.12 + mv * 0.6;
  if (EPOSE[e.type] && EPOSE[e.type].after) EPOSE[e.type].after(e);
  setEm(f, tr + e.flash * 0.9, tg + e.flash * 0.85, tb + e.flash * 0.7);
  if (f.sac) {
    const g = e.state === "wind" ? sat(e.t / e.atk.wind) : 0;
    f.sac.em[0] += g * 1.2;
    f.sac.em[1] += g * 0.5;
  }
  if (f.core && e.phase >= 2) {
    f.core.em[0] += 0.8;
    f.core.em[1] += 0.25;
    f.weapon.em[0] += 0.5;
  }
  sinkInWater(f, e.x, e.z);
}
// The glowing surface inside an open portal frame: a soft fill, three swirling
// bands and a few rising motes, all in the grade's colour.
function drawPortal(q) {
  const c = GRADES[q.grade].col,
    ax = Math.cos(q.yaw),
    az = -Math.sin(q.yaw),
    cx = q.x - Math.sin(q.yaw) * 0.85,
    cz = q.z - Math.cos(q.yaw) * 0.85,
    cy = 1.72,
    t = G.t;
  for (let row = 0; row < 5; row++)
    for (let col = -1; col <= 1; col++)
      R.sprite(
        cx + ax * col * 0.72,
        0.42 + row * 0.66,
        cz + az * col * 0.72,
        0.8,
        c[0],
        c[1],
        c[2],
        0.2 + 0.06 * Math.sin(t * 2.1 + row * 1.3 + col),
      );
  for (let k = 0; k < 3; k++) {
    const sc = 1 - k * 0.3,
      spin = t * (1.3 + k * 0.8) * (k % 2 ? -1 : 1);
    R.ribbon(
      36,
      (u, side) => {
        const an = u * TAU,
          m = sc * (side ? 1 : 0.78);
        return [
          cx + ax * Math.cos(an) * 1.08 * m,
          cy + Math.sin(an) * 1.6 * m,
          cz + az * Math.cos(an) * 1.08 * m,
        ];
      },
      c[0],
      c[1],
      c[2],
      (u) => 0.12 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(u * TAU * 2 + spin), 2),
    );
  }
  R.sprite(cx, cy, cz, 1.1, 0.8, 0.95, 1, 0.45 + 0.1 * Math.sin(t * 3));
  for (let i = 0; i < 7; i++) {
    const u = (t * 0.22 + i / 7) % 1;
    R.sprite(
      cx + ax * Math.sin(i * 2.4 + t * 0.7) * 0.85,
      0.25 + u * 3,
      cz + az * Math.sin(i * 2.4 + t * 0.7) * 0.85,
      0.09,
      c[0],
      c[1],
      c[2],
      1.3 * Math.sin(u * PI),
    );
  }
}
function buildLights() {
  const p = G.player,
    w = G.world,
    L = [];
  L.push({
    x: p.x + Math.sin(p.yaw) * 0.4,
    y: 2.5,
    z: p.z + Math.cos(p.yaw) * 0.4,
    c: [0.72, 0.86, 1],
    i: 1.55 * darkK(WARDEN2.dark.lamp),
    r: 20,
  });
  for (const sh of w.shrines)
    if (sh.lit && Math.hypot(sh.x - p.x, sh.z - p.z) < 42)
      L.push({
        x: sh.x,
        y: 2.1,
        z: sh.z,
        c: CRY.amber,
        i: 2.3 + Math.sin(G.t * 9 + sh.x) * 0.25,
        r: 18,
      });
  if (G.gate)
    L.push({ x: G.gate.x, y: 2.2, z: G.gate.z, c: [0.5, 0.9, 1], i: 3, r: 20 });
  if (G.flashWhite > 0.05)
    L.push({
      x: p.x,
      y: 1.6,
      z: p.z,
      c: [1, 0.95, 0.85],
      i: 4 * G.flashWhite,
      r: 9,
    });
  for (const e of G.enemies)
    // a hidden boss (the crocodile under the water) gives no light away
    if (e.def.boss && !e.dead && !e.hidden && Math.hypot(e.x - p.x, e.z - p.z) < 40)
      L.push({
        x: e.x,
        y: 2.4 + e.y,
        z: e.z,
        c: [1, 0.3, 0.15],
        i: e.phase >= 2 ? 2.2 : 1.2,
        r: 13,
      });
  const fx = p.x + Math.sin(cam.yaw) * 7,
    fz = p.z + Math.cos(cam.yaw) * 7,
    near = [],
    dk = darkMul();
  for (const c of w.lights) {
    const d = (c.x - fx) * (c.x - fx) + (c.z - fz) * (c.z - fz);
    if (d < 2200) near.push([d, c]);
  }
  near.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < near.length && L.length < 8; i++) {
    const c = near[i][1];
    // a crystal breathes; a lamp (which says whether it flickers) holds
    // steady but for its stutters
    L.push({
      x: c.x,
      y: c.y,
      z: c.z,
      c: c.c,
      i:
        (c.flick === undefined
          ? c.i + Math.sin(G.t * 1.7 + c.ph) * 0.2
          : c.flick
            ? c.i * lampFlicker(c.ph, G.t)
            : c.i) * dk,
      r: c.r,
    });
  }
  R.setLights(L);
}
// A cave-in's rubble: faceted rocks heaped along its ridge, three or four
// high, taller than a person, laid out once from the entry's seed so they do not flicker. Each rock
// keeps where it lands in `hx`, `ty` and `hz`.
const RUBBLE = [hexc(0x7a6656), hexc(0x66564a), hexc(0x8a7766)];
// rows: the offsets of its rows of rocks across the ridge (along c.yaw); the
// middle rows, within 0.3 of the ridge, stand a layer higher
function makeRubble(c, rows = [-0.55, 0, 0.55]) {
  const root = new Nd(),
    r = rng(c.seed),
    L = Math.hypot(c.bx - c.ax, c.bz - c.az),
    n = Math.max(2, Math.ceil(L / 0.6));
  for (let i = 0; i <= n; i++) {
    const s = i / n,
      x = lerp(c.ax, c.bx, s),
      z = lerp(c.az, c.bz, s);
    for (const row of rows) {
      const layers = Math.abs(row) < 0.3 ? 4 : 3;
      for (let k = 0; k < layers; k++) {
        const sz = 0.6 + r() * 0.35 - k * 0.04,
          q = root.add(
            part("oct", RUBBLE[(r() * 3) | 0], sz * 1.2, sz, sz * 1.1),
          );
        q.p = [
          x + Math.sin(c.yaw) * (row + (r() - 0.5) * 0.3),
          0.3 + k * 0.62 + r() * 0.15,
          z + Math.cos(c.yaw) * (row + (r() - 0.5) * 0.3),
        ];
        q.r = [r() * 3, r() * 3, r() * 3];
        q.ty = q.p[1];
        q.hx = q.p[0];
        q.hz = q.p[2];
      }
    }
  }
  return root;
}
// A mine: a dark disc on the floor with a light that blinks while it arms
// and holds steady once armed. A wire: a thin line at shin height.
const MINE_FIG = (() => {
  const n = new Nd();
  n.add(part("cyl", hexc(0x2e2f33), 0.42, 0.08, 0.42, 0, 0.04, 0));
  n.add(part("cyl", hexc(0x55575c), 0.16, 0.06, 0.16, 0, 0.1, 0));
  return n;
})();
function drawMines() {
  for (const m of G.mines) {
    MINE_FIG.p[0] = m.x;
    MINE_FIG.p[2] = m.z;
    R.drawNode(MINE_FIG);
    const armed = m.t >= MINE.arm,
      on = armed || m.t % 0.25 < 0.12,
      c = HAZARD;
    if (on) R.sprite(m.x, 0.17, m.z, armed ? 0.22 : 0.16, c[0], c[1], c[2], armed ? 1.2 : 1.8);
    for (const o of m.links) {
      if (o.x < m.x || (o.x === m.x && o.z < m.z)) continue; // once per wire
      const k = armed && o.t >= MINE.arm ? 0.9 : 0.35;
      R.ribbon(
        1,
        (t, s) => [lerp(m.x, o.x, t), 0.32 + 0.035 * s, lerp(m.z, o.z, t)],
        c[0],
        c[1],
        c[2],
        () => k,
      );
    }
  }
}
// a rift end: a dark jagged slit standing on its line, with glowing edges
const RIFT_FIG = (() => {
  const n = new Nd(),
    W = [0.35, 0.7, 0.95, 1.0, 0.85, 0.6, 0.3];
  W.forEach((w, i) => {
    const q = n.add(
      part("box", hexc(0x0b0610), w * RIFT.half * 1.5, 0.34, 0.05, 0, 0.25 + i * 0.3, 0),
    );
    q.em = [0.06, 0.01, 0.05];
  });
  return n;
})();
function riftEdge(e, i, t) {
  // the outline at height fraction t on side i (-1 or 1), jagged and flickering
  const j = (((t * 9) | 0) % 2 ? 0.09 : -0.06) + Math.sin(G.t * 23 + t * 17 + e.id) * 0.03;
  return (Math.sin(t * PI) * RIFT.half * 0.78 + j) * i;
}
function drawRifts() {
  const paired = G.rifts.length === 2;
  G.rifts.forEach((e, n) => {
    const open = sat(e.t / 0.25) * sat((e.life - e.t) / 1),
      c = n ? [1, 0.62, 0.9] : MAGENTA,
      glow = (paired ? 1.6 : 0.8) * open,
      ux = Math.cos(e.yaw),
      uz = -Math.sin(e.yaw);
    RIFT_FIG.p[0] = e.x;
    RIFT_FIG.p[2] = e.z;
    RIFT_FIG.r[1] = e.yaw;
    RIFT_FIG.s = [open, 1, 1];
    R.drawNode(RIFT_FIG);
    for (const i of [-1, 1])
      R.ribbon(
        12,
        (t, s) => {
          const d = riftEdge(e, i, t) * open + (s ? 0.05 : -0.05) * i;
          return [e.x + ux * d, 0.1 + t * RIFT.tall, e.z + uz * d];
        },
        c[0],
        c[1],
        c[2],
        (t) => glow * (0.4 + 0.6 * Math.sin(t * PI)),
      );
    R.sprite(e.x, 1.2, e.z, 1.1 * open, c[0], c[1], c[2], 0.25 * glow);
    if (e.flash > 0)
      R.sprite(e.x, 1.2, e.z, 2.2, c[0], c[1], c[2], e.flash * 2);
  });
  if (paired) {
    // a faint thread on the floor between the two ends
    const [a, b] = G.rifts,
      k = 0.25 * sat(Math.min(a.t, b.t) / 0.25);
    R.ribbon(
      16,
      (t, s) => [lerp(a.x, b.x, t), 0.06, lerp(a.z, b.z, t) + (s ? 0.03 : -0.03)],
      MAGENTA[0],
      MAGENTA[1],
      MAGENTA[2],
      (t) => k * (0.5 + 0.5 * Math.sin(G.t * 4 - t * 12)),
    );
  }
}
// Drop: a dark disc with a glowing rim over the fuse, and a tear in the roof
// over anything falling
function drawHoles() {
  for (const h of G.holes) {
    const k = sat(h.t / DROP.fuse),
      c = MAGENTA;
    R.blob(h.x, h.z, DROP.r * (0.4 + 0.6 * k), 0.85 * k);
    R.ring(h.x, 0.08, h.z, DROP.r * k - 0.12, DROP.r * k, c[0], c[1], c[2], 1.4 * k);
    R.ring(h.x, 0.08, h.z, DROP.r * k * 0.55 - 0.06, DROP.r * k * 0.55, c[0], c[1], c[2], 0.6 * k);
  }
  for (const e of G.enemies) {
    if (!(e.fallH > 0) || e.y <= 0.05) continue;
    const top = e.fallH + 0.5,
      k = sat(e.y / e.fallH),
      c = MAGENTA;
    R.ring(e.x, top - 0.02, e.z, 0.2, 0.2 + e.r * 1.3, c[0], c[1], c[2], 1.2 * k);
    R.sprite(e.x, top - 0.1, e.z, 0.9, c[0], c[1], c[2], 0.5 * k);
  }
}
function drawCaveIns() {
  for (const c of G.caveins) {
    if (c.phase === "fuse") {
      // the charge in the air for 0.4 s, then blinking on the floor
      const k = sat((CAVEIN.fuse - c.t) / 0.4),
        x = lerp(c.fx, c.x, k),
        z = lerp(c.fz, c.z, k),
        y = 0.25 + 1.2 * Math.sin(k * PI) + (1 - k) * 1.1,
        on = k < 1 || c.t % 0.2 < 0.1;
      R.sprite(x, y, z, 0.16, 0.35, 0.3, 0.25, 1);
      if (on) R.sprite(x, y + 0.05, z, 0.34, HAZARD[0], HAZARD[1], HAZARD[2], 1.6);
    }
    // the rocks fall from the roof over the last 0.3 s of the fuse
    const fall = c.phase === "fuse" ? sat(1 - c.t / 0.3) : 1;
    if (fall <= 0) continue;
    if (!c.node) c.node = makeRubble(c);
    const crumble =
      c.phase === "stand" ? sat(1 - c.t / CAVEIN.crumble) : 0;
    for (const q of c.node.ch) {
      q.p[1] = lerp(c.ceil, q.ty, fall * fall) - crumble * crumble * q.ty;
      // shaking as it gives way
      q.p[0] = q.hx + (Math.random() - 0.5) * 0.08 * crumble;
      q.p[2] = q.hz + (Math.random() - 0.5) * 0.08 * crumble;
    }
    R.drawNode(c.node);
  }
}
// A chunk of the crocodile's cavern ceiling: drawn as a cave-in's rubble, a
// round heap the size of its rock, falling from the roof over the last 0.3 s
// of its warning (the warning itself is drawDust's). A chunk that carries its
// own ends (a capsule of the Warden for two's seal) is heaped from one to the
// other instead.
const CHUNK_ROWS = [-0.95, 0, 0.95];
function drawChunks() {
  for (const k of G.chunks) {
    const fall = k.id ? 1 : sat(1 - k.t / 0.3);
    if (fall <= 0) continue;
    if (!k.node) {
      const ux = Math.cos(k.yaw) * 0.95,
        uz = -Math.sin(k.yaw) * 0.95,
        [ax, az, bx, bz] = k.ends || [k.x - ux, k.z - uz, k.x + ux, k.z + uz];
      k.node = makeRubble({ seed: k.seed, yaw: k.yaw, ax, az, bx, bz }, CHUNK_ROWS);
    }
    for (const q of k.node.ch) q.p[1] = lerp(k.ceil, q.ty, fall * fall);
    R.drawNode(k.node);
  }
}
// The sewer's moving set, drawn each frame: water pouring from the boss
// cavern's wall tunnels into the pools below, and shafts of light down from
// the cracks in its dome. Nothing is drawn for a world without them.
function drawSewerSet(w) {
  const cx = R.cam.x,
    cz = R.cam.z,
    sink = WATER.sink,
    fc = [0.5, 0.78, 0.66];
  for (const q of w.wallTunnels) {
    if (Math.hypot(q.x - cx, q.z - cz) > 80) continue;
    const fx = Math.sin(q.yaw),
      fz = Math.cos(q.yaw),
      rx = -fz,
      rz = fx,
      y0 = q.y - 0.8 + 0.03,
      E = SEWER.mouthOut,
      ph = q.x * 0.37;
    // running out along the outlet's floor, then falling: out at an even
    // pace, down faster and faster
    R.ribbon(
      4,
      (t, s) => {
        const e = t * E,
          l = (s ? 1 : -1) * SEWER.mouthHW * 0.85;
        return [q.x + fx * e + rx * l, y0 + 0.02, q.z + fz * e + rz * l];
      },
      fc[0],
      fc[1],
      fc[2],
      (t) => 0.16 + 0.08 * Math.sin(t * 9 - G.t * 7 + ph),
    );
    for (let j = 0; j < 3; j++) {
      const o2 = [0, -0.42, 0.45][j],
        hw = [0.85, 0.28, 0.3][j],
        a = [0.2, 0.32, 0.3][j];
      R.ribbon(
        12,
        (t, s) => {
          const e = E + 1.1 * t,
            y = y0 - (y0 + sink) * t * t,
            l = o2 + (s ? 1 : -1) * hw * (1 + 0.3 * t);
          return [q.x + fx * e + rx * l, y, q.z + fz * e + rz * l];
        },
        fc[0],
        fc[1],
        fc[2],
        (t) => a * (0.6 + 0.4 * Math.sin(t * 13 - G.t * (8 + j) + j * 2.1 + ph)),
      );
    }
    // where it lands: spray, mist and spreading rings
    const bx = q.x + fx * (E + 1.1),
      bz = q.z + fz * (E + 1.1);
    for (let j = 0; j < 3; j++) {
      const k = G.t * (6 + j) + j * 2 + ph;
      R.sprite(
        bx + rx * Math.sin(k) * 0.4,
        -sink + 0.2 + 0.18 * Math.abs(Math.sin(k * 1.3)),
        bz + rz * Math.sin(k) * 0.4,
        0.6,
        fc[0],
        fc[1],
        fc[2],
        0.3,
      );
    }
    R.sprite(bx, -sink + 0.7, bz, 2.2, fc[0], fc[1], fc[2], 0.12);
    for (let j = 0; j < 2; j++) {
      const k = (G.t * 0.8 + j * 0.5 + ph) % 1,
        r = 0.4 + 1.8 * k;
      R.ring(bx, -sink + 0.02, bz, r, r + 0.14, fc[0], fc[1], fc[2], 0.35 * (1 - k));
    }
  }
  const sky = SEWER_SKY;
  for (const h of w.shafts) {
    let dx = cx - h.x,
      dz = cz - h.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d > 80) continue;
    // a beam facing the camera, narrow at the crack and wide on the floor
    dx /= d;
    dz /= d;
    const sh = 0.92 + 0.08 * Math.sin(G.t * 0.7 + h.x);
    for (const [wm, a] of [
      [1.7, 0.05],
      [0.9, 0.09],
    ])
      R.ribbon(
        10,
        (t, s) => {
          const y = lerp(h.top - 0.1, 0.05, t),
            l = (s ? 1 : -1) * h.r * wm * lerp(0.35, 1, t);
          return [h.x + dz * l, y, h.z - dx * l];
        },
        sky[0],
        sky[1],
        sky[2],
        (t) => a * sh * (t < 0.06 ? t / 0.06 : 1) * (0.7 + 0.3 * Math.sin(PI * t)),
      );
    R.flat(h.x, 0.04, h.z, h.r * 1.9, sky[0], sky[1], sky[2], 0.3 * sh);
    R.flat(h.x, 0.05, h.z, h.r * 0.9, sky[0], sky[1], sky[2], 0.25 * sh);
    R.sprite(h.x, h.top - 0.25, h.z, h.r * 1.2, sky[0], sky[1], sky[2], 0.35);
    // dust drifting down through it
    for (let j = 0; j < 8; j++) {
      const k = (G.t * 0.035 + j * 0.131 + h.x * 0.01) % 1;
      R.sprite(
        h.x + Math.sin(G.t * 0.3 + j * 2.1) * h.r * 0.5,
        h.top * (1 - k),
        h.z + Math.cos(G.t * 0.27 + j * 1.7) * h.r * 0.5,
        0.05,
        sky[0],
        sky[1],
        sky[2],
        0.9,
      );
    }
  }
}
function render() {
  const p = G.player,
    w = G.world;
  R.env.t = G.t;
  R.env.glow = darkMul();
  R.env.ambK = darkK(WARDEN2.dark.amb);
  buildLights();
  R.begin();
  R.drawWorld(visiblePieces(w, R.cam.x, R.cam.z, p.x, p.z));
  posePlayer(p);
  R.drawNode(p.fig.root, p.fig.rim);
  // a co-op run's other player, with a marker over its head in its class's
  // colour; while it is away the marker is grey and it has no rim light
  if (NET && NET.mates)
    for (const m of NET.mates) {
      posePlayer(m);
      R.drawNode(m.fig.root, m.away ? null : m.fig.rim);
      if (m.state !== "dead") R.blob(m.x, m.z, 0.8, 0.55);
      const mc = m.away ? COOP_AWAY : m.cls.col;
      R.sprite(m.x, 2.45, m.z, 0.3, mc[0], mc[1], mc[2], m.away ? 0.6 : 1.4);
    }
  const cx = R.cam.x,
    cz = R.cam.z;
  for (const e of G.enemies) {
    e.vis = !e.hidden && Math.hypot(e.x - cx, e.z - cz) < 66;
    if (!e.vis) continue;
    poseEnemy(e);
    R.drawNode(e.fig.root, e.fig.rim);
  }
  drawCaveIns();
  drawChunks();
  drawMines();
  drawRifts();
  drawHoles();
  drawClouds();
  drawShocks();
  drawSongs();
  drawWakes();
  drawMouths();
  drawDust();
  // ---- fx ----
  if (p.state !== "dead") {
    R.blob(p.x, p.z, 0.8, 0.55);
    drawWading(p.x, p.z, p.yaw, p.walk, p.speed, 0);
  }
  for (const e of G.enemies) {
    if (!e.vis) continue;
    const f = e.fig,
      sc = f.o.sc;
    if (!e.dead) {
      R.blob(e.x, e.z, e.r * 1.7, 0.55);
      if (!e.def.dummy && e.state !== "fall")
        drawWading(e.x, e.z, e.yaw, e.walk, e.speed, e.y);
    }
    if (e.dead && e.t > 0.6) continue;
    const ey = f.eye,
      pu = e.aware ? 1 : 0.45;
    for (const s of e.def.dummy ? [] : [-1, 1]) {
      const q = R.nodePos(f.headN, s * 0.075, 0.03, 0.15);
      R.sprite(q[0], q[1], q[2], 0.11 * sc, ey[0], ey[1], ey[2], 1.2 * pu);
    }
    if (e.state === "wind") {
      const k = sat(e.t / e.atk.wind),
        q = f.weapon
          ? R.nodePos(f.weapon)
          : f.sac
            ? R.nodePos(f.sac)
            : R.nodePos(f.handR, 0, -0.2, 0);
      if (e.atk.unb)
        R.sprite(q[0], q[1], q[2], (0.5 + k * 1.1) * sc, 1, 0.1, 0.05, 0.9 * k);
      else
        R.sprite(
          q[0],
          q[1],
          q[2],
          (0.35 + k * 0.7) * sc,
          1,
          0.85,
          0.45,
          0.8 * k,
        );
      if (!e.atk.unb && k > 0.8)
        R.sprite(q[0], q[1], q[2], 1.6 * sc, 1, 0.95, 0.7, (k - 0.8) * 4);
    }
    if (e.state === "stagger") {
      const pu2 = 0.6 + 0.4 * Math.sin(G.t * 10);
      R.sprite(e.x, e.def.top * 0.62, e.z, 1.5 * sc, 1, 0.6, 0.15, 0.5 * pu2);
      R.ring(e.x, 0.15, e.z, e.r + 0.5, e.r + 0.9, 1, 0.6, 0.15, 0.9 * pu2);
    }
    if (f.core) {
      const q = R.nodePos(f.core);
      R.sprite(q[0], q[1], q[2], e.phase >= 2 ? 1.5 : 0.9, 1, 0.25, 0.1, 0.7);
    }
  }
  if (p.lock && !p.lock.dead) {
    const e = p.lock;
    R.ring(e.x, 0.14, e.z, e.r + 0.25, e.r + 0.5, 0.9, 0.95, 1, 0.7);
  }
  // weapon glints + buff auras
  // the grapple's line, from the hand to its target
  if (p.gLine > 0 && p.gT && p.fig.handR) {
    const h = R.nodePos(p.fig.handR, 0, -0.3, 0),
      tg = p.gT,
      ty = 1.1 * tg.fig.o.sc,
      a = Math.min(1, p.gLine * 6);
    R.ribbon(
      8,
      (u, side) => [
        lerp(h[0], tg.x, u),
        lerp(h[1], ty, u) + (side ? 0.025 : -0.025),
        lerp(h[2], tg.z, u),
      ],
      0.75,
      0.75,
      0.8,
      () => a,
    );
  }
  if (p.fig.root.vis && p.state !== "dead") {
    const cc = p.cls.col;
    for (const [h, z] of p.fig.tips) {
      const q = R.nodePos(h, 0, -0.03, z);
      R.sprite(
        q[0],
        q[1],
        q[2],
        p.cls.ranged ? 0.3 : 0.16,
        cc[0],
        cc[1],
        cc[2],
        p.state === "attack" ? 1.1 : 0.4,
      );
    }
    if (p.buff === "berserk") {
      R.sprite(
        p.x,
        1.1,
        p.z,
        1.5,
        1,
        0.35,
        0.1,
        0.35 + 0.15 * Math.sin(G.t * 14),
      );
      R.ring(p.x, 0.15, p.z, 0.7, 1.1, 1, 0.4, 0.12, 0.7);
    }
    if (p.buff === "fortress") {
      R.sprite(p.x, 1.1, p.z, 1.6, 1, 0.85, 0.45, 0.3);
      R.ring(p.x, 0.15, p.z, 0.9, 1.3, 1, 0.85, 0.45, 0.9);
      R.ring(p.x, 1.2, p.z, 0.95, 1.1, 1, 0.85, 0.45, 0.5);
    }
  }
  for (const q of G.pending) {
    if (!q.beam) continue;
    const k = 1 - q.t / 0.9,
      y = lerp(9, 0.5, k * k);
    for (let i = 0; i < 5; i++)
      R.sprite(
        q.x,
        y + i * 0.7,
        q.z,
        1.1 - i * 0.18,
        q.c[0],
        q.c[1],
        q.c[2],
        1.2 - i * 0.2,
      );
  }
  for (const h of w.halos) {
    const d = Math.hypot(h.x - cx, h.z - cz);
    if (d > 64) continue;
    if (h.lamp) {
      // a lamp's glass and glow, dimming with its light when it stutters
      const fl = h.flick ? lampFlicker(h.ph, G.t) : 1;
      R.sprite(h.x, h.y, h.z, 0.24, h.c[0], h.c[1], h.c[2], 1.3 * fl);
      R.sprite(h.x, h.y, h.z, h.s, h.c[0], h.c[1], h.c[2], 0.32 * fl);
      continue;
    }
    const fl = 0.85 + 0.15 * Math.sin(G.t * 2.2 + h.x);
    R.sprite(h.x, h.y, h.z, 1.9, h.c[0], h.c[1], h.c[2], 0.5 * fl * darkMul());
  }
  drawSewerSet(w);
  for (const sh of w.shrines) {
    const fl = Math.sin(G.t * 11 + sh.x) * 0.5 + Math.sin(G.t * 17) * 0.5;
    if (sh.lit) {
      R.sprite(
        sh.x,
        1.45 + fl * 0.04,
        sh.z,
        0.75 + fl * 0.06,
        1,
        0.6,
        0.15,
        1.3,
      );
      R.sprite(sh.x, 1.75, sh.z, 0.4, 1, 0.85, 0.5, 1.2);
      R.sprite(sh.x, 1.5, sh.z, 2.6, 1, 0.5, 0.1, 0.22);
    } else {
      R.sprite(sh.x, 1.3, sh.z, 0.3 + fl * 0.03, 0.4, 0.6, 1, 0.8);
      R.ring(
        sh.x,
        0.15,
        sh.z,
        2.4,
        2.8,
        0.4,
        0.6,
        1,
        0.25 + 0.15 * Math.sin(G.t * 3),
      );
    }
  }
  if (w.hub) {
    // brazier flames, then the open portals
    for (const h of w.halos)
      for (let i = 0; i < 4; i++) {
        const fl = Math.sin(G.t * (9 + i * 2.3) + h.x + i * 1.7);
        R.sprite(
          h.x + fl * 0.04,
          1.2 + i * 0.17 + fl * 0.03,
          h.z + Math.cos(G.t * 7 + i) * 0.04,
          0.36 - i * 0.065,
          1,
          0.5 + i * 0.12,
          0.1 + i * 0.06,
          1.1,
        );
      }
    for (const q of w.portals) if (q.open) drawPortal(q);
  }
  if (G.gate) {
    const g = G.gate,
      k = sat(g.t / 1.2);
    for (let i = 0; i < 9; i++)
      R.sprite(
        g.x,
        0.3 + i * 0.45,
        g.z,
        (1.3 - i * 0.07) * k,
        0.4,
        0.9,
        1,
        0.5,
      );
    R.ring(g.x, 0.15, g.z, 1.2 * k, 1.9 * k, 0.4, 0.9, 1, 1);
    R.ring(
      g.x,
      0.15,
      g.z,
      2.4 * k,
      2.6 * k,
      0.4,
      0.9,
      1,
      0.5 + 0.3 * Math.sin(G.t * 4),
    );
  }
  for (const q of G.parts) {
    const k = q.t / q.life;
    R.sprite(
      q.x,
      q.y,
      q.z,
      q.size * (1 - k * 0.6),
      q.c[0],
      q.c[1],
      q.c[2],
      1.6 * (1 - k),
    );
  }
  for (const q of G.drips) R.sprite(q.x, q.y, q.z, 0.07, 0.7, 0.9, 0.85, 1.2);
  for (const g of G.ghosts) {
    const a = 0.7 * (1 - g.t / 0.35),
      c = g.c || CYAN;
    for (const y of [0.45, 1.0, 1.55])
      R.sprite(g.x, y, g.z, 0.55, c[0], c[1], c[2], a);
  }
  // plaques: an unlocked class glows in its colour, a live locked one faintly
  for (const q of G.world.plaques || []) {
    if (!q.cls) continue;
    const open = classOpen(q.cls),
      c = open ? CLASSES[q.cls].col : [0.7, 0.75, 0.85],
      k = open ? 0.55 + 0.1 * Math.sin(G.t * 2) : 0.18,
      f = portalFront(q, 0.14);
    R.sprite(f.x, PLAQUE_Y, f.z, 0.55, c[0], c[1], c[2], k);
    R.sprite(f.x, PLAQUE_Y, f.z, 1.4, c[0], c[1], c[2], k * 0.3);
  }
  for (const b of G.bombs) {
    // a blinking light, faster as it runs out
    const per = b.t > 1 ? 0.5 : 0.2,
      on = b.t % per < per * 0.5;
    R.sprite(b.x, b.y, b.z, 0.14, 0.3, 0.3, 0.32, 1);
    if (on) R.sprite(b.x, b.y + 0.05, b.z, 0.32, CRIMSON[0], CRIMSON[1], CRIMSON[2], 1.8);
  }
  for (const pr of G.projs) {
    const c = pr.c,
      k = pr.kind;
    if (k === "arrow" || k === "shard") {
      const n = pr.big ? 9 : 6;
      for (let i = 0; i < n; i++)
        R.sprite(
          pr.x - pr.vx * 0.004 * i,
          pr.y,
          pr.z - pr.vz * 0.004 * i,
          (pr.big ? 0.2 : 0.13) * (1 - i / (n + 2)),
          c[0],
          c[1],
          c[2],
          1.5 - i * 0.12,
        );
      continue;
    }
    if (k === "sticky") {
      R.sprite(pr.x, pr.y, pr.z, 0.16, c[0], c[1], c[2], 1.4);
      continue;
    }
    if (k === "plate") {
      drawPlate(pr);
      continue;
    }
    if (k === "bullet") {
      // a thin bright streak
      for (let i = 0; i < 5; i++)
        R.sprite(
          pr.x - pr.vx * 0.003 * i,
          pr.y,
          pr.z - pr.vz * 0.003 * i,
          (pr.heavy ? 0.13 : 0.09) * (1 - i / 7),
          c[0],
          c[1],
          c[2],
          1.6 - i * 0.2,
        );
      continue;
    }
    if (k === "pellet") {
      R.sprite(pr.x, pr.y, pr.z, 0.1, 1, 0.8, 0.5, 1.6);
      R.sprite(pr.x - pr.vx * 0.006, pr.y, pr.z - pr.vz * 0.006, 0.07, c[0], c[1], c[2], 0.9);
      continue;
    }
    if (k === "wave") {
      const sp = Math.hypot(pr.vx, pr.vz),
        nx = -pr.vz / sp,
        nz = pr.vx / sp;
      for (let i = -3; i <= 3; i++)
        for (let j = 0; j < 3; j++)
          R.sprite(
            pr.x + nx * i * 0.32 - pr.vx * 0.012 * Math.abs(i),
            0.25 + j * 0.5,
            pr.z + nz * i * 0.32 - pr.vz * 0.012 * Math.abs(i),
            0.45 - j * 0.08,
            c[0],
            c[1],
            c[2],
            1.1 - j * 0.3,
          );
      continue;
    }
    const s =
      k === "orb"
        ? 0.6 + 0.08 * Math.sin(G.t * 30)
        : k === "spit"
          ? 0.42
          : k === "bolt"
            ? pr.big
              ? 0.42
              : 0.3
            : 0.26;
    R.sprite(pr.x, pr.y, pr.z, s, c[0], c[1], c[2], 1.6);
    if (k === "orb") R.sprite(pr.x, pr.y, pr.z, 1.3, c[0], c[1], c[2], 0.35);
    for (let i = 1; i <= 3; i++)
      R.sprite(
        pr.x - pr.vx * 0.012 * i,
        pr.y,
        pr.z - pr.vz * 0.012 * i,
        s * (1 - i * 0.2),
        c[0],
        c[1],
        c[2],
        0.9 - i * 0.22,
      );
  }
  for (const a of G.arcs) {
    const k = a.t / a.dur,
      fx = Math.sin(a.yaw),
      fz = Math.cos(a.yaw),
      rx = -fz,
      rz = fx,
      c = a.c;
    if (a.tear) {
      // the small tear the cut comes out of: a jagged upright slit
      const al = 1 - k;
      R.ribbon(
        8,
        (t, s) => {
          const j = (((t * 8) | 0) % 2 ? 1 : -1) * 0.07,
            wd = (s ? 1 : -1) * 0.05 * Math.sin(t * PI) + j;
          return [a.x + rx * wd, 0.5 + t * 1.6, a.z + rz * wd];
        },
        c[0],
        c[1],
        c[2],
        (t) => al * Math.sin(t * PI) * 1.8,
      );
      R.sprite(a.x, 1.3, a.z, 0.5, c[0], c[1], c[2], al * 0.6);
    }
    if (a.lance) {
      const head = Math.min(1, k * 2.6),
        tail = Math.max(0, k * 2.6 - 1.3);
      R.ribbon(
        6,
        (t, s) => {
          const d = lerp(0.4, a.len, lerp(tail, head, t)),
            wd = (s ? 1 : -1) * (a.wd || 0.26) * (1 - t * 0.7);
          return [a.x + fx * d + rx * wd, a.y, a.z + fz * d + rz * wd];
        },
        c[0],
        c[1],
        c[2],
        (t) => (1 - k * k) * (0.25 + 0.75 * t) * 1.7,
      );
    } else {
      const ct = Math.cos(a.tilt),
        st = Math.sin(a.tilt),
        head = Math.min(1, k * 2.3),
        tail = Math.max(0, k * 2.3 - 1.0);
      R.ribbon(
        16,
        (t, s) => {
          const th = lerp(a.a0, a.a1, lerp(tail, head, t)),
            rr = s ? a.r1 : a.r0,
            co = Math.cos(th) * rr,
            sn = Math.sin(th) * rr;
          return [
            a.x + fx * co + rx * ct * sn,
            a.y + st * sn,
            a.z + fz * co + rz * ct * sn,
          ];
        },
        c[0],
        c[1],
        c[2],
        (t) => (1 - k * k) * (0.1 + 0.9 * t) * 1.7,
      );
    }
  }
  for (const r of G.rings) {
    const k = r.t / r.dur,
      c = r.c;
    if (r.kind === "warn") {
      R.ring(
        r.x,
        0.16,
        r.z,
        r.r - 0.5,
        r.r,
        c[0],
        c[1],
        c[2],
        0.6 + 0.4 * Math.sin(G.t * 30),
      );
      R.ring(r.x, 0.15, r.z, 0, r.r * k, c[0], c[1], c[2], 0.22);
    } else if (r.kind === "ripple") {
      // a ring spreading on the water's face
      const rr = r.r * (0.15 + 0.85 * k);
      R.ring(r.x, r.y + 0.03, r.z, rr - 0.05, rr, c[0], c[1], c[2], 0.6 * (1 - k));
    } else {
      const rr = r.r * (0.2 + 0.8 * k);
      R.ring(r.x, 0.2, r.z, rr - 1.2, rr, c[0], c[1], c[2], 1.4 * (1 - k));
    }
  }
  // an aftershock, at the radius wavesUpdate judges, o.band deep
  for (const w of G.waves) {
    const o = w.o,
      rr = waveR(w);
    if (rr > 0) R.ring(w.x, 0.2, w.z, Math.max(0, rr - o.band / 2), rr + o.band / 2, RED[0], RED[1], RED[2], 1.4);
  }
  R.end();
}
