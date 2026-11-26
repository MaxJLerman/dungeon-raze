# Co-op: a much bigger cave for two

Design, 2026-11-26. The second of three pieces the owner chose to build one
at a time. The first (the hall as a lobby, gate travel, a dungeon tuned for
two) is merged: `2026-11-25-coop-lobby-design.md`. The third is more health
and more phases for the Warden and is not part of this one.

## What the owner asked for

"What if we made the cave for gate E just a lot bigger, so that there's
more rooms, more enemies in those rooms", using "the rendering efficiency
hack that we developed for gate D". Asked how big and what shape, the owner
chose **6 by 6**: 36 rooms against today's 16.

Why: two players clear today's cave quickly even with the tuning for two.
A dungeon entered by two should be an expedition, and the sewer's way of
drawing only what can be seen is what makes a cave that size affordable.

The owner was shown the summary below and answered "nothing wrong, go
ahead". Lines marked *my call* are choices the owner did not make and may
change.

## Today, measured

| | Cave today (seeds 1, 7, 99) | 6 by 6 with nothing else changed (seeds 1, 3, 7, 42, 99) |
| --- | --- | --- |
| Rooms, tunnels | 16, 20 to 22 | 36, 46 to 54 |
| Grid | about 210 by 210 m | about 300 by 300 m |
| Rooms on the route to the boss | 7 | 8 to 11 |
| Route length, room centre to room centre | 272 to 292 m | 349 to 481 m |
| Rest points | 3 | 3 |
| Enemies, one player | 43 to 48 | 113 to 118 |
| Enemies, two players | 62 (seed 99) | 167 (seed 99) |
| Triangles, drawn whole | 81,835 to 87,073 | 179,892 to 201,169 |
| Crystals (lights) | up to 58 | 58, the cap |
| Deepest room | 6 | 9 |
| Build time in Node, no pieces | about 40 ms | about 70 ms |

The second column came from a throwaway copy with `GX` and `GZ` set to 6
and is only a guide. It shows what must change beyond the grid: the route
can come out short, the rest points do not grow, the crystals hit their
cap, and the pack table (six packs chosen by depth) runs out at depth 6.
For comparison the sewer is 21 rooms, 137,115 triangles and 77 pieces,
builds in about 280 ms in Node, and its busiest sampled frame draws about
27,900 triangles.

## Goals

- A cave built for two players is the big cave: 36 rooms on a 6 by 6 grid,
  with the look of today's cave.
- The cave one player gets is unchanged for every seed. `tests/t22.mjs`
  holds hashes of caves 1, 7 and 99 and they do not move.
- The big cave is drawn in pieces, and no frame of it draws more world
  triangles than the whole of cave 99 (81,835), the limit the sewer has.
- The route to the Warden is long for every seed, and rest points are
  spread along it.
- The five changes of the dungeon tuned for two stay and apply on top.

## Non-goals

- The Warden's extra health and phases (piece three). Its chamber and its
  fight do not change here.
- New enemy types, loot, or any reward for clearing rooms off the route.
- A big cave for one player in the released game. A test and the dev
  build may make one.
- Grade D in co-op. Its gate stays sealed in a co-op hall.
- Changing the numbers in `COOP_TWO`.
- Changing how the sewer is cut or drawn. Its hashes in t22 do not move.
- A new minimap. It fits the larger world as it fits any world.

## What would make this a failure even if it works

- Any seed of the one-player cave changing.
- A frame that hitches or draws the whole 190,000 triangles.
- A wall, floor or ceiling missing in view because its piece was not
  drawn.
- A long freeze when the cave is built. The fade to black hides a short
  one.
- The host and a page disagreeing about the world (the checksum refuses
  the join, and nobody can play).
- Most rooms holding the same hardest pack, so that the depth of the cave
  means nothing.

## Approaches considered

**The generator.**

1. *One generator, two sizes (chosen).* `genWorld` takes a second
   argument and, when it is set, uses the big cave's settings. With it
   unset the generator draws from its random stream in exactly today's
   order. The big cave looks like today's because it is made by the same
   code. Cost: `genWorld` gains branches, each of which must leave the
   small path alone; t22's hashes prove that.
