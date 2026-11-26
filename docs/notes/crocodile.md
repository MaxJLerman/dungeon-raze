# Old Sluicejaw, the D boss (`croc` in `06b_ebeh.js`)

**Old Sluicejaw** (`croc`, threat 2, 800 health, `boss`, `arena`,
`ownPhases`, `fell` "OLD SLUICEJAW FALLS") is D's boss, spawned in the
cavern's centre pool. Its attacks: `rear` (kind `"rear"`, no `trig`: only
surfacing starts it), the bite chain `b1` to `b3`, `tail` (a sweep
all round) and `roll` (kind `"roll"`, the death roll, below). It has `wade` 1, so water does not slow it. Its body
(`makeCrocFig`, `poseCroc`) is built from scratch, facing +Z: `f.spin` is
the body's centre, `CROC_H` up, and turns it about its long axis (`r[2]`:
the roll, on its back when dead) and round itself (`r[1]`: the tail
sweep); `f.hip` pitches the trunk, head and forelegs up onto the hind
legs, which hang off `f.spin` so they stay planted; `f.tail` is eight
tapering segments; `f.jaw` opens with positive `r[0]`; `f.body` is the
trunk. `f.headN` and `f.weapon` are markers for the eye glints and the
wind-up glow.

- **Modes.** `EBEH.croc.step` runs its fight in `e.mode`, with `e.modeT`
  the time left in a mode, and returns true in every mode but `land`, so
  the shared state machine runs only on land. The numbers are in `CROC`
  (`06b_ebeh.js`). An undefined mode is a fresh crocodile and gets
  `crocReset`. `wait`: hidden at its post; once `G.inBoss` it calls
  `alertE` (the boss bar shows while it is `aware`) and goes `under` for
  a time in `CROC.under`. `under`: hidden; it picks `e.spot` with
  `crocPickSpot` and swims to it along `crocPlan`'s path at `CROC.swim`,
  or faster when that is what it takes to be there when its time under
  is up, so a spell under never outlasts `CROC.under[1]`. The path comes
  from a search over `crocSwimNet` (water points 1 m apart with room for its
  body, in joined pieces). A spot in water not joined to its own (the moat
  and the centre pool) is reached by moving at once to that water's point
  nearest it, so no wake crosses dry floor. Once there and its time is up
  it goes `rise` for `CROC.warn`, hidden at the spot. Then it shows, and
  `crocSurface` hits a player within `e.r + 0.8` for `CROC.burst` through
  `hurtPlayer`, puts them `e.r + p.r + 0.3` clear (`resolve`d) and starts
  `rear` in `wind`, with `e.wet` set and `e.landT = CROC.land`. `land`:
  `landT` runs down but in `stagger`, and entering a stagger adds
  `CROC.stagBonus`. With the player in the water (`waterAt` 0.5 or more)
  and further than the least `reach` of its attacks with a `trig` (the
  bite's 3.6, since its lunges stop at the shore) plus `p.r`, `e.outT`
  counts up, through its attacks and recoveries but not a stagger, and is
  0 otherwise. At `landT` 0 or `outT` `CROC.reachT` (3 s), in `chase` or
  `rec`, it goes `dive`: through
  `eStep` to the nearest shore (4 s at most; a stagger puts it back in
  `land`), then `under` (`crocDive` starts it). At a mark it goes `leap`,
  `tunnel` and `drop` instead (the tunnel phase, below). Leaving the
  cavern or the player dying, in any mode, and the shared give-up (state
  `return`) call `crocReset`: full health, `e.marks` 0, `wait`, hidden at
  its post, unaware, not aloft or safe, `y` 0, no `e.tun`, `G.bossSeen`
  false, and every chunk of the falling ceiling gone with its rock (by
  id, so a cave-in standing elsewhere stays), and every fall bloater
  taken out of `G.enemies` (below). Plates already thrown fly on.
- `crocShores(e, w)` (cached on `e.shores`) is every water point on a
  1 m lattice centred on the cavern with `fieldAt` at least `e.r` and dry
  footing within 3 m (`crocDry`: a 0.5 m lattice in a clear line).
  `crocPickSpot` takes, of those still clear of rubble and with dry
  footing beside them, at least `CROC.minNew` from `e.lastSpot` and
  `CROC.near` from the player, the nearest to the player. With the player
  in the water the water is its ground: it takes the `crocSwimNet` point
  nearest the player, at any distance from them and any but the last
  spot, with dry footing within `CROC.wetDry` (6 m, the climb-out's
  reach), so it comes up under or beside them and the burst lands. Such a
  spot is a new object with `R` 6, the radius its rise-time rubble check
  uses (3 for a shore). A spot that rubble covers while it swims or rises
  is dropped and another picked.
- `crocFoot` (its `foot` hook): any point in `wait`, `under` and `rise`;
  in `dive` room for its body; in `land` room for its body and dry floor
  unless `e.wet`. While `e.wet` and in none of `wind`, `act`, `hold` or
  `stagger`, the step walks it onto the nearest dry footing and clears it.
- The `rear` hooks: at the end of the wind a red warning ring goes down
  `CROC_SLAM_AHEAD` (1 m) in front of the dry footing point nearest the
  player within 3 m of the spot, centred on `e.rhx`, `e.rhz`; over the
  act it moves there through `eStep` and turns to the ring, and at the
  end it hits the player within `atk.radius` of the ring's centre,
  unblockable, unless the burst already hit them.
- **The death roll** (`crocRollAct`, `crocRollStep`, `crocRollSpot`).
  Over the act it lunges through `eStep` until it is against the player,
  and a player in reach, in its arc and in sight takes `atk.dmg` through
  `hurtPlayer` and then `grabPlayer` toward `crocRollSpot`, at
  `CROC.dragSpeed` (4 m/s) for `CROC.rollDps` (12) a second. On a grab
  it is in `hold` with `e.rolling` and `e.wet` set, and each step moves
  it round the player to beside the line of the drag and along with
  them, never into them, through `eStep`, drawn turning over and over.
  `crocRollSpot(e, c)`: the water point nearest the player that they can
  be dragged to in a straight line with room for their body all the way,
  and no further than `HOLD.max * CROC.dragSpeed - CROC.rollIn` (6 m), so
  the whole drag fits in one hold; then `CROC.rollIn` (2 m) further along
  that line, walked back until it is such a point; the player's own spot
  when there is none. When the hold
  ends, however it ended, `e.rollCD = CROC.rollCD` (8 s), a holder still
  in `hold` goes to `rec`, and the `e.wet` climb-out walks it back onto
  dry floor (within 3 m, else 6 m) before the shared states run again.
  The roll stays in the same land phase: `landT` keeps running through it.
- `atkOk`: never `rear`; never `roll` while `e.rollCD` is above 0; `b1`
  and `roll` only with the player within 1.2 rad of its facing; `tail`
  only past 1.9 rad. Its `chase` hook starts a
  planned `tail` at once, without turning to face the player first.
- **The marks.** `e.marks` (0 to 3) is how many of its marks, at 75%,
  50% and 25% of `def.hp`, it has passed; `crocNextMark(e)` is the next,
  `def.hp * (1 - 0.25 * (marks + 1))`, or 0 once all three are.
  `crocFloor(e)` is the least health a hit may leave: the next mark, and
  in `leap`, `tunnel` and `drop` (`CROC_ALOFT`) the higher of that and
  `e.tun.hp0 - CROC.tunCap` (100), so one tunnel phase takes at most
  `tunCap` off it from every source and the next mark is always reached
  on land. No hit takes it past the floor: its `hit` hook caps the damage
  and its `hpFloor` hook holds the health there after the multipliers,
  so melee, shots, blasts, mines, clouds and the execution (which goes
  through `hitEnemy`) all stop at the mark. Posture lands whole on land;
  in `CROC_ALOFT` the hook makes it 0, so nothing staggers it up there
  but the knock-down. At the start of
  each `land` or `dive` step with the health at the mark, unless the
  player is executing it (`p.state` `execute` with `p.exT` it), so the
  execution plays out first: `e.marks++`, a hold of its ends through
  `releaseHold()` (as if it ran out: `HOLD.safe` and the grace), a roll
  ends with `e.rollCD = CROC.rollCD`, a stagger's posture empties, and
  `crocLeap` drops its attack and starts the tunnel phase. Once
  all three are passed a hit can kill it, and `kill` clears D.
- **The tunnel phase** (`crocLeap`, `crocTunnelStep`, numbers in `CROC`).
  `crocMouthPlan(e, w)` gives `{ list, n }`: 1 to 4 distinct mouths of
  `world.wallTunnels` (at most all of them) in a random order, and the
  plates at each, `n[k]` 1 or 2 when `e.marks` is 1, else 1 to 4. It is
  aloft (`e.aloft`, see `enemies.md`) in all three modes. `leap`: `safe`, it
  flies from where it stood to the first mouth over `CROC.leapT` (0.8 s),
  arcing `CROC_LEAP_ARC` above the line. At a mouth (`crocMouth`) it stands
  at the mouth pulled `CROC.mouthIn` (1 m) toward the centre, so a shot
  meets its body before the wall, `e.y` the mouth's `y`, facing the
  player. `tunnel` runs `e.tun = { list, k, n, sub, t, plates, hp0,
knocked, ... }`: in sub `show` the first plate comes `CROC.throwWind`
  (0.5 s) after it shows, the rest `CROC.throwGap` (1.2 s) apart, and it
  stays `CROC.linger` (1 s) after its last; then the next mouth is sub
  `warn` for `CROC.mouthWarn` (1 s), hidden there, while `drawMouths`
  pours foam over that mouth's lip and lights two eyes in it. After the
  last mouth, `drop`: `safe`, it falls over `CROC.dropT` (0.6 s) to the
  `crocSwimNet` point nearest the mouth, then goes `under`, not aloft, `y`
  0, `e.tun` null. A plate (`crocPlate`) is a real enemy shot in
  `G.projs` (`own "e"`, `src` it, `kind "plate"`, `plate: true`,
  `CROC.plateDmg` 14 at `CROC.plateSpeed` 15), aimed at the player,
  parried and blocked like any shot, falling from the mouth's height to
  `CROC_PLATE_Y` over its flight (`vy`, `yTo`), and recording the mouth
  it came from (`mouth`, an index into `wallTunnels`). It starts
  `e.r + 0.3` toward the player, or at them when they stand nearer (right
  under the mouth), so it reaches them there too. `hp0` is its health as
  the phase began, for the cap (see the marks).
- **The knock-down** (`crocKnock`). A plate parried back (`plate` and
  `mouth` in the hit's options) that hits it in `tunnel`, in sub `show`,
  at the mouth it was thrown from, with `e.tun.knocked` not yet set,
  sets `knocked` and starts a `drop` (`safe`, aloft) over `CROC.dropT`
  to `crocDry`'s dry footing within `CROC_KNOCK_R` (9 m) of the mouth's
  point nearest it (about 5 m out, past the fall pool), where it lands
  in `stagger(e)` (open to an execution), mode `land` with
  `e.landT = CROC.land`, `y` 0, not aloft; the land fight carries on
  from there and `e.tun` stays, `knocked`, until the next leap. So one
  phase has at most one knock-down, and a plate from a mouth it has left
  is only a hit. While a plate from the mouth it stands at is still in
  the air, on its way out or parried back, it does not move on from that
  mouth, for at most `CROC.plateWait` (4 s) past the linger, so a parry
  from across the cavern still knocks it down. A parried plate can still
  arrive after it has moved on (a parry late in that wait, or a plate
  bent by a rift), and is then only a hit. A parried plate hits nothing
  on its way back but the crocodile, so a fall bloater at the shore on
  its line does not eat it.
  `poseCrocUp` (`05b_dbodies.js`) draws
  it lying in the outlet, `CROC_PERCH` out from the wall on the outlet's
  floor with its head over the lip, crouching with the head drawn aside
  before each plate and flinging it up and out as the plate flies; the
  tail lashes inside the outlet, out of sight. Knocked down, it rolls
  over once as it falls and lands flat.
- **The falling ceiling** (`crocCeiling`, run by its step in every mode
  but `wait`). From the 50% mark (`e.marks` 2), every `CROC.fallEvery`
  (6 to 10 s, `e.fallT`, set by `crocReset`) a chunk starts to fall at
  `crocChunkSpot(e, w, p)`: of 40 random points 3 to 8 m from the
  player, the first inside the cavern with no water within `CROC.rockR`
  (1.4 m; `crocChunkDry` checks every grid point within `rockR + 1.5`,
  so `waterAt` is 0 all over the disc), `fieldAt` at least `rockR +
0.5`, `CROC_CROSS_KEEP` (4 m) from the entrance crossing, `e.r +
rockR` from it and `2 * rockR` from every other chunk; none tried
  again half a second later. `crocCrossing(e, w)` (cached on `e.cross`)
  finds the crossing from the world: the longest arc of the circle
  through the middle of the moat that is not all water (`waterAt` below
  1), as `{ ax, az, bx, bz, hw }`, its middle line from the moat's inner
  edge to the wall and its half width (2 to 3 m). A chunk is an entry of
  `G.chunks`, `{ x, z, t, id, yaw, seed, ceil }` (`crocDropChunk(x, z)`
  starts one; tests force them with it): `t` counts down its warning,
  `CROC.fallWarn` (1.4 s), and `id` is its rock once it lands (0 till
  then). Landing (`crocChunkLand`): with `CROC.rockCap` (5) heaps
  standing the oldest gives way first; the rock goes in with `addRock`,
  a capsule `CROC_CHUNK_HL` (0.4 m) either side of the centre of radius
  `rockR`; a player within `CROC.fallR` (1.6 m) takes `CROC.fallDmg`
  (20) through `hurtPlayer`, unblockable (a dodge's invulnerability
  avoids it); and every body the rock reaches (its `fieldAt` fell below
  the body's radius as the rock went in) is put out of the rock, out
  from its line and `resolve`d, then, if still short of room by more
  than 0.1 m (a pocket between heaps that `resolve` cannot climb out
  of), moved to the nearest point with room for it (`crocFree`, rings
  out to 10 m), for the crocodile the nearest it may stand on, whose
  `okx`/`okz` are set only on a spot `footOk` allows. A body the rock
  does not reach is not touched, so one leaning on a wall elsewhere
  stays put. It never hurts an enemy. Every route is dropped as for a
  cave-in. The crocodile's own checks keep it out of rubble: a
  surfacing spot or its dry footing under rock is picked again
  (`under`, `rise`), the climb-out and the slam's footing come from
  `crocDry`, which needs room, and `keepFooting` puts it back on its
  footing. Its death (`death` hook) keeps the heaps that have landed
  and drops the chunks still in the air; a reset takes them all away.
  `drawDust` (`07b_dfx.js`) draws the warning: grit pouring from the
  roof through a haze, the rock's shadow growing on the floor and a ring
  at `fallR` with a second closing in to land as they meet;
  `drawChunks` (`07_render.js`) draws the rock falling over the last
  0.3 s and the heap, built by the cave-in's `makeRubble` with wider
  rows (`CHUNK_ROWS`).
- **Bloaters down the falls** (`crocBloats`, run by its step in every
  mode but `wait`). Every `CROC.bloatEvery` (14 s, `e.bloatT`, set by
  `crocReset`) one comes down if fewer than `CROC.bloatCap` (2) fall
  bloaters are alive; the timer starts again either way. `crocBloat(e,
w, i)` makes it under wall tunnel `i` (a random one when not given):
  at `crocFallSpot(w, m)`, the point nearest the foot of the mouth's fall
  (`SEWER.mouthOut + 1.1` out from the mouth, where `drawSewerSet` draws
  it landing), on rings 0.25 m apart out to 4 m, with `waterAt` at least
  0.5, `fieldAt` at least the bloater's radius and `bodyAt` a body, so
  `waterFoot` holds for it there. It is a normal bloater from `makeEnemy`
  with `e.fromFall` and `e.inArena` (see `enemies.md`) set, woken at once
  (`alertE`, quiet), with a splash. Its cloud hurts the crocodile like
  any hit, through its `hit` hook and floor. `crocClearBloats`, called by
  `crocReset`, takes every fall bloater, alive or dead, out of
  `G.enemies`, marked `dead` and `gone` so a lock or a bomb on one lets
  go: no cloud, no reward, no kill. Its death leaves them; `respawn`
  rebuilds the enemies without them.
- `drawWakes` (`07b_dfx.js`): under, a V of foam back from its heading
  and bubbles over it; rising, bubbles boiling up and rings widening on
  the water. The foam and bubbles are drawn only where `waterAt` reads
  0.5 or more. Under, in water and within `CROC.shadowR` (5 m) of a
  shaft's centre (`world.shafts`), its shadow: the shaft's light on the
  water round it, two soft additive `R.ribbon` bands in the shaft's
  colour (`SEWER_SKY`) out from the outline of its body (an ellipse 0.9
  m in half width and 2.7 m in half length along its heading, 0.6 m
  back of its middle), 0 to 1.4 m and 0.6 to 3.2 m out; and one `R.blob`
  on that outline darkening the body. Additive effects are drawn after
  blobs, so the light is kept off the body rather than drawn under it.
  Both are at full strength out to `CROC_SHADOW_FADE` (1.5 m) short of
  `shadowR` and fade to nothing at it, from the nearest shaft. The shafts stand over the dry ring, so the water in reach is
  the edge of the centre pool or the moat nearest them, 2.8 to 4 m from
  a shaft at the nearest over seeds 1 to 12.

## Tests

- Run `tests/t25.mjs` after any change to the crocodile, its place in the
  cavern or the boss flags (`arena`, `ownPhases`, `fell`, `atkOk`):
  `SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`. It checks the cavern
  holds one crocodile and no Warden over seeds 1 to 12, poses its body in
  every state and attack, and keeps a cavern frame with it drawn within
  cave 99's triangles (the renderer counts only the world's, so the test
  adds the figure's). Then its modes on seed 5: waiting until the player
  enters, nothing finding it under, the spot and warning, the burst on a
  player on the spot, the rearing slam landing on its ring and not past
  it, a player standing in the centre pool hit over a cycle and a minute
  (it comes up at them and leaves land early), a sticky bomb dropping off
  as it goes under, the land clock and the stagger bonus, the tail for a
  player behind it, the reset on leaving and on `respawn`, and no spot in
  rubble. Then the death roll: the drag into the water and its damage,
  mashing free and the cooldown, climbing back out in the same land phase,
  a drag target past rubble, and a death in the roll. Then the marks: no
  melee hit, cloud tick, blast, shot or berserk hit passes one, reaching one
  breaks off a bite and leaps with nothing landing after, ends a death
  roll with the player freed, hits all through a tunnel phase stop at the
  cap below that mark, the three fall at 600, 400 and 200 and then
  it dies and D is cleared, and an execution at a mark stops there and
  plays out before it leaps. Then a whole D run: from the hall with E
  cleared, through the D portal into a sewer, onto the cavern's ring, hit
  to each mark once it is up and killed, D cleared, the gate out open and
  "OLD SLUICEJAW FALLS" shown. Then the tunnel phase: the leap to a mouth,
  the plan's counts, real plates hitting a pinned player for
  `CROC.plateDmg` (and the chip when guarding), the warning before each
  later mouth, the drop back into the water unhurt, nothing but shots
  reaching it at a mouth (melee, a blast, the grapple, lock, `aimYaw`,
  execution, Drop, a mine, a cave-in, `separate`; a bolt, the Mage's orb
  and `aimRanged` still do), and the reset on leaving mid phase with a
  plate in flight.
  Then shots and the knock-down: a bolt hurts it at a mouth and passes
  through it hidden; with berserk and a shot every step two phases each
  lose exactly `CROC.tunCap`, stop above the next mark and add no
  posture; a plate reaches a player right under the mouth; a parried
  plate climbs back to the mouth and knocks it down onto dry floor of the
  ring, staggered, and so does a real parry 30 m from the mouth, and one
  with a fall bloater on its line, which it passes unhurt; a
  parried plate from a mouth it has left only hurts it, and none after
  the knock-down changes anything; it waits at its mouth for a plate
  parried back from it, and a plate of its own that never arrives holds
  it there `CROC.plateWait` and no longer; knocked down, it can be executed and later dives on its land
  clock. Then the falling ceiling: the crossing it keeps clear of is the
  entrance's over seeds 1 to 12; nothing falls before the 50% mark; from it
  chunks fall over 60 s only on the dry ring (no water within `rockR`,
  inside the cavern, 4 m from the crossing, 3 to 8 m from the player,
  with the player a while beside the crossing), each `fallWarn` after it
  appears and into rock; one on the player hurts for `fallDmg` (a dodge
  avoids it, a guard does not) and leaves them out of the rock, and one
  landing on the crocodile neither hurts it nor leaves it in rock; a
  landing does not move a rat or the player leaning on the wall 35 m off
  (`DF.crocChunkLand`); at
  most `rockCap` heaps, the oldest going first; over 60 s with heaps
  forced on its surfacing spots and their footing, its roll's target and
  drag line, its climb-out and on itself, it never stands in rock on
  land, and the player is never inside rock and has room after every
  landing; leaving and `respawn` clear the heaps and
  leave other rock; its death leaves the landed heaps. Then the fall
  bloaters: over 45 s of fight with the player across the cavern from the
  falls (further than a bloater sees), exactly two come down, the first
  at `bloatEvery`, each a bloater on its footing in water within 6 m of a
  mouth and of the wall, aware, `inArena` and hunting throughout, never
  more than `bloatCap`; one killed is replaced at the next tick; a plain
  bloater there is not woken; one popped beside it on land takes it down
  over the cloud's ticks, and from just above a mark to the mark exactly;
  leaving takes them all out with no cloud, kill, focus or tool charge
  and drops a lock on one, and `respawn` leaves none. Then the shadow:
  over seeds 1 to 12 some point of the real swim net (`DF.crocSwimNet`)
  is within `shadowR` of a shaft; at the swim-net point nearest a shaft
  one more blob is drawn in a frame than in the centre pool, along its
  heading, with two more light bands, fainter at a point further from the
  same shaft, none of either on the dry floor under the shaft and none
  while it rises. Shots go to
  `shots/t25-croc-*` (idle, rear, bite, tail, roll), `t25-wake`,
  `t25-rise`, `t25-roll` (mid-roll), `t25-mouth-warn`,
  `t25-mouth-throw`, `t25-knock` (falling, knocked down) and
  `t25-ceiling` (a warning, a chunk falling and a heap) and
  `t25-shadow` (under at the swim-net point nearest a shaft, heading for
  the shore, its shadow at full strength; the player's own blob is left
  out of that shot): look at them.

## Known problems

- The crocodile is untested by hand; every `CROC` number and its moveset
  were set without a playtest: `CROC` (3 to 5
  s under, 7 m/s swimming, the 0.9 s warning, 18 burst damage, 10 s on land,
  3 s per stagger, spots 8 m apart and 4 m from the player, the roll's 12 a
  second, 4 m/s drag, 2 m into the water and 8 s cooldown, the 3 s before
  it leaves land for a player in the water out of its reach, and coming up
  under a player in the water at any spot but the last) and how the wake,
  warning and roll look, and the marks at a quarter of its health each.
  Whether a player in the water is punished too hard is a question. The
  tunnel phase's numbers (`leapT`, `mouthWarn`, `throwWind`, `throwGap`,
  `linger`, `plateWait`, `dropT`, `mouthIn`, a plate's 14 damage at 15
  m/s, the 100 cap) and its
  look were set without a playtest. Knocked down, it lands on the first
  dry footing past the fall pool, right at the shore. At a mouth its tail is inside the outlet, so the throw
  reads as a toss of the head more than a tail whip. The falling
  ceiling's numbers (a chunk every 6 to 10 s from the 50% mark, the 1.4 s
  warning, 20 damage within 1.6 m, rock 1.4 m in radius, 5 heaps at
  most, 3 to 8 m from the player, 4 m from the crossing) and its look
  were set without a playtest. A heap is drawn about 2.6 m across and
  head high over a rock 2.8 by 3.6 m, and like the Sapper's rubble it
  blocks sight and shots as a full wall. A player or enemy caught in a
  pocket between heaps as one lands is moved to the nearest open point.
  Pushed into a gap between heaps narrower than its body by other means
  (a drag, a knock), a body can stay wedged a little short of its radius,
  as `resolve` leaves it in any such gap. A bloater comes down the falls
  every 14 s with at most 2 alive (`bloatEvery`, `bloatCap`), set without
  a playtest; while the player is in the cavern they know where the
  player is and never give up, but they are slow (1.2 m/s) and bound to
  the water they came down into. Whether their clouds are a real way to
  hurt the crocodile is a question.
- At a mouth, an ordinary player shot is stopped by a bloater on its line,
  because shots hit in 2D. Only a parried plate passes over it.
- From the 50% mark, a heap stops plates and shots like a wall, including a
  parried plate on its way back to the mouth.
- Fall bloaters give full kill rewards, one every 14 s, for as long as the
  fight lasts. Whether that is too generous is a playtest question.
- The crocodile's shadow shows in water within `CROC.shadowR` (5 m) of a
  shaft, full out to 3.5 m (`CROC_SHADOW_FADE`); both were set without a
  playtest. The shafts stand over the dry ring, so the water in reach is
  only the edge of a pool nearest a shaft (7 to 21 swim-net points per
  seed over seeds 1 to 12); the light it shows against there is drawn
  for it, round its body. Swimming along the shore, part of it lies under
  the pool's kerb.
- `tests/t25.mjs` has one flaky check, "rubble never traps it". Now and
  then it fails and passes on a rerun, and it failed the same way on the code
  from before the big cave branch. The cause is not investigated.
