# The Sapper

Design agreed with the owner on 2026-11-18. Read `CLAUDE.md` first for the
conventions (axes, facing, bindings, touch layout, tests), and
`2026-11-17-plaques-and-enforcer-design.md` for the plaques, codes and the
Enforcer this builds on.

## Why

The hidden classes are there to reward curiosity and to give strategic
players more to think about. The Sapper is the demolitions class: the one for
players who set a fight up before the enemies get there. The owner asked for
landmines, tripwires and explosives that bring rock down on a pack. It is the
second of the three hidden classes; the Riftwalker comes after.

## Goals

1. The Sapper, a complete playable hidden class, with the kit below.
2. Its plaque in the hall goes live: an epithet, the empty marks, a code that
   unlocks it.
3. **Cave-in.** The ability brings rock down on an area. It crushes what is
   under it, then the rubble stays as a solid wall for about 12 seconds that
   blocks movement, sight, shots, routes and the camera exactly as a cave wall
   does, then crumbles.

## Non-goals

- The Riftwalker.
- Destroying cave walls. The cave mesh is built once and stays as it is.
- Enemies that know about or avoid traps.
- Any change to the other six classes, the controls or the touch layout.

## Anti-goals

- **A plain code in the repo**, as for the Enforcer: only the hash is
  committed; the plain code lives in the ignored `tests/codes.local.json`.
- **Anything owned.** The owner called it "Demolition Man", which is a film
  title. In the game it is the Sapper. Its look and moves are original.
- **Rubble as a special case.** Nothing that reads the walkable grid should
  need to know rubble exists. If an enemy walks through rubble or a shot
  passes it, that is a bug in the field, not a missing check.
- **A seal that strands anyone.** No body ends a cave-in inside rock.

## Constraints

- Single function scope across `src/`; declare each name once.
  `node build.mjs` after every change.
- No assets. Rocks and rubble are built from the renderer's primitives.
- No new touch or pad buttons. The kit uses the existing Attack, Heavy, Tool
  and Ability slots, so touch and pad work with no layout change.
- `fieldAt`, `resolve`, `los`, `route` and `ceilAt` are shared by the cave
  and the hall (`fieldFns` in `03_world.js`). The change to the field must
  work in both.

## The kit

| Slot | What it does |
| --- | --- |
| Light chain | Sledgehammer: three heavy swings up close, good posture damage |
| Heavy | Ground slam with the hammer: a small blast in front of the Sapper |
| Sprint attack (`dash`) | Builder's call; a running hammer drop fits |
| Tool | **Landmine**, 4 charges. Planted at the Sapper's feet, it arms after about a second and blows when an enemy steps on it. **Tripwires:** a mine planted within about 6 m of another, with a clear line between them, is linked to it by a wire. An enemy that crosses a wire sets off both mines at its ends |
| Ability | **Cave-in charge**, costs focus. Thrown where the player aims. After a short fuse, rock falls on everything under it (heavy damage and a stagger, see below), and the rubble stays as a wall for about 12 seconds, then crumbles |
| Execution | Jams a charge into the staggered enemy and kicks it away. It blows where it lands and hurts what is near it |
| Trait | The Sapper's own blasts never hurt the Sapper (the Enforcer's do). The Sapper's explosions do extra posture damage, so guards break faster |

The class is melee (`ranged` unset), so attacks aim with `aimYaw`.

### The cave-in's stagger (owner's decision)

- Every regular enemy the crush hits is staggered at once, whatever its
  posture, and so is open to an execution. This is a new forced path into
  `stagger`; today that state is only reached by filling posture.
- A brute's forced stagger lasts 75% of the normal stagger time (today 3.0 s,
  so 2.25 s). Husks and spitters get the full time. A stagger reached by
  filling posture keeps its normal length for every enemy.
- The boss is never forced into a stagger. It takes the crush's damage and
  heavy posture damage, so it breaks only if its posture fills, as with any
  other hit. This keeps the ability from opening the boss to an execution
  every time the focus is there.
- The dummy is staggered like a regular enemy.

## How the rubble blocks (approach)

### Approaches considered

1. **Turn the grid under the rubble into rock for the rubble's life.** Chosen
   by the owner. Collision, sight, routing, the camera and `ceilAt` all read
   the one scalar field, so everything treats rubble as a wall with no special
   cases.
2. A separate list of rubble blockers checked by collision, sight, routing
   and the camera. Rejected: every reader of the field needs an extra check,
   and any one missed is a bug (an enemy walks through, a shot passes). It
   also breaks the rule that one field drives everything.
3. Rubble as a breakable object that bodies bump against. Rejected: sight and
   routing would ignore it.

### Design

- `fieldFns` keeps a copy of the base field and gains a way to add and remove
  rock shapes. A shape is a distance field: in the patch it covers, each grid
  value becomes `min(base, distance to the shape's edge)` taken over every
  active shape, so the field stays a fair distance estimate around rubble and
  bodies keep their clearance from it. Removing a shape recomputes its patch
  from the base copy and the shapes still standing, so overlapping cave-ins
  do not open each other.
