# Base of operations: design

Date: 2026-11-15. Status: awaiting the owner's approval. Reviewed once by a builder check.

## Intent

The game currently drops the player straight into a cave. The owner wants a
home: a base of operations the player starts in and comes back to, holding
portals graded E, D, C, B, A and S. Each grade will later lead to a dungeon
with its own enemy difficulty and kill rewards.

This document covers the first step only: start in a hall, walk into a portal,
arrive in the cave that exists today, and be able to come back. It also adds a
training dummy to the hall so the player can practise attacks and abilities
without leaving.

## Goals

1. The game boots into a built hall, not a cave.
2. The hall holds six portal frames in a row, one per grade. Only E is open.
   Walking into it takes the player to a freshly generated cave, which plays
   exactly as the cave does today. The other five are dark and sealed.
3. The player can return to the hall: from the pause screen, from the death
   screen, and by finishing the cave through the boss gate.
4. The hall holds a training dummy that can be locked on to and hit with every
   attack and ability, never dies, never moves and never fights back.
5. Every portal is described by data, including its grade and whether it is
   open, so opening the other five later is a data change, not a re-layout.

## Non-goals

- Difficulty scaling or rewards by grade. Only E exists and it changes nothing
  about the cave.
- More than one open portal in the hall.
- Loot, inventory, currency, vendors, or anything saved between sessions.
- Changing death in the cave. It stays shrine respawn.
- New art styles for the cave, new enemies, gamepad support.

## Anti-goals

- The hall must not feel like more dungeon. If it reads as another cave
  chamber, the step has failed even if it works.
- The cave must not play differently because of this work. Existing combat
  tests must pass unchanged.
- The dummy must not be killable by any route, including executions and area
  attacks.

## Constraints

From `CLAUDE.md`, all still binding:

- One function scope across `src/*.js`, no imports, each name declared once.
- No dependencies and nothing loaded at run time. All geometry is generated in
  code.
- Pointer lock and audio start only from a click or key handler.
- `node build.mjs` after every source change.
- Screenshots are the only check on looks.

## Approaches

**A. The hall is its own world, swapped in and out. Chosen by the owner.**
A hall builder returns the same kind of object `genWorld` returns. Entering a
portal replaces `G.world` with a new cave; returning replaces it with the hall.
Movement, camera, lock-on and combat only ever read `G.world`, so they work in
the hall unchanged. A later graded portal is "generate a cave with these
settings". The cost is a zone switch and a handful of places that assume a
cave.

**B. The hall is an extra room attached to the cave.** One world, hall joined
to the start chamber. No swap code and a seamless walk, but every new cave
rebuilds the hall, enemies can follow the player home, and six portals to six
different caves does not fit one connected map. Rejected because it works
against graded portals.

**C. The hall is a separate lightweight scene with its own movement.**
Rejected because the training dummy needs full combat to run in the hall.

## What the owner decided

- Built hall, not a cave camp.
- Approach A.
- Death in the cave keeps shrine respawn. The pause and death screens gain a
  "Return to base" option.
- A training dummy in the hall, with this behaviour:
  - It never dies and its health bar never drops.
  - It never moves, turns, notices the player or gets shoved.
  - Hits give full feedback: sparks, hit-stop, sound and focus gain.
  - Its posture fills, it can be staggered and executed, and it stands back up
    afterwards.
  - In the hall, focus and tool charges refill on their own so abilities can
    be repeated without waiting.
- Six portal frames in a row along the far wall, in rank order, so E is at
  the left end as seen from the start and S at the right. E is lit and open.
  The other five are built now as dark, sealed frames.

The owner also accepted the following as proposed, without changing them:

- Entering is by walking in, like the existing boss gate, with a short fade.
- The hall has no enemies other than the dummy.
- The title screen shows the hall behind it.
- The boss gate shows the run summary and then returns to the hall.
- The minimap is hidden in the hall.

## Design

### Zones

`G.zone` is `"hub"` or `"cave"`. Two functions own the switch:

- `enterHub()` builds the hall world, uploads its mesh, makes a fresh player
  and spawns the dummy.
- `enterCave(grade)` records the grade in `G.grade` and calls the existing
  `newRun(seed)` with a random seed.

`newRun(seed)` keeps its current meaning, "start a cave from this seed", and
sets `G.zone = "cave"`. The existing tests call it directly and must keep
working.

Both functions clear the transient lists (projectiles, particles, rings,
ghosts, pending blasts, messages), the lock target and `G.gate`.

The renderer's `setWorld` must free the previous world's GPU buffers. It leaks
them today, which did not matter when a new world was rare.

