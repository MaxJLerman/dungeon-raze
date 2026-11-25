# Player, moves and classes

## Player (`playerUpdate` in `06_game.js`)

- State machine in `playerUpdate`: `free`, `guard`, `attack`, `dodge`, `hit`,
  `gbreak`, `heal`, `execute`, `blink`, `grapple`, `inspect`, `held`, `dead`.
- **`held`.** A grabbing enemy calls `grabPlayer(e, { dps, tx, tz, speed })`
  and sets its own state to `hold`. It refuses (false) in the dodge's
  invulnerability, during `G.grabGrace`, and when the player is `dead`,
  `execute`, `blink`, `inspect`, `grapple` or already `held`. The player
  becomes `held` with `p.hold` (`{ by, t, tick, jolt, dps, tx, tz, speed }`),
  loses their lock and buffered press, and `heldUpdate` (in place of the rest
  of `playerUpdate`) drags them to `(tx, tz)` at `speed` and turns them to the
  holder. The numbers are in `HOLD`: the hold lasts `max` (2 s); each press of
  dodge counts `mash` (0.35 s) towards that, so mashing dodge breaks free
  early; every `tick` (0.5 s) it deals `dps * tick` through `hurtPlayer` with
  `atk.dot`. It ends when the time is up or the holder dies or leaves
  `hold` (that is checked before the tick, so a holder that is gone deals
  nothing more): `releaseHold()` gives `HOLD.safe`
  of invulnerability and starts `G.grabGrace` (`HOLD.grace`, 1.5 s, in which
  nothing may grab again) and swallows the press that broke free so it does
  not also dodge. `endHold()` (death) clears it and puts every holder back
  to `rec`. A hold shows the "Break free" prompt and its own pose. `riftBodies`
  skips a held player, and pausing does not end a hold. `resetRun` and
  `respawn` clear `G.grabGrace`.
- **`atk.dot`.** An attack with `dot: true` is damage over time. In
  `hurtPlayer` it is no perfect dodge, parry or block (invulnerability still
  stops it), and it gives no knock, hitstop or flinch, only a small shake and
  sparks. Any hit on a held player also leaves their state alone. A `dot`
  hit on an enemy (`hitEnemy`'s `o.dot`, the bloater's cloud) deals damage and
  posture only: no knock, flinch, focus, hit sound or Riftwalker bonus.
- `inspect` is a plaque close-up. `openPlaque(q)` sets it and `G.insp`
  (`{ q, k, dir, syms, stick }`, `k` running 0 to 1 over `INSPECT_T`), and
  `closePlaque(now)` ends it. `inspectUpdate` runs instead of the rest of
  `playerUpdate`. `camUpdate` blends to the plaque and ignores the mouse,
  and the pad does not turn the camera. `show()` closes it when the state
  leaves play, and `resetRun` and death clear it.
- **Water.** `playerUpdate` multiplies the move by `wadeMul(waterAt, WATER.slow)`
  after the knockback is added to the velocity, so walking, running, dodging
  and attack lunges all slow by the same factor. A dodge keeps `p.ddur` and its
  invulnerability, so it covers less ground in the same time. `p.dspeed` is
  the speed before the wade; the sprint-attack check reads it, so a sprint
  attack still starts the class dash while wading (`p.speed` is the slowed
  speed). Wading draws the body sunk by `WATER.sink` scaled by `waterAt`
  (`07_render.js`) and plays ripples and a wade sound. That depth is drawing
  only: collision, hits, shots and the camera stay on the flat floor.
- Presses are buffered for 0.3 seconds in `p.buf` so chained inputs feel
  responsive.
- Melee attacks aim with `aimYaw`, which snaps to the lock target or a nearby
  enemy. Ranged attacks aim with `aimRanged`, which follows the camera with a
  little assist.
- All damage to enemies goes through `hitEnemy`. All damage to the player goes
  through `hurtPlayer`, which handles invulnerability, perfect dodge, parry,
  block, guard break and class armour.

## Recipe: add or tune a move

Edit `MOVES` in `06_game.js`. Fields: `wind`, `act`, `rec` (seconds), `dmg`,
`post` (posture damage), `range`, `arc` (radians, `TAU` for all round), `lunge`
(distance moved), `stam`, `next` (the chained move), `anim`, `tilt` and `dir`
(slash arc shape), `heavy`, `lance` (straight thrust effect), and `blast`
(`{ d, r, dmg, post }`: an `explode` `d` metres ahead when the act starts,
in place of the melee hit), and `reach` (aims as far as `range`, drawn as a
cut out of a small tear beside the target; give it a narrow `arc`). A ranged
move has
`proj` instead of the melee fields: `speed`, `dmg`, `post` and `kind`, with
`life`, `big` and `heavy` optional. `pellets` fires that many shots at once,
`spread` radians apart. A `proj` move with a `lunge` slides the player
forward while it fires. If you use a new `anim` name, add its pose to the
`attack` case of `posePlayer` in `07_render.js`.

## Recipe: add a class

1. Add an entry to `CLASSES` in `06_game.js`, copying an existing one. Give it
   `hidden: true` if a plaque code unlocks it. `chain`,
   `heavy` and `dash` name moves; `tool.id` and `special.id` name behaviours.
2. Add its moves to `MOVES`.
3. If the tool or ability is new, add a branch to `useTool` or `useSpecial`.
4. Add a branch to `makePlayerFig` in `05_figures.js` and set `f.rim` and
   `f.tips`.
5. Add an idle arm pose and guard pose for it in `posePlayer`.
6. Add a case for it to `tests/t6.mjs` and run that script.

The class picker and HUD read `CLASSES` and need no changes.

## Known problems

- Balance is untested by hand. In bot runs the Fighter looks strongest and a
  pack kills a passive player in about seven seconds.
- Hiding and shooting with a ranged class is not prevented. An enemy that is
  hit runs to where the shot came from, which is the only counter.
- The Assassin's blink picks its own target when nothing is locked, which may
  not be the enemy the player meant.
