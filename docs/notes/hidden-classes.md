# Hidden classes, plaque codes and their kits

- A class with `hidden: true` is left out of the picker until unlocked.
  `UNLOCKED` is a Set of class ids, saved as `u` in `dungeon-raze.v2`.
  `classOpen(id)`, `pickable()` and `unlockClass(id)` (true when new) are the
  only ways to read or change it. A saved class that is locked falls back to
  the first pickable one.
- While a live plaque is open, `readSyms` turns presses into symbols, which
  are the action names `dodge`, `heal`, `tool`, `fwd`, `back`, `left` and
  `right`. The D-pad and the left stick enter directions, the stick once per
  push. The last symbols, joined by spaces, are hashed with `codeHash`
  (cyrb53, hex) and compared with `PLAQUE_CODES`, which `SHIPPED_CODES`
  fills with `{ hash, len }`. A sealed plaque, a held key and an already
  unlocked class take nothing, and nor does any plaque during a co-op run
  (`NET` set): Inspect opens it and shows its card as in the solo hall, and
  closes it the same way, but no symbol is taken, so nothing unlocks
  (hidden classes cannot play online, and an unlock would change the class
  mid-run). The other player sees the reader in the `inspect` state.
- Notation. `inputMode()` is `kb`, `touch`, `xbox` or `ps`, for the input in
  use. `codeText(syms, mode)` writes symbols in that input's notation: the
  bound keys on a keyboard, arrows and the touch button names by touch, arrows
  and the bound face buttons on a pad. The card's marks show each symbol
  entered that way, so they follow rebinding and change with the input.
- **Never commit a plain code.** Not in source, tests, comments, commits or
  docs. The codes live only in `tests/codes.local.json` (action names, space
  separated), which is ignored by git with everything else matching
  `tests/codes.local.*`; the test that enters the real code skips without
  it. Tests set their own code with `DF.setPlaqueCode(id, syms)` (an array or
  a space-separated string) and undo it with `DF.resetPlaqueCodes()`. To
  change a code, put the new hash and length in `SHIPPED_CODES` and the plain
  one in the local file. `SCRIPT=$PWD/tests/codes-print.mjs node test.mjs title`
  writes every local code in all four notations, with the default binds, to
  `tests/codes.local.md`. A test step may have an `after(result)` function,
  which `test.mjs` calls in node in place of printing the result.
- The Enforcer. Pistol chain (`e1` to `e3`), shotgun heavy (`eshot`, pellets),
  a slide dash, a sniper execution from `e.r + 4.5` that gives back a tool
  charge. The sticky bomb (tool) is a projectile that becomes an entry in
  `G.bombs`; it rides its enemy, falls to the floor where it is if the
  enemy dies or turns hidden (the crocodile going under) and
  blows after `STICKY.t`, hurting the player for `STICKY.self` of its damage
  in range and in sight. The grapple (ability) yanks a light enemy (poise 0,
  not boss or dummy) with `e.yank`, or pulls the player to a heavier one in
  the `grapple` state. With no target it costs nothing. Either way the enemy
  reels in `hit` for `e.hitT` seconds (a flinch is 0.32), and a staggered
  enemy stays staggered.
