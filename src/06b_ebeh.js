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
//                                in hitEnemy, after the Riftwalker bonus and
//                                before the ambush multiplier; o carries sx
//                                and sz (where a shot started) for a shot
//   death(e)                     at the end of kill
//   foot(e, x, z) -> bool        whether e may stand at (x, z); read through
//                                footOk, enforced by eStep and keepFooting
const EBEH = {};
// True when e may stand at (x, z): always, for a type with no foot hook.
function footOk(e, x, z) {
  const b = EBEH[e.type];
  return !b || !b.foot || b.foot(e, x, z);
}
// Run each update after every mover (knockback, lunges, separation, rifts)
// for a living enemy whose type has a foot hook: remember a position it may
// stand on, or put it back on the last one.
function keepFooting(e) {
  if (footOk(e, e.x, e.z)) {
    e.okx = e.x;
    e.okz = e.z;
  } else {
    e.x = e.okx;
    e.z = e.okz;
  }
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
    if (!e.aware || G.inBoss || !BROOD_STATES[e.state]) return false;
    e.birthT += dt;
    if (e.birthT < BROOD.every) return false;
    let n = 0;
    for (const o of G.enemies) if (o.mom === e && !o.dead) n++;
    if (n >= BROOD.cap) return false;
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
  // back away while the player is inside her keep distance but not on her
  chase(e, dt, c) {
    if (!(c.dist > BROOD.close && c.dist < BROOD.keep)) return false;
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