2. *A second generator in its own file*, built on `planGraph`,
   `linkGraph` and `marchWalls` as the sewer is. It could look different,
   but it would copy about 300 lines of rock, ceiling, crystal and shrine
   code that would then drift apart. Rejected: nobody asked for a
   different look.
3. *Several ordinary caves joined by tunnels.* Rejected: the seams need
   their own rules, and each part would have a start and a boss room to
   remove.

**The cutter.**

1. *One shared cutter (chosen).* `sewerPieces` is written against the
   sewer's boxes and straight runs. Its body becomes a routine that is
   handed, per world, which cells belong to each room, the polylines of
   the tunnels, how many runs make a piece, and the distance beyond which
   nothing is drawn. The sewer calls it with what it has today and t22's
   piece hashes prove nothing moved. The cave calls it with circles and
   its winding tunnels.
2. *A copy for the cave.* Quicker to write, but the visibility rules
   (generous `sees`, the extra ring of neighbours) are subtle and would
   then live twice. Rejected.

The owner left both choices to me (*my call* on each).

## The design

### Which cave is built

- `genWorld(seed, big = false)`. `newRun(seed, grade = "E", big = false)`
  passes it on, and `enterCave` takes it too. Nothing in core reads `NET`
  to decide; the caller says. `big` means something only for grade E:
  any other grade ignores it (a sewer started for two in a host test is
  still the sewer, with `n` 2).
- The host's `build` makes the big cave exactly when it makes a dungeon
  for two today (`two`, or two players in the room when a cave is built),
  so `S.n === 2` and the big cave always go together. The page's
  `coopBuild` builds big when the world description's `n` is 2. No new
  field travels.
- A friend who joins a cave built for one gets that cave, as today. A cave
  built for two stays big for as long as it lasts, wipes included, even if
  a player leaves.
- A world says what it is: `world.big` is `true` on the big cave and
  absent or false elsewhere. Game code does not branch on it; it is for
  tests and the dev build.
- The single-player game never passes `big`.

### The layout

- `planGraph` with `GX` 6 and `GZ` 6. Spacing, jitter and room sizes are
  today's: the rooms are the same size, there are more of them. The
  Warden's chamber is the far corner with today's radius.
- **The route.** For every seed the route from the start to the boss
  passes through at least 10 rooms, the start and the boss's counted
  (today's 6 by 6 spike gave 8 to 11, because diagonal tunnels shorten
  it). How is left to the builder: fewer diagonals in the big cave, or
  drawing the layout again from a seed derived from the first until it
  holds. It must be the same on every engine and must end: a test covers
  200 seeds.
- **Rest points.** The start; then every third room along the route
  (the 4th, 7th, 10th room...) as long as it is at least three rooms
  short of the boss's; and always the room just before the boss's. No two
  rest rooms are neighbours on the route. A route of 10 or 11 rooms has
  four. A rest room holds no pack, as today.
- **Crystals, stalactites and floor rock.** Their counts are fixed
  numbers today (58 crystals at most). In the big cave each count is
  scaled by the ratio of the big grid's area to a small cave's, about 2,
  so the big cave is as lit and as dressed as the small one. The spacing
  rule between crystals stays.
- The boss's red tint and red crystals near the chamber are unchanged.

### Enemies

- **The pack table.** The big cave uses eight packs: today's six, then
  `brute, brute, spit, husk, husk` and `brute, brute, spit, spit, husk,
  husk`. A room's pack is chosen by how deep it is as a share of the
  deepest room that holds a pack (not the boss's room, and not a rest
  room): the index is `floor((depth - 1) / (deepest - 1) * 7)` plus
  today's random 0 or 1, kept within the table. So the first rooms hold
  two husks and the last hold six. (*my call*: the owner approved
  "two larger packs at the bottom (5 to 6 enemies, two brutes)" and the
  stretch, not the exact packs.)
- Tunnel posts are as today: half the tunnels hold a husk, never inside
  the boss's keep-out.
- **The tuning for two on top.** `coopExtras` adds one enemy to each
  room's pack and two where the pack is a deep one. Today it knows a deep
  pack by its being `brute, brute, spit`; that becomes "holds two or more
  brutes", which is the same thing in the small cave and takes in the two
  new packs. Health, posture, attack turns and the Warden's numbers are
  untouched.