- The world object exposes these calls for the cave and the hall alike.
- **The shape is a ridge, not a disc** (builder of this doc's call). Tunnels
  come out about 5.5 to 9.5 m wide, so a disc that spans one would need a
  radius near 5 m, a far bigger crush than any other blast. Instead the
  rubble is a capsule about 2 m thick lying across the throw direction,
  centred where the charge lands, and long enough to reach the walls on both
  sides (capped at about 11 m, so in an open chamber it is a heap to walk
  round). The crush hits what is under that footprint, plus a small margin.
- **Bodies under the rock.** The crush damage lands first, then every body
  inside the rubble is pushed clear along the field (the nearer edge). A body
  at the exact centre, where the field has no slope, is pushed toward the
  side the Sapper stands on. The Sapper takes no crush damage (trait) and is
  pushed out like anyone else.
- **The training dummy** is the one body not pushed (builder of this doc's
  call). It stays pinned on its spot, standing out of the heap, until the
  rubble crumbles. This is a sixth place the `dummy` flag is honoured, and
  `CLAUDE.md` lists it with the other five.
- **The ceiling.** In the cave, `ceilAt` is worked out from the field, so
  rubble lowers the ceiling the camera collides with near it while the drawn
  ceiling stays put. That is the same as at a cave wall, and intended.
- **Routes.** When rubble rises or crumbles, every enemy's stored route is
  dropped so it asks for a new one.
- **Sight.** Rubble blocks `los`, so it breaks enemies' sight and they go to
  `search`, as when the player rounds a corner. That is intended: sealing a
  tunnel shakes off a pursuit.
- **Blasts.** `explode` already needs line of sight, so blasts do not pass
  through rubble.
- **Look.** A cluster of faceted rocks falls from the ceiling over the fuse's
  end, lands as a heap filling the ridge, shakes and sheds dust for its last
  second or so, then breaks up. Drawn each frame, since the cave mesh is
  built once.
- **Clean up.** `resetRun` clears all rubble and mines, as it clears bombs.

## Mines and wires

- A mine is planted at the Sapper's feet with a short plant animation. It
  arms after about a second. It is triggered by any enemy (the boss and the
  dummy included) whose body comes within a small radius of it, never by
  the player.
- When a mine is planted, it links by a wire to the nearest armed or arming
  mine within about 6 m that is in line of sight. Whether a mine can hold
  more than one wire is the builder's call.
- An enemy body touching a wire sets off both of its mines.
- One mine going off sets off any mine inside its blast, so lines of mines
  chain. Mines under a cave-in go off.
- A cap on live mines keeps the hall, where tools refill on their own, from
  filling with them. The oldest goes quiet when the cap is passed. The cap is
  the builder's call.

## The plaque and the code

- `hubPlaques()` gives the Sapper plaque `cls: "sapper"`. `PLAQUE_TEXT.sapper`
  becomes an epithet the builder writes, in the style of the Enforcer's.
- The builder chooses the Sapper's code: 8 to 10 symbols from the same seven.
  It goes to the owner in conversation and into `tests/codes.local.json`; only
  its hash and length go into `SHIPPED_CODES`. `tests/codes-print.mjs` then
  prints it in every notation.

## Figure, poses and sound

- An original look: a hard hat with a lamp, a padded vest with charges
  strapped to it, a sledgehammer. A new branch in `makePlayerFig` with `f.rim`
  and `f.tips`, an idle arm pose and guard pose in `posePlayer`, and poses for
  any new `anim` names.
- A class colour that differs from the six in use.
- Sounds, synthesised in `04_audio.js`: hammer swings and thuds, the mine
  click and arm, a wire twang, the cave-in rumble and the crumble.

## Numbers

Health, stamina, damage, radii, fuse, focus cost and timings are the
builder's, aiming for a sturdy melee class between the Fighter and the
Tanker. Balance is untested by hand across the game, and the class will be
tuned in playtest.

## Testing

- **Field (new script, smoke mode):** a cave-in in a tunnel makes
  `world.route` between its two sides fail or go around, and `world.los`
  across it fail; after it crumbles both are back to what they were. Two
  overlapping cave-ins: when the first crumbles the second still blocks. A
  body inside the rubble ends outside it, and the dummy stays put. A shot stops at rubble. The same
  checks pass in the hall.
- **Kit (`tests/t6.mjs`):** the Sapper's chain, heavy and dash land; a mine
  arms and blows on an enemy; two mines link and a wire crossing sets both
  off; a mine sets off a neighbour; the Sapper's own blasts do not hurt it;
  the execution kills and its blast hurts a neighbour; the dummy stands back
  up.
- **Plaque (`tests/t18.mjs`):** the Sapper plaque is live and takes a test
  code through `DF.setPlaqueCode`; the real-code step enters every code in
  the local file.
- Run `t5`, `t8`, `t12` (routes and sight), `t10`, `t16`, `t19` on every
  device, and take screenshots of the cave-in in a tunnel and of the figure.

## Docs to update

- `CLAUDE.md`: the rubble shapes in `fieldFns` and the rule that rubble is
  only ever a change to the field, the Sapper's state (mines, wires, rubble)
  and its clean up, the new test script.
- README: nothing names the hidden classes, so only the test table changes.

## Left to the builder

- All numbers, the colour, the epithet, the code, the sprint attack, the
  figure and poses.
- How the cave-in is aimed for a melee class (lock target, or along the
  camera to a fixed distance, stopping short of walls).
- How many wires a mine may hold, and the cap on live mines.
- How the execution's kick throws the body, and what a boss (too heavy to
  kick) does instead.