### The hall world

The hall builder returns every field `genWorld` returns, so nothing that reads
`G.world` needs a null check. Fields with no meaning in the hall are empty
arrays (`nodes`, `edges`, `shrines`, `path`, `halos` if unused) or sensible
constants.

- **Size and shape:** a rectangle about 30 m wide and 34 m long, long axis
  north to south, ceiling about 7 m.
- **Collision:** the same grid field as the cave, with `fieldAt`, `resolve`,
  `los` and `ceilAt` behaving identically. The field is the distance to the
  nearest wall or pillar. Pillars must be large enough, and placed on grid
  points, for a one-unit grid to represent them: about 1 m in radius.
- **Geometry:** flat floor, straight walls and a flat or shallow-vaulted
  ceiling, emitted as flat-coloured triangles in the same vertex format as the
  cave. Floor slabs vary slightly in shade so the faceted look carries over.
  Stone is cooler and cleaner than cave rock.
- **Pillars:** two rows of three, a few metres in from the side walls and
  kept clear of the approach to the arches, so no pillar stands between the
  start point and any arch.
- **Braziers:** four, between the pillars, as low stone bowls with a warm
  light and a flame glow each.
- **Portal frames:** six identical stone arches at floor level along the
  north wall, evenly spaced at roughly 4.6 m, in the order E, D, C, B, A, S
  from left to right as seen from the start. Each has a low step ring drawn
  on the floor in front of it.
- **Open portal:** E's arch holds a glowing surface drawn with the additive
  effects, in cyan like the boss gate, and casts light.
- **Sealed portals:** the other five arches are filled with dark stone, have
  no glow, cast no light and have no trigger.
- **Lighting:** the renderer takes eight lights a frame. The hall uses the
  player's lamp, four braziers and the open portal, which leaves two spare.
- **Player start:** on first arrival, on the centre line about 7 m in from the
  south wall, facing the row of arches. Any closer and the camera, which sits
  behind the player, would be pressed against the wall. On return from a cave, about 3.5 m in front of
  the portal that was used, facing into the hall, so the player steps out of
  it and cannot re-trigger it by accident. The return point is derived from
  each portal's position and facing, not stored as a constant.
- **Dummy position:** mid-hall, about 5 m to the right of the centre line as
  the player first sees it, standing on a round floor marking. The straight
  walk from the start to the E portal stays clear, and there is at least 12 m of
  open floor on one side for ranged practice.

```
                    north wall
 +------------------------------------+
 |  (E)   [D]   [C]   [B]   [A]   [S] |   (E) open, [ ] dark and sealed
 |   .     .     .     .     .     .  |   step rings
 |                                    |
 |    o                          o    |   o = pillar
 |    *                          *    |   * = brazier
 |    o             (dummy)      o    |   dummy on its floor mark
 |                                    |
 |    o                          o    |
 |    *                          *    |
 |                 ^                  |   ^ = first start, facing the arches
 +------------------------------------+
```

The sketch is the view from the start point. Which world direction "left"
and "right" fall on follows the conventions in `CLAUDE.md`: with forward as
`(sin yaw, cos yaw)`, the player's left is positive X when facing positive Z.

### Portals and grades

- `GRADES` is a table of six entries, E, D, C, B, A and S, each with an id, a
  display name such as "E-rank gate" and a colour. It carries no difficulty or
  reward fields yet.
- The hall world has a `portals` list. Each portal has a position, a facing,
  a grade id and an `open` flag. There are six entries and only E is open.
- Arch geometry, trigger, label and return point are all derived from the
  portal's entry, so no portal is special-cased.
- The trigger is a circle about 1.2 m in radius centred in an open arch. It is
  checked only in the hall and only while the player is alive and no
  transition is running. Sealed portals have no trigger.
- A label floats above each arch as a HUD element, positioned with
  `R.toScreen`, while that arch is on screen and within about 16 m. The open
  portal's label reads its display name. A sealed portal's label is dimmer
  and adds "Sealed". This is a builder's call the owner has not seen.

### Transition

- Entering a portal starts a transition that lives in the simulation, so
  `DF.sim` drives it in headless tests: about 0.4 s fading to black, the world
  swap at full black, about 0.4 s fading back.
- A full-screen overlay element reads the fade amount from `G`. With reduced
  motion preferred, the swap is a cut with no fade.
- During the transition the player cannot act and cannot be hurt.
- On arrival in the cave, a short message names the grade.
- Returning to the hall from a menu button is immediate, with no fade, because
  a menu already covers the screen.