- Expected total for two players: about 170 enemies (the owner was first
  told "roughly 150"; a closer sum of this table, the extras and about 25
  tunnel posts gives 165 to 180, and the owner is told so with this
  document). The builder measures the spread over 20 seeds as soon as the
  generator exists and writes it in the notes. Outside 150 to 190 it is
  reported to the owner in the final summary and not tuned silently; it
  does not stop the work. (A trial made while the plan was written gave
  155 to 204 over 21 seeds, mean 178, and the owner was told with the
  plan.)

### Pieces and drawing

- The big cave's mesh is cut into `world.pieces` with `pieceGrid` and
  `pieceAt`, the same shape the sewer returns. One piece per room (the
  cells inside its circle) and each tunnel in stretches of its own
  polyline; how many points make a stretch is the builder's to tune
  against the budget.
- `sees` is worked out as the sewer's is: neighbours, sampled sight lines
  through `world.los` within the cut distance, then one more ring.
- **The cut distance belongs to the world.** `visiblePieces` uses
  `SEWER.piece.fog / ENV_SEWER.fogD` today. Each world with pieces
  carries its own distance (the sewer's value unchanged, the cave's from
  the cave's fog, 0.03, with the same fog constant), and `visiblePieces`
  reads it from the world.
- `07_render.js` already draws `visiblePieces(...)` for any world with
  pieces, so the frame loop needs no branch.
- **Budget.** Over walks of the route and a sample of rooms, tunnels and
  headings on at least six seeds, no frame draws more than 81,835 world
  triangles. A test also holds that every walkable point in sight of the
  camera within the cut distance lies in a drawn piece, as t22 checks for
  the sewer.
- Crystal glows need nothing: `07_render.js` already skips a halo more
  than 64 m from the camera.
- The small cave and the hall keep `pieces: null` and are drawn whole.

### The host and the wire

- The host builds the same world the pages do, pieces included, so
  `coopWorldSum` (a hash of `world.pos`, which the cutter reorders)
  agrees. The builder may let the host skip working out `sees`, which is
  not in the checksum and which the host never reads, if the build time
  needs it.
- `COOP_V` goes from 2 to 3 (*my call*): the meaning of `n: 2` in a world
  description changes, even though `COOP_BUILD` already keeps two builds
  apart.
- The world description lists every enemy. At about 31 bytes each, 170
  enemies are near 5,300 bytes against the relay's 16,384 a frame. A wire
  test builds the big cave for two and holds the limit.
- Snapshots carry enemies within `COOP.RANGE` of a player, so their size
  follows the fight, not the cave.

### Build time

- The cave is built on each page at full black in the fade, and in the
  host's Worker. Target: the whole big cave, pieces and `sees` included,
  in under 800 ms in Node on this machine, checked by a test with a
  generous ceiling (2 s) so it does not flake. The sewer takes about
  280 ms for 77 pieces; the cave will have more.
- If the target cannot be met, the first thing to give is the sampling
  density of `sees` in the cave, as long as the sight test still passes.

### The minimap

- It already scales to the world. The big cave's rooms are drawn at about
  0.7 of today's size. A screenshot is the check; if rooms or the
  player's mark stop being readable, widen the lines for a world this
  size and nothing else.

### The dev build and tests' way in

- `DF.newRun(seed, "E", true)` builds the big cave for a test with no
  co-op at all.
- `DF.coopSolo({ two: true })` already makes a dungeon for two and so now
  gives the big cave.
- The dev menu gets one entry beside its gate jumps that enters the big
  cave alone (*my call*: the owner has no other way to walk it without a
  second player). It lives in `src/dev/` and core does not know of it.

## Constraints that bind every part

- `node build.mjs` after every source change. All `src/*.js` share one
  scope: a name is declared once. Nothing outside `src/dev/` names
  anything declared there.
- The host copy is the files matching `^0[1-6]`: it loads in Node and in
  a Worker and names nothing from `07` on. The cutter stays in `03e` and
  must not touch `R` outside `visiblePieces`, which the host never calls.
- Every world generator returns the same shape. Seeded generators draw in
  a fixed order. With `big` unset `genWorld` consumes `Rn` exactly as
  today.
- t22's hashes of caves 1, 7 and 99 and of sewers 1, 5 and 9 do not
  change. The big cave gets hashes of its own (seeds 1, 7 and 99: mesh,
  spawns, pieces).
- With `NET` and `DEV` null the game is the plain single-player game and
  never builds the big cave.
- New per-run state is cleared in `resetRun()`.
- Notes go in the same commit as the code: `world.md` (the big cave, the
  shared cutter), `sewer.md` (what moved out of `sewerPieces`),
  `coop.md` (which cave is built, `COOP_V`), `rendering.md` if the
  drawing changes, `dev-menu.md`, `status.md`, and `CLAUDE.md`'s "Where
  the project stands" and its table if a file is added.
- Never a plain plaque code anywhere. No `Co-Authored-By` or
  `Claude-Session` trailers.

## Tests

- **t22** (or a new script beside it, the builder's choice, with a row in
  `CLAUDE.md`'s table and the README's): the small cave's hashes
  unchanged; the big cave's hashes; 36 rooms; the route at least 10 rooms
  over 200 seeds; the rest-point rule; every room reachable; the pack
  table by depth (the first rooms hold one of the two smallest packs, the
  deepest a two-brute pack, and no single pack is in more than half of
  the rooms; a trial over 200 seeds found the most common pack in up to
  42% of a cave's rooms, so "a third", written here first, would fail on
  8 seeds in 200); crystals in proportion; the sight test and the triangle budget
  above; the small cave and hall still drawn whole; screenshots of the
  big cave's start, a room, a tunnel, the boss chamber and the minimap.
- **coop-host:** a cave built for two is big and one built for one is
  not (grade E; a sewer for two is still the sewer); a wipe keeps it
  big; a friend joining a cave for one gets the small one; the enemy
  count for two in range; the build-time ceiling (the plan has the host
  skip `sees`, so the full build's ceiling is checked in the page script
  and the host's own, much shorter, here); a
  simulated minute in the big cave with two players standing apart keeps
  the average step under a stated cost.
- **coop-wire:** the join of the big cave for two fits one relay frame.
- **coop-caves:** the big cave's checksum agrees across Chromium,
  Firefox, WebKit and Node.
- **coop-e2e** and **t27, t28:** the trip into E by two lands both in the
  big cave, the checksum is accepted, and the existing counts that name
  cave 99 for two (62 enemies, the Warden's hit count) are updated to
  what the big cave gives.
- **t26, t26-build:** the dev entry, and that the release build holds no
  trace of it.
- The whole table in `CLAUDE.md` once at the end, as before. Three
  failures older than this work are recorded in the notes and are not
  this piece's to fix: `touch-all t14`, `touch-all t29 title` on four
  short phones, and one flaky `coop-host` check.

## Left to the builder

- How `genWorld` is arranged inside so that the small path is untouched.
- How the route's minimum is met.
- The shape of the shared cutter's arguments, the stretch length of
  tunnel pieces and the sampling density, within the budget, the sight
  test and the build time.
- Whether the host skips `sees`.
- Whether the tests go in t22 or a new script.
- The wording and place of the dev menu entry.

## Risks

- **The cave's fog is thinner than the sewer's and its rooms are round
  and open**, so more pieces may be in sight at once than in the sewer.
  The budget test is the judge. If it cannot be met by cutting finer,
  the next thing to try is a shorter cut distance for the cave, allowed
  only if screenshots looking down the longest sight lines show nothing
  appearing at the cut, and recorded in the notes when used. The extra
  ring of neighbours in `sees` is not to be dropped: it is what keeps
  walls from going missing. The last resort is thicker fog in the big
  cave only, which changes its look and so goes to the owner first.
- **Winding tunnels make poor boxes.** A piece's box is what the view
  test uses; a long winding stretch has a big box and is drawn often.
  Shorter stretches cost more pieces and a longer `sees` pass.
- **Nobody has played two-player at all yet.** About 150 enemies with
  1.3 times health may be far too long a run. The numbers are in one
  place (`COOP_TWO` and the pack table) for the owner to change after
  playing.
- **A phone building the cave.** Node on this machine is not a phone;
  the freeze at full black could be several times the Node figure. It is
  measured on the test devices' emulation only, which does not slow the
  processor.
