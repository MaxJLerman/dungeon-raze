# The Riftwalker

Design agreed with the owner on 2026-11-18. Read `CLAUDE.md` first for the
conventions (axes, facing, bindings, touch layout, tests), then
`2026-11-17-plaques-and-enforcer-design.md` for the plaques and codes, and
`2026-11-18-sapper-design.md` for the class this one follows.

## Why

The hidden classes reward curiosity and give strategic players more to think
about. The owner described the portal user as one who "fights with the cave
itself, opening rifts to reposition and redirect shots, or dropping enemies".
The Sapper thinks about a fight before the pack arrives; the Riftwalker
thinks about the shape of the cave: where things are, and where they could be
instead. It is the third and last of the plaque classes.

## Goals

1. The Riftwalker, a complete playable hidden class, with the kit below.
2. Its plaque in the hall goes live: an epithet, the empty marks, a code that
   unlocks it. After this, no plaque is sealed.
3. **Paired rifts** (the owner's choice). The player opens two ends. Anything
   that passes through one end comes out of the other: the player, regular
   enemies and shots.

## Non-goals

- Enemies that know about rifts. They stumble into them; they never route
  through one on purpose or avoid one.
- Seeing through a rift. The renderer has no textures and no second camera
  pass, so an end is drawn as a glowing tear, not a window.
- Rifts for any other class, or any change to the other seven classes, the
  controls or the touch layout.

## Anti-goals

- **Anything owned.** The portal gun and its paired blue and orange ovals are
  Valve's. The Riftwalker has no gun called a portal gun, and its ends are
  jagged tears in the air, never blue and orange ovals set into walls.
- **A plain code in the repo**, as for the other two: only the hash is
  committed; the plain code lives in the ignored `tests/codes.local.json`.
- **Anyone stuck.** Nothing ever comes out of a rift inside rock or inside
  another rift's line, and no enemy is carried round a pair for good.
- **Rifts as a special case for readers of the field.** Rifts do not change
  the walkable field, sight or routing. They act only where things move.

## Constraints

- Single function scope across `src/`; declare each name once.
  `node build.mjs` after every change.
- No assets. Tears and effects come from the renderer's primitives
  (`R.ribbon`, `R.sprite`, `R.ring`, `R.blob`) and small meshes.
- No new touch or pad buttons. The kit uses the Attack, Heavy, Tool and
  Ability slots.
- Works in the cave and the hall alike.

## The kit (agreed with the owner)

| Slot | What it does |
| --- | --- |
| Tool | **Rift ends**, 4 charges. Each press opens one end where the player aims, a standing tear in the air facing the player. Two ends make a pair. A third press replaces the older end. An end closes about 20 s after it opened |
| What passes | The player, regular enemies, and every shot (the player's and the Spitter's). See "Passing through" |
| Ability | **Drop**, costs focus. A hole opens on the floor under a pack. Regular enemies over it fall out of the ceiling above the other end of the pair and land hurt and staggered. With no pair open they fall back onto the same spot |
| Light chain | Rift strikes: short blade cuts that come out of a small tear beside the target, landing from up to about 5 m. The third hit throws a blade shard, a real shot that passes through rifts (builder's addition, so the class has a shot of its own to redirect) |
| Heavy | A tear snaps shut on the target: one hard cut with high posture damage |
| Sprint attack | Steps through a short rift a few metres ahead and cuts |
| Execution | The floor opens under the staggered enemy. It drops out of the ceiling above the other end of the pair (or the same spot with no pair) and hits the ground hard, hurting what is near where it lands |
| Trait | The player cannot be hit while passing through a rift, and the next hit within 2 s does extra damage |

The class is melee (`ranged` unset), so attacks aim with `aimYaw`. The light
chain reaches further than any other melee chain; that reach is the class.

Rules the owner agreed with the table:

- Enemies stumble into rifts but never use them on purpose. A rift in a
  pack's path splits the pack.
- The boss and the training dummy never pass through a rift and are never
  dropped. A boss crossing an end walks through the tear as if it were air.
  This keeps the boss fight intact, as the Sapper's kick does.

## How it works (approach)

### Approaches considered

1. **An end is a short line on the floor plan; anything that crosses it is
   moved.** Chosen. Each step, the game checks whether a body or shot has
   crossed an end's line, within its width, and moves it to the other end
   with its direction turned to match. One check, written once for bodies
   and once for shots, so the player, enemies and shots all behave the same.
2. A trigger zone round each end. Rejected: it cannot tell the faces apart,
   and whatever comes out beside the far end is sent straight back.
3. Rifts written into the walkable field, as the Sapper's rubble is.
   Rejected: that only pays if enemies route through rifts, which is a
   non-goal.

### Ends

- An end is `{ x, z, yaw, t, life }`. `yaw` faces the player at the moment it
  opened. Its line runs across that facing, `RIFT.half` either side of the
  centre (about 0.9 m, so about 1.8 m wide); it is drawn about 2.2 m tall.
- **Placing** (builder of this doc's call): along `cam.yaw`, up to about 8 m
  ahead and at least 2 m, stopping short of walls and rock, at a spot where
  the whole line has room (the field at least about 1.0 at the centre and
  clear along the line). An end closer than about 3 m to the other open end,
  or with no room anywhere along the aim, is refused with a short message
  and costs no charge.
- At most two ends are open. A third press closes the older one and opens
  the new one. A pair works only while both ends are open. An end that
  closes on its own leaves the other one open but unpaired.

### Passing through

- **Both faces work.** Let `A` be the end crossed and `B` the other. Whatever
  crosses `A` comes out of `B` with its position offset and its direction
  turned by the same angle, `yaw_B - yaw_A + PI`, on whichever side of `B`
  that turn puts it. In the player's terms: something moving away from where
  the player stood when opening `A` comes out of `B` heading toward where the
  player stood when opening `B`; something moving toward the player through
  `A` comes out of `B` heading the way the player looked when opening `B`.
- The lateral offset along the line is kept (turned with the rest), so a body
  that enters near one edge leaves near the matching edge.
- The mover is set just clear of `B`'s line on its exit side (its radius plus
  a little), then put through `resolve`. A short per-mover cooldown (about
  0.25 s) stops a second crossing from the same step.
- **Bodies:** the crossing is judged on the body's centre, between where it
  was at the start of the step and where it is after moving. A body's facing
  turns with it. For the player, `cam.yaw` turns by the same angle and the
  camera snaps behind them at the exit; a lock on an enemy is kept.
- **Enemies:** any regular enemy, in any state. It keeps its state; its stored
  route is dropped so it asks for a new one from where it came out. An idle
  enemy that wanders through stays idle and walks back to its post as usual.
  The boss and the dummy never cross.
- **One trip, then a rest (owner's decision).** An enemy that has just come
  out of a rift gets a timer of about 3 s (`RIFT.rest`). While it runs, every
  end is air to that enemy: it walks through tears and nothing happens. When
  the timer ends, rifts work on it again. The timer is on the enemy, not the
  end, so other enemies still cross the same end meanwhile. This is what
  stops a pair from holding a pack off forever: an enemy is moved once, then
  comes at the player on foot. The player and shots have no such timer (a
  shot leaves heading somewhere new and does not come back; the player
  chooses where they walk).
- **Shots:** judged on the segment the shot moved along that step, before the
  wall and hit checks for that step. **A Spitter shot that comes out of a
  rift becomes the player's** (builder of this doc's call, the same as a
  parried shot): it hurts enemies and not the player. The player's own shots
  stay the player's.
- **The boss's shots never pass** (builder of this doc's call). The Warden's
  phase-two volley goes through a tear as if it were air, like the boss
  itself, so a pair cannot turn the volley back on it. Only shots from
  regular enemies, and the player's own, cross.
- **Sight, routes and the field** are untouched. Nobody sees through a rift.
  An enemy that comes out of `B` sees the player, or not, from where it is.
- Into and out of the boss chamber: the existing rules apply by position. A
  regular enemy that ends up in the chamber gives up as it does today.

### Drop (the ability)

- Aimed like the Sapper's cave-in: at the lock target if there is one in
  range, otherwise along `cam.yaw` about 9 m, short of walls.
- After a short fuse (about 0.5 s, the hole glowing on the floor), every
  regular enemy whose body is over the hole (radius about 2.2 m) falls. The
  player never falls.
- **Where they land:** spread round the point under the ceiling above `B`,
  the end other than the one nearer the hole, if a pair is open; otherwise
  round the hole's own centre. Each landing spot must be walkable for that
  body; they are spread so they do not land in one place.
- **The fall:** each enemy appears just under the ceiling (`world.ceilAt`
  there, less a little) and falls under gravity. While falling it cannot
  attack, holds no token and cannot be locked or hit; it is out of the fight
  until it lands.
- **Landing:** damage that grows with the height fallen, then a forced
  stagger by the Sapper's rule (`stagger(e, k)`, a brute's lasting 75%),
  unless the landing killed it. A small impact round the landing hurts other
  enemies nearby (builder of this doc's call), so a pack can be dropped onto
  another pack. Landings never hurt the player.
- The boss and the dummy are never dropped. In the hall, Drop on the dummy
  opens the hole and nothing falls.

### Execution

- The floor opens under the staggered enemy and it falls, landing as Drop's
  fall does (over `B` if a pair is open, otherwise the same spot), and dies
  on landing. The landing is a blast that hurts enemies near it.
- The boss is not dropped: it takes the execution damage where it stands
  (120, as today) with a rift effect. The dummy takes it and stands back up,
  as with every class.

### The trait

- While a crossing happens and for a short time after (about 0.4 s), the
  player cannot be hit (through `hurtPlayer`'s invulnerability).
- The first hit the player lands within 2 s of coming out of a rift does
  extra damage (about +50%). One hit, then it is spent.
- Only a real crossing of an end counts. The sprint attack's short rift is
  a look, not an end, so it gives neither the invulnerability nor the bonus
  (builder of this doc's call: otherwise every sprint attack would be a safe
  cut at +50%, and the dash would outclass the rest of the kit).

### Look and sound

- An end is a jagged vertical tear: ribbons and sprites in the class colour
  round a dark centre, flickering, with the two ends of a pair tinted a
  little differently so the player can tell them apart. Paired ends show a
  faint thread between them on the ground (builder may drop it if it reads
  badly). An unpaired end looks dimmer. An end closing shrinks over its last
  second.
- A crossing flashes both ends. The Drop hole is a dark disc with a glowing
  rim; the fall shows the body coming out of a small tear in the ceiling.
- A class colour that differs from the seven in use: magenta, about
  `[0.95, 0.3, 0.75]` (no blue and orange pair).
- An original figure: a long, close coat with glowing jagged seams like the
  tears, a hood, a device on the left forearm that opens rifts, a short
  curved blade in the right hand. A new branch in `makePlayerFig` with
  `f.rim` and `f.tips`, idle and guard poses, and poses for any new `anim`.
- Sounds synthesised in `04_audio.js`: a tear opening, a crossing whoosh, a
  tear closing, the hole opening, and the landing thud (the existing
  `SFX.thud` may serve).

### Clean up

- `resetRun` and `respawn` clear every end, every hole and every falling
  enemy (falling enemies are put down where they would land).

## The plaque and the code

- `hubPlaques()` gives the Riftwalker plaque `cls: "riftwalker"`.
  `PLAQUE_TEXT.riftwalker` becomes an epithet the builder writes, in the style
  of the other two.
- The builder chooses the code: 8 to 10 symbols from the seven, at least 5
  different, no symbol three times running, sharing no four-symbol opening or
  ending with either existing code. It goes to the owner in conversation and
  into `tests/codes.local.json`; only its hash and length go into
  `SHIPPED_CODES`.
- No plaque is sealed afterwards, so `tests/t18.mjs`'s step that checks a
  sealed plaque takes nothing must make its own sealed plaque (for example
  by setting one plaque's `cls` to `null` for the step and restoring it).

## Numbers

Health, stamina, damage, reach, ranges, fuse, focus cost, fall damage and
timings are the builder's, aiming for a lighter, quicker melee class than the
Fighter (between the Assassin and the Fighter). Balance is untested by hand
across the game and the class will be tuned in playtest.

## Testing

- **Rifts (new script, smoke mode):** on a hand-built corridor through
  `DF.fieldFns` or in a cave, for the crossing rule itself:
  - a body crossing either face comes out of the other end on the side and
    heading the turn predicts, with its lateral offset kept and the field at
    least its radius where it lands;
  - the player's `cam.yaw` turns with them and a lock is kept;
  - nothing crosses back in the same step;
  - with a pair either side of the player, an enemy that crosses once walks
    back through the other end as air during its rest and reaches the
    player; after the rest it crosses again; a second enemy crosses the same
    end while the first is resting;
  - an enemy that stumbles through keeps its state and has its route
    dropped; the boss and the dummy walk through the tear as air;
  - a Spitter shot through a rift becomes the player's and hits an enemy;
    the shard passes through;
  - an unpaired end does nothing; an end closes after its life; a third end
    replaces the older; ends too close together or with no room are refused
    without spending a charge;
  - Drop with a pair lands the pack over the other end, staggered (a brute
    at 75%), falling enemies cannot be hit, landings never hurt the player;
    Drop with no pair lands them on the spot; the boss and the dummy stay;
  - `resetRun` and `respawn` clear ends, holes and falls.
- **Kit (`tests/t6.mjs`):** the chain, heavy and dash land; the light chain's
  reach hits at about 5 m; the execution kills by dropping and its landing
  hurts a neighbour; the boss takes the execution in place; the dummy stands
  back up; the trait's invulnerability and bonus.
- **Plaque (`tests/t18.mjs`):** the Riftwalker plaque is live and takes a
  test code; the sealed-plaque step makes its own sealed plaque; the
  real-code step enters every local code.
- Run `t5`, `t8`, `t10`, `t12`, `t16`, `t20`, `t19` on every device, and take
  screenshots of a pair of ends, a crossing, a Drop and the figure.

## Docs to update

- `CLAUDE.md`: the Riftwalker under "Hidden classes and codes" (ends, the
  crossing rule and turn, shots changing owner, Drop, execution, clean up),
  the dummy's list of places it is honoured (it never crosses or drops), the
  new test script, "Where the project stands", Known problems and the
  backlog.
- README: the test table.

## Left to the builder

- All numbers, the epithet, the code, the move ids and poses.
- How the reach of the light chain is built (a long, narrow melee hit is
  enough; no new hit system).
- How falling enemies are held out of the fight (a new enemy state or a flag
  on an existing one), as long as every rule above holds.
- Exactly where the per-step crossing check is called from, as long as
  bodies are checked after they move and shots before their wall and hit
  checks.
