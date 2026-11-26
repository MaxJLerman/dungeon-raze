# World, field, rock and water

## World (`genWorld` in `03_world.js`)

- A scalar field `F` is sampled on a one-unit grid. Positive means walkable,
  and the value approximates distance to the nearest wall.
- `world.fieldAt(x, z)` reads it with bilinear interpolation. This single
  function drives collision, line of sight, camera collision and spawn checks.
- `world.resolve(obj, radius)` pushes anything with `x` and `z` back inside the
  walkable area. `world.los(ax, az, bx, bz)` tests line of sight.
- Walls come from marching squares on the same grid, so what you see matches
  what you collide with. Floor and ceiling are sheets over the same cells.
- `world.route(ax, az, bx, bz, rad)` finds a walkable route for a body of
  that radius by searching the same grid. It returns the points to walk to in
  order, not including the start, or `null` when there is none. It lives in
  `fieldFns`, so the hall has it too. `world.path` is something else: the
  list of chamber ids from the start to the boss.
- The ceiling height at a point is `world.ceilAt(x, z)`.
- **Rock.** `world.addRock(ax, az, bx, bz, r)` writes a capsule of rock into
  the field and returns an id; `removeRock(id)` and `clearRocks()` take it
  out again. `fieldFns` keeps a copy of the base field on the first rock, and
  each point a rock covers (its box grown by `ROCK_PAD`) holds the least of
  the base and every live rock's distance, so overlapping rocks do not open
  each other. This is how the Sapper's rubble and the crocodile's fallen
  ceiling block movement, sight, routes, shots and the camera. **Rubble is only ever a change to the field.** Never
  give a reader of the field a rubble check of its own.
  In the cave, `ceilAt` is worked out from the field, so the ceiling the
  camera collides with drops near rubble while the drawn ceiling stays put.
- Spawn packs are chosen by a chamber's distance from the start, in `PACKS`.
- **Shared builders.** `planGraph(Rn, o)` makes the jittered grid of rooms, the
  spanning tree and the loop edges; `linkGraph(nodes, edges, start, boss)`
  sets adjacency and depth and returns the path; `marchWalls(F, minX, minZ, W,
H, seg)` runs marching squares and calls `seg` for each wall segment. `genWorld`
  and `genSewer` both call them. They consume `Rn` in a fixed order, so a seed
  gives the same cave as before the sewer. `tests/t22.mjs` holds hashes of
  caves 1, 7 and 99 and fails if `genWorld` changes.
