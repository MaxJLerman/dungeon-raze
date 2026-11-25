# D enemies and behaviour hooks (`06b_ebeh.js`, `05b_dbodies.js`)

The shared state machine is left alone for E. A D type adds what it needs
through three tables, keyed by its type name, and a type with no entry in a
table runs exactly as before.

- **`EBEH`** holds optional hooks per type. The header of `06b_ebeh.js` lists
  them with their arguments; `c` is what `enemyUpdate` already worked out
  (`{ p, w, dx, dz, dist, toP, alive }`).
  - `step(e, dt, c)` runs each awake step, before the state switch, and true
    skips the switch. `chase(e, dt, c)` runs in `chase` before the shared
    steering and true means it handled the step.
  - `canAttack(e, c)` false stops `chase` starting an attack, melee or shot,
    and taking a token.
  - `wind(e, c)` and `act(e, dt, c)` run for an `atk.kind` the shared code
    does not know.
  - `hit(e, dmg, post, o)` runs in `hitEnemy` after the Riftwalker bonus and
    before the ambush multiplier. It returns `null` to let the hit land, or
    `{ dmg, post, blocked }` to change it; `blocked` hands the hit to
    `blockHit`, which counts it as an attack (`noticeHit`: flash, hunt, last
    seen, posture) but gives no damage, knock, flinch, hitstop or focus. Both
    share `noticeHit`, so they cannot drift apart. `o` is the options object
    of the hit and carries `src`, `heavy`, `fx` and `fz` (a blast's centre)
    and, **for a shot only, `sx` and `sz`, where it started**: `projUpdate`
    passes them and nothing else reads them. A hit hook that needs a facing
    uses the shot's start, else the blast, else the player. A shot also
    passes `plate` (true for a crocodile's plate, parried back) and `mouth`
    (the wall tunnel it was thrown from); only the crocodile reads them.
  - `atkOk(e, a, c)` runs in `chooseAtk(e, dist, c)` for each attack that
    passed the shared filters (trig, phase, minTrig); false leaves it out of
    the choice.
  - `hpFloor(e)` runs in `hitEnemy` once the damage is taken off, after
    every multiplier (ambush, backstab, berserk), and returns the least
    health the hit may leave. A `hit` hook's cap alone does not hold past
    those multipliers; this does. Only the crocodile has one (its marks).
  - `death(e)` runs at the end of `kill`.
  - `foot(e, x, z)` says whether `e` may stand at a point. Read it through
    `footOk(e, x, z)` (always true for a type with no hook). `eStep` refuses a
    step that `footOk` forbids, trying each axis alone so the body slides, and
    `keepFooting(e)` runs each update after every other mover (knockback,
    lunges, `separate`, rifts) for a type with a `foot` hook: it records a
    spot the body may stand on, or puts it back on the last one. When that
    spot is gone too it searches rings 0.25 m apart out to 4 m. The bloater,
    eel, siren (`waterFoot`) and grabber (`wallFoot`) use it.
  - `goal(e, c)` runs in `chase` after `canAttack` and returns a point to
    steer for in place of the player, or `null`. The enemy still faces the
    player, walks to the point when it wants to attack, and otherwise waits
    there and does not circle. `waterGoal` is the one in use: the footed point
    nearest the player but no nearer than `e.r + p.r + 0.4`, from a 0.5 m
    lattice within 12 m, looked at again every 0.5 s. With the player in the
    water the points about as near as the best form a ring, and the one
    nearest the enemy wins, so it stops on its own side.
- **`EFIG`** maps a type to a function that returns its finished figure, which
  `makeEnemyFig` calls first. **`EPOSE`** maps a type to `{ pose(e) }`, which
  replaces the body of `poseEnemy` (the dummy still goes first), or to
  `{ after(e) }`, called at the end of `poseEnemy` just before the glow. Both
  live in `05b_dbodies.js`.
- **`atk.kb`** on an `EDEF` attack sets the knockback speed that `hurtPlayer`
  gives the player, in place of the default of 7. The drowned's bash uses 14.
- **The rat** (`rat`, threat 0) is small, quick (5.2, `wade` 1.6, so about 8.3 in
  water) and soft. It swims but cannot attack while `waterAt` reads above 0.5
  (`EBEH.rat.canAttack`; 0.5 is still the shore). It bites, or pounces from
  range. A rat sent out by a brood mother is a rat in every way but kill
  rewards (below).
- **The drowned** (`drowned`, threat 1) carries a manhole cover. Its hit hook
  stops every hit within `guard` (1.05 rad) of its facing, in melee, shots and
  pellets: a light hit gives `guardLight` (a quarter) of its posture, a heavy
  hit all of it, and heavies break it open into a stagger. A blast (`aoe`), an
  execution and a staggered drowned ignore the cover, and so do hits from the
  sides and back. Its bash shoves the player (`kb` 14); its edge is a slower,
  harder overhead.
- **The brood mother** (`brood`, threat 1) keeps `BROOD.keep` (7 m) from the
  player and backs off from inside it, down to `BROOD.close` (3 m), where she
  stands her ground and bites. While hunting and in a state where she is up
  (`BROOD_STATES`), every `BROOD.every` (6 s) she sends out a rat behind her,
  away from the player, up to `BROOD.cap` (4) alive at once; the first goes
  `BROOD.first` (3 s) into a hunt. At the cap her timer holds at 0, so a
  rat killed is replaced `BROOD.every` after the slot opens, and when she is
  not hunting it is put back to the first rat's delay. She sends nothing when she is staggered,
  falling, unaware or the player is in the boss chamber. A sent-out rat has
  `mom` (her) and `born`, shares her post (so it returns to her room), and
  gives `BROOD.focus` (2) focus and no tool charge when it dies, and an
  execution of one gives `BROOD.focus` focus (not 12) and no Enforcer tool
  charge, beside the usual heal. She takes no
  attack token while she stands off. `respawn` rebuilds the enemies, so her
  rats are gone and her timer starts fresh.
- **D effects** live in `07b_dfx.js`, which `07_render.js` calls each frame:
  `drawClouds`, `drawShocks`, `drawSongs`, `drawWakes`, `drawMouths` and
  `drawDust`, and for each plate in flight `drawPlate`. Each reads the
  game's list (`G.clouds`, `G.shocks`, the singing sirens, the crocodile
  under the water or in its tunnels, `G.chunks`) and draws only effects
  (`R.sprite`, `R.ring`, `R.flat`, and `R.blob` for shadows), so the
  sewer's triangle budget is untouched. `resetRun` and `respawn` clear both lists.
- **The bloater** (`bloater`, threat 0, `bound: "water"`) floats in a pool or
  a gutter, slow (1.2) and soft, and waits at the shore nearest the player
  (`goal`). It bumps for 5 at 1.4 m. When it dies (`death` hook) it leaves a
  poison cloud in `G.clouds` (`CLOUD`: radius 1.5 m, 3 s, a tick every 0.5 s
  for 4). `cloudsUpdate` ticks everything inside, the player (`hurtPlayer`
  with `atk.dot`) and every enemy (`hitEnemy` with `o.dot`), so a cloud can
  hurt the pack that is next to it. `drawClouds` (`07b_dfx.js`) draws it.
- **The eel** (`eel`, threat 1, `bound: "water"`) lives in one body of water.
  It sets `e.safe` unless it is biting, recovering, flinching, staggered or
  glowing, so a hit only lands then. In a hunt, every `EEL.every` (8 s) it
  glows for `EEL.glow` (1.2 s) and then shocks its whole pool (`eelShock`): 22
  to the player standing in the water of its body, and 22 and 20 posture to
  every other enemy in it but eels (`aoe`). Someone on the bank is safe. The
  shock goes in `G.shocks` and `drawShocks` lights the pool for `EEL.lit`
  (0.4 s). A hunt that ends starts the count again; an idle eel and a dead
  one never glow.
- **The siren** (`siren`, threat 2, `bound: "water"`) comes to the shore
  nearest the player. She starts no attack without a clear line to the
  player (`canAttack`), and plans only an attack whose trigger the player is
  already inside (`atkOk`, `sirenTrig`), since she cannot leave the water
  to close in. Up close she rakes (`rake`, then `rake2` from the other
  hand: plain melee, blockable and parryable, `claw` naming the hand for
  `poseSiren`). Her lunge (`kind: "grab"`, unblockable, reach 4,
  never through a wall or pier) calls `grabPlayer` with a target `SIREN.drag` (2 m) past the shore into her pool,
  at `SIREN.dragSpeed` (5 m/s) for `SIREN.dps` (8) a second (`sirenDrag`
  finds the spot; she backs off along the line as she drags so the player
  reaches the water). When the hold ends however it ended she cannot lunge
  or sing for `SIREN.grabCD` (6 s) and goes back toward her post, but she
  still rakes a player within `SIREN.near` (3.6 m). Her song
  (`kind: "song"`) pulls the player toward her at `SIREN.pull` (2.6 m/s,
  about half a walk, so walking away wins) while she can see them, never into
  her and never through a wall; a dodge breaks it. `drawSongs` draws it.
- **The drain grabber** (`grabber`, threat 1, `bound: "wall"`, `ambush: true`)
  is an arm in a tunnel grate, never moving, chasing or taking a token. It
  waits `hidden` for a player within `GRAB.r` (2.5 m) and `GRAB.arc` (1.2 rad
  either side) of its grate's facing in sight, then shows and strikes (the
  red unblockable warning, then `grabPlayer` with `GRAB.dps` 6 and `GRAB.speed`
  4 toward it). It stays shown `GRAB.show` (2.5 s) after a strike or a hold,
  and hides at once once it has taken `GRAB.back` (15) damage while shown,
  which also frees the player. It cannot strike again for `GRAB.rearm` (4 s)
  after hiding. A heavy flinch or a kill frees the player too.

