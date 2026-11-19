// ---- per-type enemy behaviour hooks ----
// EBEH maps an enemy type (e.type) to optional hooks that add behaviour to
// the shared state machine. A type with no entry runs exactly as before. The
// `c` argument is { p, w, dx, dz, dist, toP, alive }, what enemyUpdate has
// already worked out for this step.
//   step(e, dt, c) -> bool       each awake step, after the senses and the
//                                knockback, before the state switch; true
//                                skips the switch this step
//   chase(e, dt, c) -> bool      in the chase case after the give-up and
//                                search checks, before the shared steering;
//                                true means the hook handled the step
//   canAttack(e, c) -> bool      false keeps chase from starting an attack
//                                (melee or shot) and from taking a token;
//                                e.plan is kept
//   wind(e, c)                   once, as wind turns to act, for an atk.kind
//                                the shared code does not know (not shot,
//                                volley, slam or charge)
//   act(e, dt, c)                each act step for such a kind; the shared end
//                                of act (k >= 1 goes to rec) still runs
//                                unless the hook changed e.state
//   hit(e, dmg, post, o) -> null | { dmg, post, blocked }
//                                a result must carry both dmg and post
//                                in hitEnemy, after the Riftwalker bonus and
//                                before the ambush multiplier; o carries sx
//                                and sz (where a shot started) for a shot
//   death(e)                     at the end of kill
//   foot(e, x, z) -> bool        whether e may stand at (x, z); read through
//                                footOk, enforced by eStep and keepFooting
//   goal(e, c) -> {x,z} | null   in the chase case, after canAttack: a point to
//                                steer for in place of the player (zero within
//                                0.3 m of it). The enemy still turns to face the
//                                player, a wanting enemy walks to the point,
//                                one not attacking waits there and does not
//                                circle; the attack choice is unchanged
const EBEH = {};
// True when e may stand at (x, z): always, for a type with no foot hook.
function footOk(e, x, z) {
  const b = EBEH[e.type];
  return !b || !b.foot || b.foot(e, x, z);
}
// Run each update after every mover (knockback, lunges, separation, rifts)
// for a living enemy whose type has a foot hook: remember a position it may
// stand on, or put it back on the last one. When that spot is gone too (rock
// rose on it), the nearest point it may stand on: rings 0.25 m apart out to
// 4 m, 16 points each. None found leaves the body where it is.
function keepFooting(e) {
  if (footOk(e, e.x, e.z)) {
    e.okx = e.x;
    e.okz = e.z;
    return;
  }
  if (footOk(e, e.okx, e.okz)) {
    e.x = e.okx;
    e.z = e.okz;
    return;
  }
  for (let r = 0.25; r <= 4 + 1e-6; r += 0.25)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU,
        x = e.x + Math.sin(a) * r,
        z = e.z + Math.cos(a) * r;
      if (footOk(e, x, z)) {
        e.x = e.okx = x;
        e.z = e.okz = z;
        return;
      }
    }
}
// A type bound to water or to a wall: heavy to every class tool that moves an
// enemy, and not pushed by other enemies.
function bound(e) {
  return !!e.def.bound;
}
// The foot rule of every water-bound type: water (0.5 is the shore), room for
// its body, and its own body of water or the shore where there is none.
function waterFoot(e, x, z) {
  const w = G.world;
  if (e.body === undefined) e.body = w.bodyAt(e.x, e.z);
  if (w.waterAt(x, z) < 0.5 || w.fieldAt(x, z) < e.r) return false;
  const b = w.bodyAt(x, z);
  return b === e.body || b === -1;
}
// The foot rule of a wall-bound type: its post and nowhere else.
function wallFoot(e, x, z) {
  return Math.hypot(x - e.hx, z - e.hz) <= 0.01;
}
// The point of e's footing nearest the player (but no nearer than e.r + p.r
// + 0.4), from a 0.5 m lattice (on the world's multiples of 0.5, so it does not shift as e moves) within 12 m of
// e. Cached on e.goal and looked at again every 0.5 s; e's own spot when
// nothing is found.
function waterGoal(e, c) {
  if (e.goal && G.t - e.goalT < 0.5) return e.goal;
  const p = c.p,
    x0 = Math.ceil((e.x - 12) / 0.5) * 0.5,
    z0 = Math.ceil((e.z - 12) / 0.5) * 0.5,
    // a body in the water stops just short of the player and waits there,
    // instead of steering into them and shoving them across the pool
    keep = e.r + p.r + 0.4;
  const pts = [];
  let bd = 1e9;
  for (let x = x0; x <= e.x + 12; x += 0.5)
    for (let z = z0; z <= e.z + 12; z += 0.5) {
      if (Math.hypot(x - e.x, z - e.z) > 12 || !footOk(e, x, z)) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < keep) continue;
      pts.push({ x, z, d });
      if (d < bd) bd = d;
    }
  // the nearest point to the player. With the player in the water that is a
  // ring round them, so among the points about as near as the best the one
  // nearest e wins: it stops on its own side and never steers through them.
  const ring = bd < keep + 0.75;
  let best = null,
    bc = 1e9;
  for (const q of pts) {
    if (q.d > bd + (ring ? 0.5 : 0)) continue;
    const cost = ring ? Math.hypot(q.x - e.x, q.z - e.z) : q.d;
    if (cost < bc) {
      bc = cost;
      best = q;
    }
  }
  e.goal = best ? { x: best.x, z: best.z } : { x: e.x, z: e.z };
  e.goalT = G.t;
  return e.goal;
}
// The rat swims but cannot bite while it does: a reading of 0.5 is still shore.
EBEH.rat = {
  canAttack: (e) => G.world.waterAt(e.x, e.z) <= 0.5,
};
// The drowned's cover stops what comes at its front. A hit's origin is where a
// shot started, else where a blast went off, else the player.
EBEH.drowned = {
  hit(e, dmg, post, o) {
    if (o.src === "aoe" || o.src === "exec" || e.state === "stagger") return null;
    const p = G.player,
      ox = o.sx !== undefined ? o.sx : o.fx !== undefined ? o.fx : p.x,
      oz = o.sz !== undefined ? o.sz : o.fz !== undefined ? o.fz : p.z;
    if (Math.abs(angDiff(e.yaw, Math.atan2(ox - e.x, oz - e.z))) >= e.def.guard) return null;
    return { dmg: 0, post: o.heavy ? post : post * e.def.guardLight, blocked: true };
  },
};
// The brood mother keeps her distance and sends out rats on a timer. The
// timer runs only while she is hunting and in a state where she is up and
// about; it is set on her first step, so nothing is added to makeEnemy.
const BROOD_STATES = { chase: 1, search: 1, wind: 1, act: 1, rec: 1 };
EBEH.brood = {
  step(e, dt, c) {
    if (e.birthT === undefined) e.birthT = BROOD.every - BROOD.first;
    if (!e.aware) {
      // a hunt that ends starts the next one from the first rat's delay
      e.birthT = BROOD.every - BROOD.first;
      return false;
    }
    if (G.inBoss || !BROOD_STATES[e.state]) return false;
    let n = 0;
    for (const o of G.enemies) if (o.mom === e && !o.dead) n++;
    if (n >= BROOD.cap) {
      // at the cap the timer waits: a slot that opens is filled `every` later
      e.birthT = 0;
      return false;
    }
    e.birthT += dt;
    if (e.birthT < BROOD.every) return false;
    e.birthT = 0;
    // behind her, away from the player
    const k = c.dist > 0.01 ? 1.4 / c.dist : 0,
      r = makeEnemy({ type: "rat", x: e.x - c.dx * k, z: e.z - c.dz * k, yaw: e.yaw, node: e.node });
    c.w.resolve(r, r.r);
    r.hx = e.hx;
    r.hz = e.hz;
    r.hyaw = e.hyaw;
    r.mom = e;
    r.born = true;
    G.enemies.push(r);
    alertE(r, true);
    e.birthAt = G.t;
    SFX.tele(false);
    sparks(r.x, 0.3, r.z, 10, e.fig.eye, 4);
    return false;
  },
  // she bites only when the player is on her, so she takes no token (one of
  // the two attack slots) while she stands off
  canAttack: (e, c) => c.dist <= BROOD.close + 0.5,
  // back away while the player is inside her keep distance but not on her
  chase(e, dt, c) {
    if (!(c.dist > BROOD.close && c.dist < BROOD.keep)) return false;
    e.token = false;
    const ux = c.dx / c.dist,
      uz = c.dz / c.dist;
    e.yaw = turnTo(e.yaw, c.toP, e.def.turn * dt);
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafeT = 1.5 + Math.random() * 2;
      if (Math.random() < 0.5) e.strafe = -e.strafe;
    }
    const tx = -uz * e.strafe,
      tz = ux * e.strafe;
    eStep(e, -ux * 0.8 + tx * 0.5, -uz * 0.8 + tz * 0.5, e.def.speed * 0.6, dt);
    return true;
  },
};
// The bloater floats in water and cannot leave it (foot), waits at the shore
// nearest the player (goal) and bursts into a poison cloud when it dies.
EBEH.bloater = {
  foot: waterFoot,
  goal: waterGoal,
  death(e) {
    G.clouds.push({ x: e.x, z: e.z, r: CLOUD.r, t: 0, tick: 0 });
  },
};
// The eel lives in one body of water (foot) and waits at the shore nearest the
// player (goal). It is under, and cannot be hit, except while it bites,
// recovers, flinches, is staggered or glows. In a hunt, every EEL.every s it
// glows for EEL.glow s and then shocks its whole pool: the player in the
// water of its body, and every other enemy there that is not an eel, whoever
// is on the bank is safe. A hunt that ends starts the count again.
const EEL_UP = { wind: 1, act: 1, rec: 1, hit: 1, recoil: 1, stagger: 1 };
EBEH.eel = {
  foot: waterFoot,
  goal: waterGoal,
  // a corpse neither glows nor shields itself
  death(e) {
    e.glowT = 0;
    e.safe = false;
  },
  step(e, dt, c) {
    const w = c.w;
    if (e.body === undefined) e.body = w.bodyAt(e.x, e.z);
    if (e.shockT === undefined) e.shockT = e.glowT = 0;
    e.safe = !EEL_UP[e.state] && !(e.glowT > 0);
    if (!e.aware || G.inBoss) {
      // an idle eel never shocks
      e.shockT = e.glowT = 0;
      e.safe = !EEL_UP[e.state];
      return false;
    }
    if (e.state === "stagger") return false;
    if (e.glowT > 0) {
      e.glowT -= dt;
      if (e.glowT > 0) return false;
      e.glowT = 0;
      e.shockT = 0;
      eelShock(e, w, c.p);
      e.safe = !EEL_UP[e.state];
      return false;
    }
    e.shockT += dt;
    if (e.shockT >= EEL.every) {
      e.glowT = EEL.glow;
      e.safe = false;
      SFX.tele(true);
    }
    return false;
  },
};
// The shock: hurts the player and every other enemy in e's body of water, and
// lights the pool for EEL.lit s.
function eelShock(e, w, p) {
  const id = e.body;
  if (id < 0 || id === undefined) return;
  if (p.state !== "dead" && w.waterAt(p.x, p.z) > 0.5 && w.bodyAt(p.x, p.z) === id)
    hurtPlayer(EEL.dmg, e, { dmg: EEL.dmg, unb: true });
  for (const o of G.enemies.slice())
    if (
      o !== e &&
      o.type !== "eel" &&
      !o.dead &&
      o.state !== "fall" &&
      !o.hidden &&
      w.waterAt(o.x, o.z) > 0.5 &&
      w.bodyAt(o.x, o.z) === id
    )
      hitEnemy(o, EEL.dmg, EEL.post, { src: "aoe", fx: e.x, fz: e.z });
  const b = w.bodies[id];
  G.shocks.push({
    body: id,
    room: b && b.room >= 0 ? w.nodes[b.room] : null,
    t: 0,
    dur: EEL.lit,
  });
}
// The siren lives in one pool (foot) and comes to the shore nearest the
// player (goal). Her lunge (kind "grab") catches a player in reach in front
// of her and drags them into her pool (held); once the hold is over, however
// it ended, she sinks back toward her post and cannot attack for
// SIREN.grabCD s. Her song (kind "song") pulls the player toward her while
// she can see them; a dodge breaks it.
EBEH.siren = {
  foot: waterFoot,
  goal: waterGoal,
  canAttack: (e) => !(e.grabCD > 0),
  step(e, dt, c) {
    if (e.body === undefined) e.body = c.w.bodyAt(e.x, e.z);
    e.grabCD = Math.max(0, (e.grabCD || 0) - dt);
    if (e.state !== "act") e.sing = false;
    if (!e.grabbing) return false;
    const p = c.p;
    if (e.state === "hold" && p.hold && p.hold.by === e) {
      e.yaw = turnTo(e.yaw, c.toP, e.def.turn * dt);
      // she backs off to keep clear of the player she drags, so they reach
      // the water and are not shoved back onto the bank by her body
      const gx = e.dragX - e.x,
        gz = e.dragZ - e.z,
        gd = Math.hypot(gx, gz);
      if (gd > 0.05) eStep(e, gx / gd, gz / gd, Math.min(SIREN.dragSpeed, gd / dt), dt);
      return true;
    }
    // the hold is over: she let go, a hit or stagger made her, or the player
    // broke free or died
    e.grabbing = false;
    e.grabCD = SIREN.grabCD;
    if (e.state === "hold") {
      e.state = "rec";
      e.t = 0;
      e.atk = e.def.atks.lunge;
      e.token = false;
    }
    return false;
  },
  // while she cannot grab she makes for her post, watching the player
  chase(e, dt, c) {
    if (!(e.grabCD > 0)) return false;
    e.token = false;
    e.yaw = turnTo(e.yaw, c.toP, e.def.turn * dt);
    const hx = e.hx - e.x,
      hz = e.hz - e.z,
      hd = Math.hypot(hx, hz);
    if (hd > 0.3) eStep(e, hx / hd, hz / hd, e.def.speed, dt);
    return true;
  },
  // the lunge's wind-up is the shared red warning; the song's is her rising
  wind() {},
  act(e, dt, c) {
    const a = e.atk,
      p = c.p;
    e.sing = false;
    if (a.kind === "grab") {
      if (e.hitDone || c.dist > a.reach + 0.6 || Math.abs(angDiff(e.yaw, c.toP)) > a.arc / 2) return;
      e.hitDone = true;
      // a parry that sent her reeling leaves nothing to grab with
      if (hurtPlayer(a.dmg, e, a) === "none" || e.state !== "act") return;
      const t = sirenDrag(e, c);
      if (grabPlayer(e, { dps: SIREN.dps, tx: t.x, tz: t.z, speed: SIREN.dragSpeed })) {
        e.state = "hold";
        e.t = 0;
        e.grabbing = true;
        e.dragX = t.hx;
        e.dragZ = t.hz;
      }
      return;
    }
    if (a.kind !== "song") return;
    e.yaw = turnTo(e.yaw, c.toP, e.def.turn * dt);
    if (!c.alive || ["held", "execute", "blink", "grapple", "inspect"].includes(p.state)) return;
    if (p.state === "dodge") {
      e.state = "rec";
      e.t = 0;
      return;
    }
    if (!c.w.los(e.x, e.z, p.x, p.z)) return;
    // pulled toward her, never into her, and never through a wall
    const room = c.dist - (e.r + p.r + 0.2);
    if (room <= 0) return;
    const s = Math.min(room, SIREN.pull * dt);
    p.x -= (c.dx / c.dist) * s;
    p.z -= (c.dz / c.dist) * s;
    c.w.resolve(p, p.r);
    e.sing = true;
  },
};
// Where the siren drags a player she has caught: where the line from the
// player through her crosses into the water, SIREN.drag m further along it,
// walked back toward the shore until it is footing of hers (her own spot when
// none is). hx, hz is where she backs off to meanwhile: e.r + p.r + 0.2 past
// that point on the same line, walked back the same way but no nearer than
// e.r + p.r (she stays where she is when there is no such spot).
function sirenDrag(e, c) {
  const p = c.p,
    w = c.w,
    d = c.dist,
    ux = d > 0.01 ? -c.dx / d : -Math.sin(e.yaw),
    uz = d > 0.01 ? -c.dz / d : -Math.cos(e.yaw);
  let s = 0;
  while (s < d && w.waterAt(p.x + ux * s, p.z + uz * s) < 0.5) s += 0.05;
  const sx = p.x + ux * s,
    sz = p.z + uz * s;
  const back = (x0, z0, k0, k1) => {
    for (let k = k0; k >= k1 - 1e-6; k -= 0.1)
      if (waterFoot(e, x0 + ux * k, z0 + uz * k)) return { x: x0 + ux * k, z: z0 + uz * k };
    return null;
  };
  const t = back(sx, sz, SIREN.drag, 0) || { x: e.x, z: e.z },
    h = back(t.x, t.z, e.r + p.r + 0.2, e.r + p.r) || { x: e.x, z: e.z };
  return { x: t.x, z: t.z, hx: h.x, hz: h.z };
}
// The drain grabber is an arm in a grate. Its post is the spot 0.4 m out from
// the grate (foot holds it there), so it never moves, and it never chases,
// routes or takes a token: step runs its whole cycle.
//   hidden    (e.hidden) waits for a player within GRAB.r and GRAB.arc of its
//             facing in sight, then strikes: shown, the shared wind (the red
//             warning) and act, whose hook does the grab like the siren's
//   shown     for GRAB.show s after a strike or a hold, then hides; GRAB.back
//             damage taken while shown (e.dmgSince, from the hit hook) hides it
//             at once and ends any hold (its state leaves "hold")
//   hidden    again for GRAB.rearm s (e.rearmT) before it can strike again
// e.showT is how long it stays shown; it holds at GRAB.show while it strikes
// and holds, and runs down after. A flinch, recoil or stagger runs the shared
// timers; it hides when they have ended and the time is up.
const GRAB_BUSY = { wind: 1, act: 1, hold: 1, hit: 1, recoil: 1, stagger: 1, rec: 1 };
function grabHide(e) {
  e.hidden = true;
  e.aware = false;
  e.state = "idle";
  e.t = 0;
  e.atk = null;
  e.token = false;
  e.posture = 0;
  e.dmgSince = 0;
  e.rearmT = GRAB.rearm;
}
EBEH.grabber = {
  foot: wallFoot,
  // it never hunts: whatever wakes it leaves it where it is
  chase: () => true,
  hit(e, dmg) {
    if (!e.hidden) e.dmgSince = (e.dmgSince || 0) + dmg;
    return null;
  },
  step(e, dt, c) {
    const p = c.p;
    // it stays on its post: no knock moves it, not even the little foot allows
    e.x = e.hx;
    e.z = e.hz;
    e.kx = e.kz = 0;
    e.rearmT = Math.max(0, (e.rearmT || 0) - dt);
    if (e.hidden) {
      if (
        e.rearmT === 0 &&
        c.alive &&
        p.state !== "held" &&
        G.grabGrace <= 0 &&
        c.dist <= GRAB.r &&
        Math.abs(angDiff(e.yaw, c.toP)) <= GRAB.arc &&
        c.w.los(e.x, e.z, p.x, p.z)
      ) {
        e.hidden = false;
        e.aware = true;
        e.dmgSince = 0;
        e.showT = GRAB.show;
        e.yaw = e.hyaw;
        e.atk = e.def.atks.grab;
        e.state = "wind";
        e.t = 0;
        e.hitDone = false;
        SFX.tele(true);
      }
      return true;
    }
    if (e.dmgSince >= GRAB.back) {
      grabHide(e);
      return true;
    }
    if (e.state === "hold") {
      if (p.state === "held" && p.hold && p.hold.by === e) {
        e.showT = GRAB.show;
        return true;
      }
      // the hold is over, however it ended: it lets go
      e.state = "rec";
      e.t = 0;
      e.atk = e.def.atks.grab;
      e.token = false;
    }
    if (e.state === "wind" || e.state === "act") e.showT = GRAB.show;
    else {
      e.showT -= dt;
      if (e.showT <= 0 && !GRAB_BUSY[e.state]) {
        grabHide(e);
        return true;
      }
    }
    // the shared timers run in the strike, the recovery and a flinch or stagger
    return !GRAB_BUSY[e.state];
  },
  act(e, dt, c) {
    const a = e.atk;
    if (a.kind !== "grab" || e.hitDone) return;
    if (c.dist > a.reach + 0.6 || Math.abs(angDiff(e.yaw, c.toP)) > a.arc / 2) return;
    e.hitDone = true;
    // a parry that sent it reeling leaves nothing to grab with
    if (hurtPlayer(a.dmg, e, a) === "none" || e.state !== "act") return;
    if (grabPlayer(e, { dps: GRAB.dps, tx: e.x, tz: e.z, speed: GRAB.speed })) {
      e.state = "hold";
      e.t = 0;
    }
  },
};