- **Water.** A second layer on the field's grid, `Wt`, 0 dry to 1 water.
  `world.waterAt(x, z)` reads it bilinearly like `fieldAt`, and is 0 off the
  grid and in the cave and the hall. `world.bodyAt(x, z)` is the id of the
  connected body of water at the nearest grid point, or -1. `world.bodies` lists
  the bodies (`{ id, room, n, x, z }`: room id, grid points and a centre; empty in
  the cave and hall). `fieldFns(F, minX, minZ, W, H, Wt)`
  builds both. **Water blocks nothing.** It is not rock: collision, sight,
  routes, shots and the camera ignore it. **Read water only through `waterAt`
  and `bodyAt`.** Never test whether the world is the sewer to decide whether
  something is wet; `genWorld`, `genHub` and `genSewer` all return both
  functions, so no reader needs a zone check. `genSewer` also returns `F`,
  `Wt`, `bodyIds` and `pillars` (`{ x, z }`, each a pier's centre) for
  tests; game code does not read them.
- `world.grates` lists the grates and pipe mouths in tunnel walls
  (`{ x, z, yaw, kind }`, `kind` being `"grate"` or `"drain"`, for the drain grabber), `world.wallTunnels` the boss
  cavern's high wall outlets, and `world.shafts` its light shafts. All three
  are arrays on every world, empty in the cave and hall.
- **Pieces and `cut`.** Every world has `pieces`, `pieceGrid`, `pieceAt` and
  `cut`, a number of metres: how far a piece can see, which `visiblePieces`
  (`03e_sewerview.js`) reads from the world. The cave and the hall have no
  pieces (`pieces: null`) and `cut: 0`; the sewer's is
  `SEWER.piece.fog / ENV_SEWER.fogD`. `cutPieces(o)` in `03e` is the one
  routine that cuts a mesh into pieces. It takes
  `{ nodes, edges, F, W, H, minX, minZ, P, C, M, los }` and what makes it fit a
  world: `roomBox(n)` (`[x0, z0, x1, z1]` holding room `n`), `inRoom(n, x, z)`
  (above 0 where the point is in room `n`), `line(e)` (a tunnel's polyline of
  `{ x, z }`), `runs` (polyline segments to a piece), `reach` (how far from its
  polyline a tunnel's cells are looked for), `pad`, `sample`, `edge`, `cut`
  and `sees` (default true). It returns `{ pieces, pieceGrid, pieceAt, pos,
  col, mat }`. `M` may be `null`, and then `mat` is `null`. With `sees: false`
  no sight line is cast and every piece's `sees` is `[]`. It touches `R`
  nowhere, so the host copy can build pieces. The sewer calls it through
  `sewerPieces` (see `sewer.md`).

## The big cave (`genWorld(seed, true)`)

The cave for two players: 36 rooms on a 6 by 6 grid. `world.big` is `true`
on it and `false` on every other world (the small cave, the hall, the
sewer). Game code does not branch on it; it is for tests and the dev build.
In this state it is drawn whole: `pieces: null` and `cut: 0`, as the small
cave.

- **What differs.** Only these; every branch on `big` leaves the small cave
  drawing from `Rn` exactly as before (t22's hashes of caves 1, 7 and 99).
  The room options are `CAVE_PLAN` with `GX` and `GZ` 6, so rooms, spacing,
  jitter and the start's and Warden's radii are the small cave's. The order
  of the steps that draw from `Rn` is the small cave's too: layout, tunnels,
  dressing, crystals, packs, posts.
- **The redraw rule.** `bigCaveGraph(seed)` (on `DF`) plans draw `k` = 0, 1,
  2 ... from `rng(seed + k * 7919)` and keeps the first whose route (the
  `path` from `linkGraph`) holds at least 10 rooms, the start and the boss's
  counted. Diagonal tunnels can cut a 6 by 6 route to 8 rooms. Draw 8 is
  made with `diagP: 0`: with no diagonals a route has to cross 5 columns and
  5 rows one room at a time, so it holds at least 11 rooms and the loop
  always ends there. It returns `{ Rn, nodes, edges, start, boss, path }`,
  `linkGraph` applied, and `genWorld` carries on drawing from that `Rn`.
  A rejected draw's nodes are thrown away with it, so their `adj` and
  `depth` never reach the kept layout. Over seeds 1 to 200: 143 seeds took
  the first draw and the most was 6; routes of 10 rooms (136 seeds), 11
  (60) and 12 (4).
- **Dressing** is doubled with the area: 920 floor rocks in 18,000 tries,
  1,040 stalactites in 18,000, at most 116 crystals in 28,000. The 12.5 m
  spacing and the red within 40 m of the boss stay. Every one of seeds 1 to
  200 reaches 116 crystals.
- **Rest points.** The start; then route rooms 4, 7, 10 ... (`path[3]`,
  `path[6]` ...) while the index is at most `path.length - 4`; then
  `path[path.length - 2]`. No two are neighbours on the route, and a route
  of 10 to 12 rooms has four. They are built and marked as the small cave's
  shrines, so a rest room holds no pack.
- **Packs.** The small cave's six, then `brute, brute, spit, husk, husk` and
  `brute, brute, spit, spit, husk, husk`. `deepest` is the greatest `depth`
  of a node whose `kind` is still `"room"` once the rest rooms are marked
  (no boss room, no rest room). A room's index is
  `floor((depth - 1) / (deepest - 1) * 7)` (0 when `deepest` is 1) plus the
  small cave's `(Rn() * 2) | 0`, clamped to the table. So rooms at depth 1
  hold two husks or two husks and a spitter, and the deepest rooms a
  two-brute pack. Tunnel posts and the Warden are the small cave's. Over
  seeds 1 to 20 one player meets 119 to 152 spawns (Warden and 19 to 32
  tunnel posts counted), and the most common pack is in at most 42% of a
  cave's pack rooms (seed 7).
- `newRun(seed, grade, big)` hands `big` to the generator only for grade E
  (`zones.md`).

## Tests

- Run `tests/t20.mjs` after any change to `fieldFns` rock or the Sapper's
  cave-in: `SCRIPT=$PWD/tests/t20.mjs node test.mjs smoke`. It checks rock
  on a hand-built corridor, then cave-ins in a tunnel of cave 99.
- Run `tests/t5.mjs` after any change to cave generation and `tests/t6.mjs`
  after any change to classes or combat rules.
- Run `tests/t31.mjs` and `tests/t22.mjs` after any change to the big cave:
  `SCRIPT=$PWD/tests/t31.mjs node test.mjs smoke`. t31 checks 36 rooms all
  reachable, the route over 200 seeds, the rest rule, the packs, the tunnel
  guards, the crystals and that `big` is for grade E only; t22's first step
  proves the small cave did not move. Look at `shots/t31-start.png`,
  `t31-room`, `t31-tunnel` and `t31-boss` beside `shots/t22-cave99.png`.