- The Sapper. A melee class: sledgehammer chain (`s1` to `s3`), a slam
  (`sslam`) whose damage comes only through a `blast` in front, and a dash
  (`sdrop`). `blastPost` on its class multiplies the posture damage of every
  `explode` while it is played; none of its blasts call `hurtPlayer`.
  - **Landmines** (tool) are entries in `G.mines` (`{ x, z, t, links, fuse }`).
    `plantMine` wires a new mine to the nearest one in sight within
    `MINE.link` that has fewer than `MINE.wires` wires. A mine arms after
    `MINE.arm`, goes off when an enemy body is within `MINE.trig`, and a wire
    between two armed mines sets both off when an enemy crosses it. `boomMine`
    sets one off and `blowMine` blows it at once; a blast sets off the mines
    inside it after `MINE.chain`.
    Past `MINE.cap` the oldest goes quiet. The player never sets one off.
  - **Cave-in** (ability) is an entry in `G.caveins`. `startCaveIn(x, z)`
    lands a charge and finds the ridge: a capsule `CAVEIN.thick` in radius
    across the throw, running out to the walls (past standing rubble) and
    `CAVEIN.into` into them. After `CAVEIN.fuse` (`caveImpact`) it hits every
    enemy under it, forces a stagger on all but the boss
    (`stagger(e, k)`, with `k` from `CAVEIN.stag`: a brute's lasts 75%),
    blows the mines under it (before the rock, so their blasts reach out),
    adds the rock and pushes every body out along
    the throw to the side it is on (one on the line goes to the player's
    side; the player goes to the side it threw from). The dummy is not
    pushed, and `separate` does not resolve it, so it stays on its spot in
    the rock. A stagger the crush earns by filling posture keeps its full
    length. Every enemy's route is dropped when the rock rises and again
    when it crumbles (`crumbleCave`), after `CAVEIN.life`. At most
    `CAVEIN.cap` stand at once; a new one brings the oldest down early.
  - **Execution.** The charge is jammed in and the body kicked (`e.kick`,
    moved by the `dead` case of `enemyUpdate`); a `G.pending` blast goes off
    where it lands. The boss and the dummy are not kicked; the blast goes off
    on them.
  - `resetRun` and `respawn` clear the rock, `G.caveins` and `G.mines`.
- The Riftwalker. A melee class with `reach` cuts (`v1`, `v2`) that land from
  about 5 m, a thrown shard (`v3`, a real shot), a tear that snaps shut
  (`vsnap`) and a step through a short rift (`vstep`, a lunge with no real rift, so it never triggers the trait).
  - **Rift ends** (tool) are entries in `G.rifts`, at most two, oldest
    first: `{ x, z, yaw, t, life, id }`, `yaw` facing the player when it
    opened. `openRift(x, z, yaw)` returns the end, or `"close"` or `"room"`
    when refused (a refused tool press spends nothing). A third end shifts
    out the oldest, so only the newer end counts for `"close"`;
    `riftsUpdate` closes ends after `RIFT.life`.
  - **Crossing.** `riftMove(o, ox, oz, r)` is the one transform: a mover
    whose path in the step crosses an end's line (within `RIFT.half` of its
    centre, from either face) comes out of the other end, offset, direction
    and `yaw` turned by `yaw_B - yaw_A + PI`, `r + 0.15` clear of the line,
    then through `resolve` (shots pass `r` 0 and skip it). `update` takes a
    snapshot (`riftSnap`) before anything moves and calls `riftBodies` after
    the enemies have moved; `projUpdate` calls `riftShot` right after a shot
    moves, before its wall and hit checks.
  - The player crosses in any state but `dead`, `execute` and `inspect`. The
    camera turns with them, a lock is kept, the dodge direction, knockback
    and aim turn too, and the trait applies: `RIFT.safe` of invulnerability
    and `p.riftBonus`, which `hitEnemy` spends on the next hit for
    `RIFT.bonus` more.
  - A regular enemy keeps its state, drops its route and then rests
    (`e.rest`, `RIFT.rest`): ends are air to it until it runs out, so a pair
    cannot hold a pack off for good. The boss, the dummy, a falling enemy
    and one in the air (`e.y > 0.3`) never cross.
  - A regular enemy's shot that comes out of a rift becomes the player's, as
    a parried one does. The boss's shots go through as if the tear were air.
  - Rifts never change the walkable field, sight or routes.
  - **Drop** (ability). `startDrop(x, z)` adds a hole to `G.holes` with its
    landing spot fixed then (`dropSpot`: under the end of an open pair
    further from it, or the spot itself). After `DROP.fuse`, `holesUpdate`
    sends every regular enemy over it to `dropEnemy`: it appears under the
    ceiling (`ceilAt`) over its spot in state `fall`, out of the fight until
    `landEnemy`, which hurts it by the height fallen (an `aoe` hit, so no
    ambush bonus), forces a stagger by the Sapper's rule, sets `e.rest` to
    the stagger plus `RIFT.rest` so it does not walk straight back through
    the far end, and hurts other enemies round it. Landings never hurt the
    player. **A falling enemy is skipped by** `hitEnemy`, `pickLock`,
    `aimYaw`, `aimRanged`, `explode`, the melee hit loop, the shot hit loop,
    the Starfall target, mines and tripwires, `separate`, `riftBodies` and
    `kill`'s relock.
    A new way of hitting or targeting an enemy must skip it too, and must
    skip a hidden enemy (`e.hidden`, see `enemies.md`) and an aloft one
    (`e.aloft`) as well; `grappleTarget` and `nearestStaggered` skip all
    three.
  - **Execution.** The enemy is killed, then dropped like a Drop (its body
    falls in the `dead` case of `enemyUpdate`) and lands in one blast
    (`DROP.exec`). The boss takes the execution in place; the dummy stands
    back up.
  - `resetRun` and `respawn` clear `G.rifts` and `G.holes`; both rebuild
    every enemy, so nothing is left falling.
- `G.insp` is set only while the player is in `inspect`. Anything that moves
  them out of it closes the plaque on the next update.

## Tests

- Run `tests/t18.mjs` after any change to plaques, Inspect, codes, unlocks or
  the interact and dodge bindings: `SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`.
  Its last step enters every real code in `tests/codes.local.json` at its
  plaque and skips when that file is missing.
- Run `tests/t19.mjs` on every device after any change to plaques by touch:
  `node tests/touch-all.mjs tests/t19.mjs hub`.
- The Enforcer's steps (bombs, grapple, shotgun, sniper execution), the
  Sapper's (slam, mines, wires, execution) and the Riftwalker's (reach,
  shard, execution) are in `tests/t6.mjs`.
- Run `tests/t21.mjs` after any change to rifts, Drop or the `fall` state:
  `SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke`. It works in a tunnel of
  cave 99; `along(t, d)` centres a point across the tunnel, because route
  points hug a wall.

## Known problems

- The Enforcer, the plaques and the codes are untested by hand. The sticky
  bomb's self damage and the grapple's reach were set without a playtest.
- The Sapper is untested by hand. Its numbers, the cave-in's size and how
  long rubble stands were set without a playtest. Rubble is drawn as a heap
  about head high, while it blocks sight and shots as a full wall.
- The Riftwalker is untested by hand. Its numbers, the reach, how long ends
  stay open, the rest time and Drop's fall damage were set without a
  playtest. Nobody can see through a rift; ends are drawn as glowing slits.
