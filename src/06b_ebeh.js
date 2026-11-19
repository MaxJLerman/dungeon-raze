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
// The point of e's footing nearest the player, from a 0.5 m lattice (on the
// world's multiples of 0.5, so it does not shift as e moves) within 12 m of
// e. Cached on e.goal and looked at again every 0.5 s; e's own spot when
// nothing is found.
function waterGoal(e, c) {
  if (e.goal && G.t - e.goalT < 0.5) return e.goal;
  const p = c.p,
    x0 = Math.ceil((e.x - 12) / 0.5) * 0.5,
    z0 = Math.ceil((e.z - 12) / 0.5) * 0.5;
  let best = null,
    bd = 1e9;
  for (let x = x0; x <= e.x + 12; x += 0.5)
    for (let z = z0; z <= e.z + 12; z += 0.5) {
      if (Math.hypot(x - e.x, z - e.z) > 12 || !footOk(e, x, z)) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) {
        bd = d;
        best = { x, z };
      }
    }
  e.goal = best || { x: e.x, z: e.z };
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
