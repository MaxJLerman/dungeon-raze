# The sewer (grade D)

The water layer (`waterAt`, `bodyAt`) and the builders shared with the cave are
in `world.md`.

## Layout, water, pillars and pieces (`03c_sewer.js`, `03d_sewerdress.js`, `03e_sewerview.js`)

- **Pieces** (`sewerPieces`, `cutPieces` and `visiblePieces` in
  `03e_sewerview.js`). `cutPieces` is the cutter every world shares (its
  arguments are in `world.md`); `sewerPieces` is the sewer's call of it and
  hands it: each room's box and `roomField` (the boss cavern's circle),
  `[nodes[e.a], ...e.bends, nodes[e.b]]` as a tunnel's line, `SEWER.piece.runs`,
  `SEWER.tunR + 1` as the reach, `SEWER.piece.pad`, `.sample` and `.edge`, and
  `sewerCut()` (`SEWER.piece.fog / ENV_SEWER.fogD`) as the cut distance, which
  `genSewer` also returns as `world.cut`. The sewer's
  mesh is cut at build time into `world.pieces`, one
  per room and one per stretch of `SEWER.piece.runs` tunnel runs. A piece is
  `{ first, count, box, sees, ... }`: a range of vertices, a bounding box and
  the ids of the pieces visible from anywhere in it. `sees` is worked out with
  `world.los` between sample points (a 3 m lattice and every second cell of
  a piece's rim) and errs generous: its grid neighbours are always in it, and
  so are the neighbours of every piece that sight put in it, because the
  camera can see round a corner that no pair of samples clears. `world.pieceGrid` and `world.pieceAt(x, z)` give the piece at a
  point, or -1 outside every piece. The small cave and hall have
  `pieces: null` and are drawn whole; the big co-op cave is cut too
  (`world.md`).
- `visiblePieces(w, cx, cz, px, pz, frustum = true)` returns the ids to draw:
  what the camera's piece and the player's piece see, within the fog distance
  (`w.cut`, the sewer's `SEWER.piece.fog / ENV_SEWER.fogD`) and, with `frustum`, inside the view
  (`R.boxVisible`). With the camera outside every piece it falls back to the
  player's piece and drops the view test (the camera can sit in rock).
  It returns `null` for a world without pieces. `07_render.js` calls
  `R.drawWorld(visiblePieces(...))` each frame. A test can pass `frustum`
  false to get what a full turn of the camera could need. Measured budget:
  cave 99 draws 81,835 triangles whole; the sewer's busiest frame over the
  sampled walks was about 27,900, and the most a full turn could need within
  the fog about 54,200. t22 fails if a sewer frame draws more than
  cave 99.
- **The sewer** (`genSewer(seed)` in `03c_sewer.js`, numbers in `SEWER`). It
  uses `planGraph` and `linkGraph` on a 5 by 4 grid with a wider spacing, adds
  an arrival hall beside the first corner and a boss cavern in the far corner,
  and shapes the field from rounded rectangles for rooms and polylines of
  straight runs and angled bends for tunnels (no noise, so walls stand
  straight). The boss cavern has exactly one tunnel in. At least `SEWER.spurs`
  rooms are dead ends and at least `SEWER.loopsMin` loops remain. Four rest
  points: the arrival hall and three along the path, the last just before the
  cavern. Rooms get a kind: `start`, `pool`, `brood`, `shrine` or `boss`; no
  room is both pool and brood, and every spawn records its room kind. Rest
  rooms hold no enemies. A run is about 1.5 times the walked length of E's.
  **Spawns** are drawn at the end of `genSewer`, from `Rn`, after everything
  else, so they never move the layout. A brood room
  holds one `brood` at the farthest of 12 dry spots from its entry (the first
  point outside the room of the tunnel to its neighbour of lowest depth), 2 to
  4 `rat`, and with chance 0.4 one `drowned`. A tunnel post (half the tunnels)
  holds a `drowned` with chance 0.4, else a pack of three `rat`: the post and
  two points 1.2 m either way along the tunnel, each kept only if dry and open
  (`kind: "tunnel"`). No E type spawns in D. The boss, `croc`, is the last
  spawn: in the middle of the centre pool, facing the entrance
  (`kind: "boss"`).
  - **Pool rooms.** `crossingOf(n)` (beside the spawn block, no draws) finds
    the pair of the room's bodies whose nearest grid points are closest, when
    that gap is at most `SEWER.pool.cross + 2`: `{ x, z, a, b }`, the midpoint
    and the two body ids, kept on the node as `n.cross` (`null` outside pool
    rooms). With chance 0.5 a pool room is a siren room: one `siren` at the
    water point of the larger of `cross.a` and `cross.b` nearest the
    crossing. Otherwise, or when no such point exists, it is an eel room: 1
    `eel`, with chance 0.4 a second, each in a different body, bodies other
    than the crossing's two first. A siren or eel stands at least 1 m in
    from the shore (every point within 1 m reads water 1) and 1.5 m from
    anything else the room holds. Either kind then gets 2 to 3 `rat` on dry
    floor and 1 to 2 `bloater` on any water point that holds one (`waterAt`
    at least 0.5 and `fieldAt` at least 0.4). Every pool-room spawn records
    `kind: "pool"`.
  - **Gutters and grates.** Each gutter body (`room` -1) holds, with chance
    0.35, one `bloater` at its most open water point (`kind: "tunnel"`).
    Each entry of `grates` holds, with chance a third, one `grabber` 0.4 m
    out from the grate along its `yaw`, with that `yaw` (`kind: "tunnel"`),
    kept only where `fieldAt` is at least the grabber's 0.35 and the floor is
    dry. `makeEnemy` copies the spot and yaw into `hx`, `hz` and `hyaw`.
  - Every water-bound spawn is on a point where `waterFoot` holds for its
    radius (siren 0.6, eel 0.45, bloater 0.4), checked from the grid because
    no enemy exists yet. All of these draws come last, so they move only the
    spawns hash in t22.
- **Pillars** are square brick piers in the field, so they block movement,
  sight, routes, shots and the camera like any wall. Pool, brood and rest
  rooms whose shorter half-size is at least `SEWER.pillarAt` (9 m, about
  three rooms in four) try a pair through the middle or one pier, near half way to the
  walls; the arrival hall and the boss cavern have none. A pier is
  `2 * pillarHS` (2 m) wide and centred on a grid point, so its faces lie on
  grid lines and the wall drawn round it is its footprint. Every pier keeps
  3 m from the room's walls and other piers, out of each tunnel's lane
  (`tunR` from the line from mouth to middle), clear of the rest plinth,
  and either with no water within 3 m or inside a pool with `pillarWet`
  (2 m) of water on every side, so it never leaves a sliver of water or a
  narrow walkway (`pierFits`). A spot that breaks a rule is passed over.
  A pool room of that size, with chance `SEWER.poolPier.p` (0.75), places
  its pier first (`poolPiers`): a spot where a pool can hold it, then the
  layout from `poolLayouts` with the most water whose pool holds it with
  `pillarWet` all round and whose walkways still join the mouths. Those
  draws come from the room's own stream, so every other room lays out as
  before. Any other room, and a pool room where that fails, places piers
  after the water, round it. Over 40 seeds about 52% of pool rooms of that
  size have a pier (18% before pool rooms placed theirs first; about 64% at
  `p` 1), and every pool-room pier stands in water. About 56% of fight
  rooms have piers. The
  field and the vault dip to meet a pier; `dressRooms` draws its plinth and
  capital and keeps arches clear.
- Water in the sewer: pools in pool rooms (two to four separate bodies, a
  crossing between two of them, dry walkways joining every entrance), a gutter
  along some tunnels (never joined to a room's pools) and some brood rooms,
  and the boss cavern's moat, centre pool and fall pools. The fall pools sit
  within 6 m of the cavern wall, so the ring ten metres in from the edge stays
  dry. A dry route joins every tunnel mouth of every room: no route is
  forced through water. The rules the D enemies rely on, from the spec's
  Water section: every pool is a box at least `SEWER.pool.min` (4 m)
  across; a pool room's dry floor is at least 3 m wide from each pool to
  the walls and between pools, but for the crossing, 2 to 3 m wide, that
  every pool room has; a brood room holds at most one body of water, and
  the arrival hall and rest rooms none; about a third of tunnels have a
  gutter, and no gutter comes within 2 m of a room's water. A pool's shore
  is drawn up to half a metre past the box painted on the grid, so pools
  stand `edge` plus `grid` (3.5 m) in from the walls.
- **The drawn shore is where `waterAt` reads 0.5.** `floorCell` splits the
  floor of each cell where `Wt` crosses 0.5 along the cell's sides, which is
  where the bilinear reading crosses it there. Inside the cell the bilinear
  line bows off that straight split: by 0.061 m for one corner of 1 and
  three of 0, and up to about half the cell for corner values near 0.5, so
  a cell that bows more than the first is drawn as four smaller squares,
  down to an eighth of a cell. A saddle goes the way its middle reads. t22
  checks the two agree within 0.08 m on every walkable point near a shore.
  Pools, brood gutters and the cavern's water are 0 or 1 on the grid; a
  tunnel gutter's `Wt` ramps from 0 to 1 over the metre across its shore,
  `SEWER.gutterW` from its wall, and across where it stops short of a room,
  the cavern or another tunnel, so its edges run straight and not in steps.
  `bodyAt` reads the nearest grid point, so beside a gutter's shore it can
  be -1 where `waterAt` reads 0.5 or a little more. Never draw water from
  anything but `Wt`.
- The ceiling is brick, a vault that rises into rooms, and `ceilAt` follows it
  so the camera collides with the arch. Ribs, pipes, grates, lamps, brick
  heaps, pillar bases and the ladder in the arrival hall are drawn and block
  nothing (`dressSewer` in `03d_sewerdress.js`: `sewerKit` holds the shapes
  and wall fittings, and one function dresses each area, `dressTunnels`,
  `dressHeaps`, `dressRooms`, `dressArrival`, `dressRests` and `dressBoss`, in
  that order, all drawing from `Rd`). The crumbled wall sections are the only irregular
  field. Lamps are dim green lights, and some flicker (`lampFlicker(ph, t)`).

## Game side

- The sewer's own game-side parts: `WATER` (`slow` 0.6 and `sink` 0.3), drips
  from the roof (`dripsUpdate`, `G.drips`, only while `G.world.sewer`),
  wading ripples and the wade sound, and `SFX.setEcho`, an echo in
  `04_audio.js` that is on only in the sewer. Only the drip sound goes
  through it (`tone`'s `send`, `echoIn`); every other sound stays dry. The
  hall and cave keep their sound. `DRIP` sets how many drips fall (`rate`
  15 a second) and how often a landing is heard (`voice`). `resetRun()`
  clears `G.drips`.

## Tests

- Run `tests/t22.mjs` after any change to the sewer, water, `fieldFns`,
  `meshSink`, the world shader, `visiblePieces`, cleared grades or portal
  opening: `SCRIPT=$PWD/tests/t22.mjs node test.mjs smoke`. It starts a run
  with `DF.newRun(seed, "D")`, which does not read `LIVE_GRADES`.
  It checks that `genWorld` is unchanged (hashes of caves 1, 7 and 99), that
  `genSewer` is unchanged (hashes of the mesh, materials, `Wt`, spawns, pieces
  and dressing for seeds 1, 5 and 9; update them only for a change meant to
  alter the sewer, and say so in the commit), that the drawn shore is where
  `waterAt` reads 0.5, the water rules above and the pillar rules (their
  share of fight rooms, a third to 0.6, at least 0.45 of the pool rooms
  big enough for one, that each blocks and is drawn on its footprint) over twelve seeds,
  water
  in the player and enemy moves, D sealed and opened, the save, the layout
  over many seeds, water bodies and dry routes, the boss cavern, the brick
  and water materials, lamps, drips, the minimap, that every walkable point
  in sight of the camera (placed and pulled in as `camUpdate` does, on the
  way to the boss, in rooms and in tunnels, at several headings) within the
  fog is in a listed piece, that each world carries its own `cut`, and the
  triangle budget. It also writes
  screenshots (`shots/t22-*.png`) of the cave, hall, sewer rooms, tunnels,
  bends, the boss cavern and wading, which are the only check on whether the
  sewer reads as brick and not as a brown cave: look at them.

## Known problems

- The sewer is untested by hand. Its layout numbers, `WATER.slow`, the drip
  and flicker rates, the echo and the look were set by tests and screenshots
  only.
- Water depth is drawing only: a body is drawn sunk by `WATER.sink`, while
  hits, shots and the camera stay on the flat floor.
- The sewer's frame rate on a real phone is unmeasured. The budget is
  triangles drawn (at most what the whole of cave 99 draws), measured in
  headless Chromium.
- `sees` still comes from sampled sight lines, so some camera spot could in
  principle see a piece that is not drawn. No such view turned up in about
  100,000 camera views over 32 seeds, measured as t22 does; t22 itself
  checks six seeds.
- Sewer decoration (brick heaps, plinths, ribs, pipes) blocks nothing, so a
  body can stand inside a heap.
- D is open on the published page to anyone who has killed E's boss, and
  none of it has been played by hand. It fights the D enemies everywhere
  (rat, drowned and brood mother in brood rooms and tunnels, siren or eels
  with rats and bloaters in pool rooms, bloaters in gutters, grabbers at
  grates) and Old Sluicejaw in the cavern, which leaps into its wall
  tunnels and throws plates at each mark until a parried plate knocks it
  down, and below half health its ceiling falls in on the ring. Grades
  still carry no difficulty or rewards, so clearing D gives nothing but
  the record that it was cleared.
