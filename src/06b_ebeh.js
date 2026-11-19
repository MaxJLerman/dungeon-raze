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