## Tests

- Run `tests/t23.mjs` after any change to `06b_ebeh.js`, the D enemies, their
  bodies or where the sewer places them:
  `SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke`. It checks each hook, the rat,
  drowned and brood mother (the cover over every kind of hit, her timer and
  cap, her rats' rewards and post), their bodies in every state, and the
  placement over seeds 1 to 12 (brood rooms and tunnels; pool rooms are t24's).
  Shots go to `shots/` (`t23-rat*`, `t23-drowned`,
  `t23-brood`, and `t23-fight-brood` and `t23-fight-tunnel`, which are the
  enemies awake in a real sewer): look at them.
- Run `tests/t24.mjs` after any change to the shared rules for bound types,
  hidden or safe enemies, the held state, or the bloater, eel, siren and
  drain grabber, and after any change to where they are placed:
  `SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke`. It builds test types
  (`__w`, `__b`, `__a`) inside each step and deletes them after, checks the
  hooks on a real pool of D (seed 5), the hold, the cloud, the shock, the
  song and drag, the grate, and over seeds 1 to 12 the placement (no E type
  in D, a siren or eels in each pool room and never both,
  the siren near the crossing, eels in different bodies, every water-bound
  spawn on its footing, grabbers at grates, bloaters only in water). Shots
  go to `shots/t24-*`: look at them, above all `t24-fight-pool-siren` and
  `t24-fight-pool-eel`, which are real pool rooms with everything awake.

## Known problems

- The rat, the drowned and the brood mother are untested by hand. Their
  numbers (speed, health, the cover's angle, the brood timer, cap and
  distances, placement odds) and how they look were set by tests and
  screenshots only.
- The bloater, eel, siren and drain grabber, the hold and their placement are
  untested by hand. Set without a playtest: `CLOUD` (size, length, tick),
  `EEL` (the 8 s count, the 1.2 s glow, 22 damage), `SIREN` (the song's
  pull of 2.6 m/s, the 2 m drag, the 5 m/s drag speed, the 6 s cooldown,
  the rake's 10 and 12 damage and its 3.6 m reach during the cooldown),
  `GRAB` (reach, arc, the 15 damage that drives it back, the 4 s rearm),
  `HOLD` (the 2 s hold, 0.35 s per mash, the 1.5 s grace), the placement odds
  (0.5 siren room, 0.4 second eel, 0.35 gutter bloater, a third of grates)
  and how all of it looks. Whether the hold feels fair, and whether a siren
  room is too hard with rats and bloaters in it, are the questions.
- A hidden grabber is invisible until it strikes, and its grate is the only
  sign. The grates are drawn for every tunnel, so a grate with no grabber
  looks the same as one with one.
