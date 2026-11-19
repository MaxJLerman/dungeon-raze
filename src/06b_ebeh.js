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
//   atkOk(e, a, c) -> bool       in chooseAtk, for each attack that passed the
//                                shared filters (trig, phase, minTrig): false
//                                leaves attack a out of the choice. c is the
//                                hook argument, null for a type with no hooks
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
  // she starts neither the lunge nor the song without a clear line to the
  // player, so a pier between them stops both
  canAttack: (e, c) => !(e.grabCD > 0) && c.w.los(e.x, e.z, c.p.x, c.p.z),
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
      // she cannot reach through a pier or a wall
      if (!c.w.los(e.x, e.z, p.x, p.z)) return;
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
// ---- Old Sluicejaw ----
// The crocodile's fight runs in modes (e.mode), with e.modeT the time left in
// the mode. Its step hook drives every mode but land, where the shared state
// machine runs its attacks, posture, stagger and execution as for any boss.
//   wait   before the fight: hidden at its post until the player is in the
//          cavern (G.inBoss); then the boss bar comes up and it goes under
//   under  hidden, swimming through the water to e.spot, a shore picked on
//          entry; it rises once it is there and its time under is up
//   rise   hidden at e.spot for CROC.warn s: the warning (drawWakes)
//   land   up on the ring, surfacing in the rearing slam, for CROC.land s;
//          the clock stops in a stagger, and each stagger adds stagBonus
//   dive   up, walking to the nearest shore, then under again
// Leaving the cavern or dying, in any mode, puts it back to wait at full
// health (crocReset). Every number is a starting value for the playtest:
//   under     how long a spell under lasts, from and to, in s
//   swim      its least speed under the water, m/s: it swims faster when
//             that is what it takes to reach its spot in its time under
//   warn      how long the warning lasts before it bursts out
//   burst     the damage to a player standing on the spot as it comes up
//   land      how long a land phase lasts, staggers aside
//   stagBonus what each stagger adds to the land phase
//   minNew    how far a new spot must be from the last one
//   near      how near the player a spot may be
//   rollDps   what the death roll's hold hurts a second
//   dragSpeed how fast it drags a caught player, m/s
//   rollIn    how far past the shore into the water it drags them
//   rollCD    how long after a roll, however it ended, before it rolls again
const CROC = {
  under: [3, 5],
  swim: 7,
  warn: 0.9,
  burst: 18,
  land: 10,
  stagBonus: 3,
  minNew: 8,
  near: 4,
  rollDps: 12,
  dragSpeed: 4,
  rollIn: 2,
  rollCD: 8,
};
// the rearing slam's hit is centred this far in front of it
const CROC_SLAM_AHEAD = 1;
// states in which it is busy in the water, and does not climb out yet
const CROC_WET_BUSY = { wind: 1, act: 1, hold: 1, stagger: 1 };
// The dry footing point on a 0.5 m lattice within R m (3 unless given) of
// (x, z), and in a clear line from it, nearest (tx, tz); null when there is
// none.
function crocDry(e, w, x, z, tx, tz, R = 3) {
  let best = null,
    bd = 1e9;
  const n = Math.round(R * 2);
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      if (i * i + j * j > n * n) continue;
      const qx = x + i * 0.5,
        qz = z + j * 0.5,
        d = Math.hypot(qx - tx, qz - tz);
      if (d >= bd || w.waterAt(qx, qz) >= 0.5 || w.fieldAt(qx, qz) < e.r) continue;
      if (!w.los(x, z, qx, qz)) continue;
      bd = d;
      best = { x: qx, z: qz };
    }
  return best;
}
// The shore spots it may surface at: water points on a 1 m lattice centred on
// the cavern, inside its radius, with room for its body and dry footing
// within 3 m. Cached on e.shores.
function crocShores(e, w) {
  if (e.shores) return e.shores;
  const B = w.boss,
    R = Math.floor(B.r),
    out = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      const x = B.x + i,
        z = B.z + j;
      if (Math.hypot(i, j) > B.r || w.waterAt(x, z) < 0.5 || w.fieldAt(x, z) < e.r) continue;
      if (crocDry(e, w, x, z, x, z)) out.push({ x, z, body: w.bodyAt(x, z) });
    }
  return (e.shores = out);
}
// Where it comes up next: of the shores still clear of rubble and with dry
// footing beside them, at least CROC.minNew from the last spot and CROC.near
// from the player, the nearest to the player; null when there is none.
function crocPickSpot(e, c) {
  const w = c.w || G.world,
    p = c.p,
    L = e.lastSpot,
    cand = [];
  for (const s of crocShores(e, w)) {
    if (w.fieldAt(s.x, s.z) < e.r) continue;
    if (L && Math.hypot(s.x - L.x, s.z - L.z) < CROC.minNew) continue;
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d >= CROC.near) cand.push({ s, d });
  }
  cand.sort((a, b) => a.d - b.d);
  for (const q of cand) if (crocDry(e, w, q.s.x, q.s.z, q.s.x, q.s.z)) return q.s;
  return null;
}
// Its footing: room for its body, and on land dry floor unless it is in the
// water on purpose (e.wet: coming up, and the death roll). Under, rising and
// waiting the step hook moves it, so nothing is refused.
function crocFoot(e, x, z) {
  if (e.mode !== "land" && e.mode !== "dive") return true;
  const w = G.world;
  if (w.fieldAt(x, z) < e.r) return false;
  return e.mode !== "land" || e.wet || w.waterAt(x, z) < 0.5;
}
// Back to before the fight: full health, no marks passed, hidden at its post.
function crocReset(e) {
  Object.assign(e, {
    hp: e.def.hp,
    marks: 0,
    mode: "wait",
    modeT: 0,
    hidden: true,
    x: e.hx,
    z: e.hz,
    y: 0,
    yaw: e.hyaw,
    okx: e.hx,
    okz: e.hz,
    kx: 0,
    kz: 0,
    aware: false,
    state: "idle",
    t: 0,
    atk: null,
    plan: null,
    token: false,
    posture: 0,
    phase: 1,
    flash: 0,
    route: null,
    spot: null,
    lastSpot: null,
    path: null,
    wet: false,
    landT: 0,
    stagd: false,
    rolling: false,
    rollCD: 0,
  });
  G.bossSeen = false;
}
// The water it swims under: points 1 m apart over the cavern with room for
// its body, each joined to its 8 neighbours where the midpoint is water too,
// and labelled by the joined piece (comp) it is in. Cached on e.swim.
function crocSwimNet(e, w) {
  if (e.swim) return e.swim;
  const B = w.boss,
    R = Math.ceil(B.r),
    N = 2 * R + 1,
    at = new Int32Array(N * N).fill(-1),
    pts = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = B.x + i - R,
        z = B.z + j - R;
      if (Math.hypot(x - B.x, z - B.z) > B.r || w.waterAt(x, z) < 0.5 || w.fieldAt(x, z) < e.r) continue;
      at[i * N + j] = pts.length;
      pts.push({ x, z, i, j, nb: [] });
    }
  for (const q of pts)
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const i = q.i + di,
          j = q.j + dj;
        if ((!di && !dj) || i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = at[i * N + j];
        if (k >= 0 && w.waterAt(q.x + di / 2, q.z + dj / 2) >= 0.5) q.nb.push(k);
      }
  const comp = new Int32Array(pts.length).fill(-1);
  for (let s = 0, n = 0; s < pts.length; s++) {
    if (comp[s] >= 0) continue;
    comp[s] = n;
    for (let h = 0, qu = [s]; h < qu.length; h++)
      for (const k of pts[qu[h]].nb) if (comp[k] < 0) (comp[k] = n), qu.push(k);
    n++;
  }
  return (e.swim = { pts, comp });
}
// the point of the net nearest (x, z), in piece cp when it is given
function crocNode(net, x, z, cp) {
  let b = -1,
    bd = 1e9;
  for (let k = 0; k < net.pts.length; k++) {
    if (cp !== undefined && net.comp[k] !== cp) continue;
    const d = Math.hypot(net.pts[k].x - x, net.pts[k].z - z);
    if (d < bd) (bd = d), (b = k);
  }
  return b;
}
// The way under the water to e.spot, as points in order (e.path, e.pi). The
// moat and the centre pool are joined below the ring: a spot in water not
// joined to e's is reached by moving at once to that water's point nearest
// e, so its wake ends at one shore and starts at the other, never crossing
// dry floor.
function crocPlan(e, w) {
  const net = crocSwimNet(e, w),
    to = crocNode(net, e.spot.x, e.spot.z);
  e.path = [{ x: e.spot.x, z: e.spot.z }];
  e.pi = 0;
  if (to < 0) return;
  let from = crocNode(net, e.x, e.z);
  if (from < 0 || net.comp[from] !== net.comp[to]) {
    from = crocNode(net, e.x, e.z, net.comp[to]);
    e.x = net.pts[from].x;
    e.z = net.pts[from].z;
  }
  const prev = new Int32Array(net.pts.length).fill(-2);
  prev[from] = -1;
  for (let h = 0, qu = [from]; h < qu.length && prev[to] === -2; h++)
    for (const k of net.pts[qu[h]].nb) if (prev[k] === -2) (prev[k] = qu[h]), qu.push(k);
  for (let k = prev[to]; k >= 0 && k !== from; k = prev[k]) e.path.unshift(net.pts[k]);
}
const crocUnderT = () => CROC.under[0] + Math.random() * (CROC.under[1] - CROC.under[0]);
function crocUnder(e) {
  e.mode = "under";
  e.modeT = crocUnderT();
  e.hidden = true;
  e.spot = null;
  e.path = null;
  e.wet = false;
  e.state = "chase";
  e.atk = null;
  e.plan = null;
  e.token = false;
}
// It bursts out of the water at e.spot: a player on the spot is hit once and
// pushed clear of its body, and it comes up in the rearing slam.
function crocSurface(e, c) {
  const p = c.p,
    w = c.w;
  e.hidden = false;
  e.lastSpot = e.spot;
  e.mode = "land";
  e.landT = CROC.land;
  e.wet = true;
  e.stagd = false;
  e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
  splash(e.x, e.z, 30);
  sparks(e.x, 0.2, e.z, 16, [0.55, 0.85, 0.8], 6, 0.6);
  G.shake = Math.max(G.shake, 0.6);
  SFX.slam();
  e.burstHit = false;
  const d = Math.hypot(p.x - e.x, p.z - e.z);
  if (c.alive && d < e.r + 0.8) {
    e.burstHit = hurtPlayer(CROC.burst, e, { dmg: CROC.burst, unb: true }) !== "none";
    // never left inside it: out along the line from it, or toward dry floor
    let ux = 0,
      uz = 0;
    if (d > 0.05) (ux = (p.x - e.x) / d), (uz = (p.z - e.z) / d);
    else {
      const q = crocDry(e, w, e.x, e.z, e.x, e.z),
        qd = q ? Math.hypot(q.x - e.x, q.z - e.z) : 0;
      if (qd > 0.05) (ux = (q.x - e.x) / qd), (uz = (q.z - e.z) / qd);
      else (ux = -Math.sin(p.yaw)), (uz = -Math.cos(p.yaw));
    }
    const need = e.r + p.r + 0.3;
    if (d < need) {
      p.x = e.x + ux * need;
      p.z = e.z + uz * need;
      w.resolve(p, p.r);
    }
  }
  e.state = "wind";
  e.atk = e.def.atks.rear;
  e.t = 0;
  e.hitDone = false;
  e.plan = null;
  SFX.tele(true);
}
EBEH.croc = {
  foot: crocFoot,
  atkOk(e, a, c) {
    const A = e.def.atks;
    if (a === A.rear) return false;
    if (a === A.roll && e.rollCD > 0) return false;
    if (!c) return true;
    const off = Math.abs(angDiff(e.yaw, c.toP));
    if (a === A.b1 || a === A.roll) return off <= 1.2;
    if (a === A.tail) return off > 1.9;
    return true;
  },
  // the tail sweep starts with the player behind it, without turning first
  chase(e, dt, c) {
    const a = e.plan;
    if (a !== e.def.atks.tail || e.cd > 0 || c.dist > a.trig + e.r * 0.3) return false;
    e.atk = a;
    e.plan = null;
    e.state = "wind";
    e.t = 0;
    SFX.tele(false);
    return true;
  },
  step(e, dt, c) {
    const w = c.w,
      p = c.p;
    if (e.mode === undefined) crocReset(e);
    e.rollCD = Math.max(0, (e.rollCD || 0) - dt);
    // leaving the cavern or dying ends the fight, in every mode
    if (e.mode !== "wait" && (e.state === "return" || !G.inBoss || !c.alive)) crocReset(e);
    if (e.mode === "wait") {
      e.hidden = true;
      if (G.inBoss && c.alive) {
        alertE(e);
        crocUnder(e);
      }
      return true;
    }
    if (e.mode === "under") {
      e.hidden = true;
      e.modeT -= dt;
      if (e.spot && w.fieldAt(e.spot.x, e.spot.z) < e.r) e.spot = null;
      if (!e.spot) {
        e.spot = crocPickSpot(e, c);
        if (!e.spot) return true;
        e.path = null;
      }
      if (!e.path) crocPlan(e, w);
      if (e.pi < e.path.length) {
        // the way left; it swims fast enough to be there when its time is up
        let left = 0;
        for (let i = e.pi, x = e.x, z = e.z; i < e.path.length; i++) {
          left += Math.hypot(e.path[i].x - x, e.path[i].z - z);
          x = e.path[i].x;
          z = e.path[i].z;
        }
        let go = Math.max(CROC.swim, left / Math.max(e.modeT, dt)) * dt,
          moved = 0;
        while (go > 1e-6 && e.pi < e.path.length) {
          const q = e.path[e.pi],
            dx = q.x - e.x,
            dz = q.z - e.z,
            d = Math.hypot(dx, dz),
            m = Math.min(go, d);
          if (d > 1e-6) {
            e.yaw = turnTo(e.yaw, Math.atan2(dx, dz), 8 * dt);
            eStep(e, dx / d, dz / d, m / dt, dt);
          }
          go -= m;
          moved += m;
          if (m >= d - 1e-6) e.pi++;
        }
        e.speed = moved / dt;
        if (e.pi < e.path.length) return true;
      }
      if (e.modeT > 0) return true;
      // rubble on the ring beside it since it was picked: another spot
      if (!crocDry(e, w, e.spot.x, e.spot.z, e.spot.x, e.spot.z)) {
        e.spot = null;
        return true;
      }
      e.mode = "rise";
      e.modeT = CROC.warn;
      e.x = e.spot.x;
      e.z = e.spot.z;
      SFX.tele(true);
      return true;
    }
    if (e.mode === "rise") {
      e.hidden = true;
      e.x = e.spot.x;
      e.z = e.spot.z;
      if (w.fieldAt(e.x, e.z) < e.r) {
        e.mode = "under";
        e.spot = null;
        return true;
      }
      e.modeT -= dt;
      if (e.modeT > 0) return true;
      crocSurface(e, c);
      return false;
    }
    // a stagger stops its walk to the water: it stays up
    if (e.mode === "dive" && e.state === "stagger") e.mode = "land";
    if (e.mode === "dive") {
      e.modeT -= dt;
      const s = e.spot,
        dx = s.x - e.x,
        dz = s.z - e.z,
        d = Math.hypot(dx, dz);
      if (d > 0.3 && e.modeT > 0) {
        e.yaw = turnTo(e.yaw, Math.atan2(dx, dz), e.def.turn * dt);
        eStep(e, dx / d, dz / d, Math.min(e.def.speed, d / dt), dt);
        return true;
      }
      splash(e.x, e.z, 24);
      crocUnder(e);
      return true;
    }
    // land: the clock runs but in a stagger, and a stagger adds to it
    const st = e.state === "stagger";
    if (st && !e.stagd) e.landT += CROC.stagBonus;
    e.stagd = st;
    if (!st) e.landT -= dt;
    // the death roll: it keeps beside the player it drags until the hold
    // ends, however it ended, and then cannot roll for CROC.rollCD
    if (e.rolling) {
      if (e.state === "hold" && p.hold && p.hold.by === e) {
        crocRollStep(e, dt, c);
        return true;
      }
      e.rolling = false;
      e.rollCD = CROC.rollCD;
      if (e.state === "hold") {
        e.state = "rec";
        e.t = 0;
        e.token = false;
      }
    }
    // in the water on purpose and done there: climb out onto dry floor
    if (e.wet && !CROC_WET_BUSY[e.state]) {
      const q =
        w.waterAt(e.x, e.z) >= 0.5 &&
        (crocDry(e, w, e.x, e.z, e.x, e.z) || crocDry(e, w, e.x, e.z, e.x, e.z, 6));
      if (!q) e.wet = false;
      else {
        const dx = q.x - e.x,
          dz = q.z - e.z,
          d = Math.hypot(dx, dz);
        eStep(e, dx / d, dz / d, Math.min(e.def.speed, d / dt), dt);
        if (d < 0.1) e.wet = false;
        return true;
      }
    }
    if (e.landT <= 0 && (e.state === "chase" || e.state === "rec")) {
      // back to the nearest shore, and under
      let best = null,
        bd = 1e9;
      for (const s of crocShores(e, w)) {
        const d = Math.hypot(s.x - e.x, s.z - e.z);
        if (d < bd && w.fieldAt(s.x, s.z) >= e.r) (bd = d), (best = s);
      }
      e.mode = "dive";
      e.modeT = 4;
      e.spot = best || { x: e.x, z: e.z };
      e.state = "chase";
      e.atk = null;
      e.plan = null;
      e.token = false;
      e.wet = false;
      return true;
    }
    return false;
  },
  // the rearing slam: up on its hind legs at the shore, then onto the dry
  // floor nearest the player and down in front of it
  wind(e, c) {
    if (e.atk.kind !== "rear") return;
    const s = e.lastSpot || { x: e.x, z: e.z },
      q = crocDry(e, c.w, s.x, s.z, c.p.x, c.p.z) || { x: e.x, z: e.z },
      a = Math.atan2(c.p.x - q.x, c.p.z - q.z);
    e.rx = q.x;
    e.rz = q.z;
    G.rings.push({
      x: q.x + Math.sin(a) * CROC_SLAM_AHEAD,
      z: q.z + Math.cos(a) * CROC_SLAM_AHEAD,
      r: e.atk.radius,
      t: 0,
      dur: e.atk.act,
      kind: "warn",
      c: RED,
    });
  },
  act(e, dt, c) {
    const a = e.atk,
      p = c.p;
    if (a.kind === "roll") return crocRollAct(e, dt, c);
    if (a.kind !== "rear") return;
    const gx = e.rx - e.x,
      gz = e.rz - e.z,
      gd = Math.hypot(gx, gz);
    if (gd > 0.02) eStep(e, gx / gd, gz / gd, gd / Math.max(a.act - e.t, dt), dt);
    e.yaw = turnTo(e.yaw, Math.atan2(p.x - e.x, p.z - e.z), e.def.turn * dt);
    if (e.t < a.act || e.hitDone) return;
    e.hitDone = true;
    const hx = e.x + Math.sin(e.yaw) * CROC_SLAM_AHEAD,
      hz = e.z + Math.cos(e.yaw) * CROC_SLAM_AHEAD;
    SFX.slam();
    G.shake = 1;
    G.rings.push({ x: hx, z: hz, r: a.radius, t: 0, dur: 0.45, kind: "shock", c: RED });
    sparks(hx, 0.3, hz, 40, [1, 0.5, 0.2], 9, 0.6, 0.16);
    // a player the burst already hit is not hit again as it comes down
    if (c.alive && !e.burstHit && Math.hypot(p.x - hx, p.z - hz) < a.radius) hurtPlayer(a.dmg, e, a);
  },
};
// The death roll's lunge: forward until it is up against the player, and a
// grab of a player in reach, in its arc and in sight, as the siren's. A
// caught player is dragged into the water at crocRollSpot, and it goes in
// with them (e.wet), rolling.
function crocRollAct(e, dt, c) {
  const a = e.atk,
    p = c.p,
    sep = e.r + p.r + 0.15;
  if (c.dist > sep)
    eStep(e, Math.sin(e.yaw), Math.cos(e.yaw), Math.min(a.lunge / a.act, (c.dist - sep) / dt), dt);
  if (e.hitDone || e.t < 0.02 || c.dist > a.reach + p.r) return;
  if (Math.abs(angDiff(e.yaw, c.toP)) > a.arc / 2) return;
  if (!c.w.los(e.x, e.z, p.x, p.z)) return;
  e.hitDone = true;
  // a parry that sent it reeling leaves nothing to grab with
  if (hurtPlayer(a.dmg, e, a) === "none" || e.state !== "act") return;
  const t = crocRollSpot(e, c);
  if (!grabPlayer(e, { dps: CROC.rollDps, tx: t.x, tz: t.z, speed: CROC.dragSpeed })) return;
  e.state = "hold";
  e.t = 0;
  e.rolling = true;
  e.wet = true;
  // it ends up beside the drag, on the side it is on: rollA is the bearing
  // from the player to it, turned round the player toward that side
  const ux = t.x - p.x,
    uz = t.z - p.z,
    side = Math.sign(-uz * (e.x - p.x) + ux * (e.z - p.z)) || 1;
  e.rollA = Math.atan2(e.x - p.x, e.z - p.z);
  e.rollTo = Math.hypot(ux, uz) > 0.05 ? Math.atan2(-uz * side, ux * side) : e.rollA;
}
// Each step of the hold: round the player toward its side of the drag and
// along with them, never into them, facing them.
function crocRollStep(e, dt, c) {
  const p = c.p,
    sep = e.r + p.r + 0.15;
  e.rollA = turnTo(e.rollA, e.rollTo, 4 * dt);
  const gx = p.x + Math.sin(e.rollA) * sep - e.x,
    gz = p.z + Math.cos(e.rollA) * sep - e.z,
    gd = Math.hypot(gx, gz);
  if (gd > 0.02) eStep(e, gx / gd, gz / gd, Math.min(CROC.dragSpeed * 2, gd / dt), dt);
  e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
}
// Where the death roll drags the player: the water point nearest them that
// they can be dragged to in a straight line (0.25 m lattice within 8 m, with
// room for them all the way), then CROC.rollIn further along the same line,
// walked back until it is water they can be dragged to the same way; the
// player's own spot when there is no such point.
function crocRollSpot(e, c) {
  const p = c.p,
    w = c.w,
    cand = [],
    // room for the player's body all along the line, so rock never stops
    // the drag short
    clear = (x, z) => {
      const n = Math.ceil(Math.hypot(x - p.x, z - p.z) / 0.25);
      for (let i = 1; i <= n; i++)
        if (w.fieldAt(lerp(p.x, x, i / n), lerp(p.z, z, i / n)) < p.r - 0.05) return false;
      return true;
    };
  for (let i = -32; i <= 32; i++)
    for (let j = -32; j <= 32; j++) {
      const d = Math.hypot(i, j) * 0.25,
        x = p.x + i * 0.25,
        z = p.z + j * 0.25;
      if (d <= 8 && w.waterAt(x, z) >= 0.5 && w.fieldAt(x, z) >= p.r) cand.push({ x, z, d });
    }
  cand.sort((a, b) => a.d - b.d);
  const W = cand.find((q) => clear(q.x, q.z));
  if (!W) return { x: p.x, z: p.z };
  // already in the water: on, away from the crocodile
  const ux = W.d > 0.05 ? (W.x - p.x) / W.d : (p.x - e.x) / (c.dist || 1),
    uz = W.d > 0.05 ? (W.z - p.z) / W.d : (p.z - e.z) / (c.dist || 1);
  for (let k = CROC.rollIn; k > 1e-6; k -= 0.1) {
    const x = W.x + ux * k,
      z = W.z + uz * k;
    if (w.waterAt(x, z) >= 0.5 && w.fieldAt(x, z) >= p.r && clear(x, z)) return { x, z };
  }
  return { x: W.x, z: W.z };
}