### Screens

- **Title:** the backdrop is the hall. The button reads "Enter the hall". The
  subtitle is rewritten to describe starting in the hall and choosing a gate.
- **Pause, in the cave:** "New cave" becomes "Return to base". It abandons the
  cave without a confirmation step, since nothing is lost yet.
- **Pause, in the hall:** that button is hidden.
- **Death:** "Rise again" stays. "Return to base" is added beside it.
- **Win:** the run summary stays. The button reads "Return to base" and goes
  to the hall. The heading and stats are unchanged.
- **Class change:** works in the hall as it does in the cave.

### HUD in the hall

- The minimap is hidden.
- The dummy always shows its health and posture bar while it is on screen and
  within the usual range, so the player can watch posture fill. Other enemies
  keep the current rule.
- The run timer, kills and deaths do not advance in the hall.

### Training dummy

The dummy is an enemy type, `dummy`, in `EDEF` with a `dummy: true` flag, so
every attack path reaches it through `hitEnemy` and lock-on finds it through
the normal enemy list.

- **Figure:** a post-and-crossbar practice dummy built from primitives: a
  stake, a padded torso, a crossbar for arms and a sack head. It needs the
  nodes the renderer and HUD read on every enemy figure (`headN`, `handR`,
  `rim`, `eye`, the scale under `o.sc`), and its eye glow should be dim or
  absent.
- **No AI:** it never becomes alerted, chases, attacks, turns or takes a
  token. It stays in `idle` except while staggered.
- **No movement:** no knockback, and it is returned to its home spot every
  update so nothing can shove it. The player is pushed out of it, as with a
  heavy enemy.
- **No damage:** `hitEnemy` runs in full for feedback and focus, then restores
  its health to full. It can never reach `kill`.
- **Ambush and backstab:** it counts as aware, so the Assassin's ambush bonus
  does not fire on every hit. Backstab still applies from behind, since the
  dummy has a facing.
- **Posture:** fills and decays as normal. At full it enters `stagger` for the
  normal duration, then returns to `idle` with posture cleared.
- **Execution:** the normal execution kills a non-boss outright by setting its
  health to zero. For the dummy it must instead play the execution, give the
  player the usual health and focus, clear the dummy's posture and leave it
  standing.
- **Pose:** it rocks briefly when hit and slumps while staggered. It has no
  walk, attack or death pose.

### Hall refills

While `G.zone` is `"hub"`, the player's focus refills at roughly 25 a second
and one tool charge returns about every 1.5 seconds. Stamina and flasks follow
their normal rules. None of this applies in the cave.

## Testing

- A new test script covers the base:
  1. After boot the zone is the hall, the only enemy is the dummy, and the
     start point and dummy stand on walkable ground.
  2. Walking from the start into the E portal runs the transition, and
     afterwards the zone is the cave with shrines and enemies present.
     Walking into each of the five sealed frames does nothing.
  3. "Return to base" from the cave puts the player back in the hall in front
     of the portal without re-entering it.
  4. For every class, a sustained run of light attacks, heavy attacks, the
     tool and the ability against the dummy leaves it alive, at full health
     and at its home position.
  5. The dummy can be staggered and executed and is alive afterwards.
  6. Focus and tool charges refill in the hall and do not in the cave.
- Every existing script in `tests/` passes unchanged. `tests/t2.mjs` looks up
  cave enemies without calling `newRun`, so it depends on the runner having
  put the game in a cave. Builder's call, made here: `test.mjs` keeps its
  `smoke` mode meaning "in a cave" by entering one after clicking play, and
  gains a separate mode that stays in the hall for the new script.
- `playwright` does not resolve from the project, because there is no
  `node_modules`. Chromium builds exist in `~/Library/Caches/ms-playwright`.
  Tests and screenshots need `PLAYWRIGHT_MODULE` set, or an install, first.
- Screenshots: the title over the hall, the view from the start point showing
  all six frames, the E portal up close with its label, a sealed frame up
  close, the dummy being hit, and the first frame in the cave after a
  transition. They are looked at, not assumed.

## Documentation

`CLAUDE.md` and `README.md` are updated for the zone concept, the hall
builder, `GRADES`, the dummy flag and the new test script.

## Left to the builder

- File layout, for example a new `src/03b_hub.js` for the hall builder.
- Exact dimensions, colours, light strengths and the look of the arch, bowls
  and dummy, tuned from screenshots.
- How the portal surface is drawn with the existing effect calls.
- Exact refill rates and fade timings within the ranges above.
- Whether the hall world is rebuilt on each return or cached.
