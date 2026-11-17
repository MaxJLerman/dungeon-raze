// ---------- posing + scene rendering ----------
function setEm(f, r, g, b) {
  for (const n of f.meshes) {
    n.em[0] = n.em0[0] + r;
    n.em[1] = n.em0[1] + g;
    n.em[2] = n.em0[2] + b;
  }
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
  else if (id === "enforcer") {
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
}
function poseEnemy(e) {
  if (e.def.dummy) return poseDummy(e);
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
    case "roar": {
      const k = Math.sin(sat(e.t / 1.2) * PI);
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
  setEm(f, tr + e.flash * 0.9, tg + e.flash * 0.85, tb + e.flash * 0.7);
  if (f.sac) {
    const g = e.state === "wind" ? sat(e.t / e.atk.wind) : 0;
    f.sac.em[0] += g * 1.2;
    f.sac.em[1] += g * 0.5;
  }
  if (f.core && e.phase === 2) {
    f.core.em[0] += 0.8;
    f.core.em[1] += 0.25;
    f.weapon.em[0] += 0.5;
  }
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
    i: 1.55,
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
    if (e.def.boss && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 40)
      L.push({
        x: e.x,
        y: 2.4 + e.y,
        z: e.z,
        c: [1, 0.3, 0.15],
        i: e.phase === 2 ? 2.2 : 1.2,
        r: 13,
      });
  const fx = p.x + Math.sin(cam.yaw) * 7,
    fz = p.z + Math.cos(cam.yaw) * 7,
    near = [];
  for (const c of w.lights) {
    const d = (c.x - fx) * (c.x - fx) + (c.z - fz) * (c.z - fz);
    if (d < 2200) near.push([d, c]);
  }
  near.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < near.length && L.length < 8; i++) {
    const c = near[i][1];
    L.push({
      x: c.x,
      y: c.y,
      z: c.z,
      c: c.c,
      i: c.i + Math.sin(G.t * 1.7 + c.ph) * 0.2,
      r: c.r,
    });
  }
  R.setLights(L);
}
function render() {
  const p = G.player,
    w = G.world;
  buildLights();
  R.begin();
  R.drawWorld();
  posePlayer(p);
  R.drawNode(p.fig.root, p.fig.rim);
  const cx = R.cam.x,
    cz = R.cam.z;
  for (const e of G.enemies) {
    e.vis = Math.hypot(e.x - cx, e.z - cz) < 66;
    if (!e.vis) continue;
    poseEnemy(e);
    R.drawNode(e.fig.root, e.fig.rim);
  }
  // ---- fx ----
  if (p.state !== "dead") R.blob(p.x, p.z, 0.8, 0.55);
  for (const e of G.enemies) {
    if (!e.vis) continue;
    const f = e.fig,
      sc = f.o.sc;
    if (!e.dead) R.blob(e.x, e.z, e.r * 1.7, 0.55);
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
      R.sprite(q[0], q[1], q[2], e.phase === 2 ? 1.5 : 0.9, 1, 0.25, 0.1, 0.7);
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
    const fl = 0.85 + 0.15 * Math.sin(G.t * 2.2 + h.x);
    R.sprite(h.x, h.y, h.z, 1.9, h.c[0], h.c[1], h.c[2], 0.5 * fl);
  }
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
    if (k === "arrow") {
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
    } else {
      const rr = r.r * (0.2 + 0.8 * k);
      R.ring(r.x, 0.2, r.z, rr - 1.2, rr, c[0], c[1], c[2], 1.4 * (1 - k));
    }
  }
  R.end();
}
