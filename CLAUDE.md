# Working notes for DungeonRaze

Read `README.md` first for what the project is and how to build it. This file
is what you need to change the code without breaking it.

## Where the project stands

- A playable combat spike, built in one conversation, tuned by automated tests
  and screenshots only. No human had reported on feel when this was written.
- The owner wants a hack-and-slash with Soulslike and God of War style combat,
  set mostly in cave systems so that little art is needed. The inspirations are
  Solo Leveling, Jujutsu Kaisen, Attack on Titan and Ghostwire Tokyo.
- Names, characters and signature moves from those series are deliberately not
  used. The classes are the generic hunter archetypes with original kits.
- An earlier idea, a shadow-necromancer class that raises killed enemies, was
  dropped by the owner. Do not reintroduce it unless asked.
- The intended next stage is to widen the game with several agents working in
  parallel, once the owner says the combat feels right.
- Touch controls for phones and tablets were added on branch
  `feat/touch-controls`, tested under Chromium device emulation only. No
  phone has been played on yet.
- The game starts in a base of operations: a built hall with six portal frames
  graded E, D, C, B, A and S, and a training dummy. Only E is open and it leads
  to the cave. Grades carry no difficulty or rewards yet; the owner wants
  enemy difficulty and kill rewards to scale by grade, with S the hardest.
- Controller support was added on branch `feat/controller-support`, tested
  with a faked Gamepad API only. No real pad has been played yet.
- Branch `feat/plaques-enforcer` added three plaques on the hall's left wall,
  an Inspect close-up, input codes that unlock hidden classes, and the first
  hidden class, the Enforcer.
- Branch `feat/sapper` added the second hidden class, the Sapper: a
  sledgehammer, landmines joined by tripwires, and a cave-in that crushes a
  pack and walls off a tunnel for a while.
- Branch `feat/riftwalker` added the third and last plaque class, the
  Riftwalker: paired rift ends that the player, regular enemies and shots
  pass through, and a Drop that sends a pack through the floor and out of
  the roof. No plaque is sealed now.
- Branch `feat/sewer` is the first of three projects for the D gate: the
  sewer zone, its water, and D opening once E's boss is dead. Branch
  `feat/d-enemies` is project 2, built in two batches. Batch 1 added the
  per-type hooks and the rat, the drowned and the brood mother, which fill
  the brood rooms and the tunnels. Batch 2 (`feat/d-enemies-water`) added
  the siren, eel, bloater and drain grabber, the rules for enemies bound to
  water or a wall, a held player state, and their placement: sirens or eels
  in pool rooms, bloaters in pools and gutters, grabbers at grates. Only the
  crocodile boss (project 3) remains before D joins `LIVE_GRADES`. Until it
  lands, `LIVE_GRADES` holds only E, so the D portal stays sealed on the
  published page. A D run made live by hand has no E type in it but the
  Warden, which holds the cavern. The design is in
  `docs/superpowers/specs/2026-11-19-d-enemies-design.md` for the enemies and
  `docs/superpowers/specs/2026-11-18-sewer-d-gate-design.md` for the sewer.
  It has been checked by tests and screenshots only, never played by hand.

## Rules of the build

- `node build.mjs` after every source change. The page that runs is
  `dist/index.html`, and it is not committed. A push to `main` builds it
  and publishes it to GitHub Pages (`.github/workflows/pages.yml`).
- All `src/*.js` files are concatenated into one function scope. There are no
  imports or exports. Declare a name once across the whole of `src/`.
- No dependencies, no network requests at run time except Google Fonts. The
  game is also published as a single hosted HTML page whose content policy
  blocks loading models, images or data from other sites, so keep everything
  generated in code or inlined.
- Pointer lock, fullscreen and audio must start from a click or key handler,
  and a refusal must be caught. `G.noLock` is the fallback when lock is denied.

## Conventions that are easy to get wrong

- **Axes:** the ground is the XZ plane, Y is up, units are roughly metres.
- **Facing:** an angle `yaw` means forward is `(sin yaw, 0, cos yaw)`. Use
  `Math.atan2(dx, dz)` to get the yaw from one point toward another.
- **Right-hand side:** with forward as above, right is `(-cos yaw, 0, sin yaw)`.
  A figure faces its local +Z, so its right arm sits at negative X.
- **Node transforms:** `Nd` composes translate, then rotate Y, X, Z, then scale.
  Only leaf nodes that carry a mesh should have non-uniform scale.
- **Limb rotation:** a limb hangs along -Y from its pivot. Negative X rotation
  swings it forward, positive swings it back. Positive Z rotation moves a
  hanging limb toward +X.
- **Colour:** `hexc(0xRRGGBB)` converts to linear RGB. World vertex colours are
  stored square-root encoded in bytes and squared in the shader. The alpha byte
  is a glow amount, used by crystals.
- **Minimap:** it is mirrored in X on purpose so left and right match the
  camera.

## How the systems fit together

### Renderer (`R` in `02_gl.js`)

- One lit shader for everything solid. Normals are computed per pixel from
  screen-space derivatives, which gives the faceted look and makes triangle
  winding irrelevant.
- Up to eight point lights per frame, chosen in `buildLights()` in
  `07_render.js`: the player's lamp first, then shrines, gate, flashes, the
  boss, then the nearest crystals.
- `uToon` switches characters to three-step lighting. The world uses smooth
  wrapped lighting.
- Effects go through `R.sprite`, `R.ribbon`, `R.ring` and `R.blob`. They are
  batched and drawn after the solid pass: blobs darken the ground, everything
  else is additive.
- **Materials.** The world mesh has one material byte per vertex, a fourth
  attribute (`aMat`, location 3). `MAT` in `03_world.js` names the values:
  0 plain, `MAT.BRICK` 1, `MAT.WATER` 2. `meshSink` takes a `mat` argument on
  `tri` and `triC` and returns `M` beside `P` and `C`. The cave and the hall
  write 0 everywhere (`world.mat` is `null` or all zero), so they draw as they
  always did. The fragment shader draws brick (courses, mortar, per-brick
  shade, dark and missing bricks) and moving water from world position and
  `uTime`, which `R.env.t` sets from the game clock. Missing and dark bricks
  are the shader's, not geometry (the walls stay straight). A mesh with no
  material reads plain.
- `R.setWorld(pos, col, mat, pieces)` uploads the world and frees the one it
  replaces. `R.drawWorld(ids)` draws the whole world when `ids` is `null` or
  the world has no pieces, otherwise only those pieces (ranges of the
  vertices). `R.stats` is `{ draws, tris }`, reset in `begin` each frame, so
  `R.stats.tris` after a frame is what that frame drew. `R.boxVisible(box)`
  tests `[x0, y0, z0, x1, y1, z1]` against the view of the current frame.
- `R.nodePos(node, x, y, z)` returns a world position on a figure, valid after
  that figure has been drawn in the current frame.
- `R.toScreen(x, y, z)` projects to CSS pixels for HUD elements.

### World (`genWorld` in `03_world.js`)

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
  each other. This is how the Sapper's rubble blocks movement, sight, routes,
  shots and the camera. **Rubble is only ever a change to the field.** Never
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
- **Pieces** (`sewerPieces` and `visiblePieces` in `03e_sewerview.js`). The
  sewer's mesh is cut at build time into `world.pieces`, one
  per room and one per stretch of `SEWER.piece.runs` tunnel runs. A piece is
  `{ first, count, box, sees, ... }`: a range of vertices, a bounding box and
  the ids of the pieces visible from anywhere in it. `sees` is worked out with
  `world.los` between sample points (a 3 m lattice and every second cell of
  a piece's rim) and errs generous: its grid neighbours are always in it, and
  so are the neighbours of every piece that sight put in it, because the
  camera can see round a corner that no pair of samples clears. `world.pieceGrid` and `world.pieceAt(x, z)` give the piece at a
  point, or -1 outside every piece. The cave and hall have `pieces: null` and
  are drawn whole.
- `visiblePieces(w, cx, cz, px, pz, frustum = true)` returns the ids to draw:
  what the camera's piece and the player's piece see, within the fog distance
  (`SEWER.piece.fog / ENV_SEWER.fogD`) and, with `frustum`, inside the view
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
  (`kind: "tunnel"`). No E type spawns in D but the Warden.
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

### Zones (`06_game.js`, `03b_hub.js`)

- `G.zone` is `"hub"` for the hall or `"cave"`, and stays `"cave"` for every
  grade's run, the sewer included. `G.grade` says which. `G.world` holds
  whichever world is active, and nothing else is kept loaded.
- `enterHub(fromGrade)` builds the hall and puts the player at the start, or
  in front of that grade's portal looking toward the middle of the hall. `enterCave(gradeId, seed)` calls
  `newRun(seed, gradeId)`. `newRun(seed, grade = "E")` records `G.grade`, sets
  the air from `ENV_GRADE[grade]` (the cave's when the grade has none), builds
  the world with `WORLD_GEN[grade]` (`genWorld` when the grade has none), turns
  the audio echo on for a world with `sewer: true` and starts the run. It is
  what the cave and sewer tests call.
- `genHub()` returns every field `genWorld` returns, with empty arrays where a
  field has no meaning, plus `hub: true`, `portals` and `dummySpot`. Keep it
  that way: code that reads `G.world` has no checks for the hall.
- The hall and the cave share `fieldFns` and `meshSink` in `03_world.js`, so
  both collide and pack triangles the same way.
- The hall is centred on the origin with north at +Z. The player starts facing
  +Z, so E, at +X, is on their left.
- A portal is `{ x, z, yaw, grade, open }`, listed in `hubPortals()`. The
  position is a point on the floor in front of the frame and `yaw` faces into
  the hall. The frame, its collision block, floor ring, glow, light, label and
  return point are all built from the entry. Its opening sits `PORTAL_IN`
  behind the position, and stepping within `PORTAL_R` of the opening of an
  open one calls `startTrans`, which fades out, swaps the world at full black and fades
  in. The transition is advanced by `update`, which does nothing else while
  `G.trans` is set, so `DF.sim` drives it in tests.
- `resetRun()` clears everything that must not cross a world swap. Add new
  per-run state there. It clears `G.inBoss`, the flag for the player being
  inside the boss chamber.
- `R.env` (ambient and fog) is set per zone from `ENV_HUB`, `ENV_CAVE` and, for
  the sewer, `ENV_SEWER` (damp green-dark, thicker fog), through `ENV_GRADE`.
  `setEnv` copies the preset.
- The sewer's own game-side parts: `WATER` (`slow` 0.6 and `sink` 0.3), drips
  from the roof (`dripsUpdate`, `G.drips`, only while `G.world.sewer`),
  wading ripples and the wade sound, and `SFX.setEcho`, a short echo in
  `04_audio.js` that is on only in the sewer. The hall and cave keep their
  sound. `resetRun()` clears `G.drips`.
- In the hall, focus and tool charges refill on their own, the minimap is
  hidden and the run timer does not advance.
- Plaques. `hubPlaques()` lists `{ id, cls, x, z, yaw }` for the three plaques
  on the left wall (x = 14.85), and `genHub` returns them as `plaques` (the
  cave returns `[]`). `cls` is the class a plaque unlocks, `null` while sealed.
  `plaqueFront(q, d)` is a point `d` in front of one, `PLAQUE_Y` its height,
  and `plaqueAt()` the plaque the player is near and facing, or `null`. The
  glow is drawn as sprites each frame, because the hall mesh is built once
  and the glow brightens on unlock.

### Game state and time (`06_game.js`, `09_main.js`)

- **Cleared grades.** `CLEARED` maps a class id to the grades its boss kill has
  cleared, saved as `c` in `dungeon-raze.v2`. `clearGrade(grade, cls)` records
  one (true when new), `gradeCleared(grade)` is true if any class cleared it,
  and `resetCleared()` empties it. A saved `c` that is not an object loads as
  nothing cleared. `kill` records the grade when a boss dies, and says "A new
  gate has opened in the base." when that opens the next portal.
- **Which gates are open.** `LIVE_GRADES` (in `03b_hub.js`) is the set of
  grades whose content is finished. `portalOpen(grade)`: E is always open;
  a higher grade is open when it is in `LIVE_GRADES` and the grade below is
  cleared. `hubPortals()` takes `open` from it. **D joins `LIVE_GRADES` only
  when project 3 (the crocodile) lands**, because the Warden must not appear
  in the published D. Tests add and remove it through
  `DF.LIVE_GRADES`.

- `G` is the single state object. `G.state` is one of `title`, `play`,
  `pause`, `dead`, `win`, `class`, `controls`, `howto`, and `show(state)`
  switches screens. `MENUS` in `09_main.js` lists the screens that open on top
  of the title or pause screen and return to it; add a new one there and to
  `SCREENS`.
- `update(dt)` advances the simulation. The frame loop scales `dt` for
  slow motion (`G.slowT`) and skips it for hit-stop (`G.hitstop`).
- Timings in the data tables are in seconds, so the game is frame-rate
  independent.

### Input and bindings

- `keys[code]` is true while held and `taps[code]` is true for one update after
  a press. Codes are `KeyboardEvent.code` values, and mouse buttons are
  `Mouse0`, `Mouse1`, `Mouse2`.
- Game code never reads raw codes. It calls `held('action')` and
  `hit('action')`, which look the code up in `BIND`.
- To add an action: add it to `DEFAULT_BINDS` and `ACTIONS`, then read it with
  `held` or `hit`. The controls menu picks it up automatically.
- `interact` is G and pad A or Cross (`P:0`). Dodge is Space on the keyboard.
  The plaques release had dodge on B and Interact on Space; `loadOpt` moves a
  save holding exactly that pair to Space and G, unless G is taken.
  In the hall, a free player at a plaque opens it with `interact` before
  any other action is read. The jump planned for the same button must keep
  that priority.
- A touch button does not go through `BIND`. It sets `keys["T:" + action]`
  and `taps["T:" + action]`, and `held(a)` and `hit(a)` read that key beside
  the bound one. `hit` reads both taps so that both are consumed. The stick
  sets `T:sprint` when it is pushed past its ring. An action with a touch
  button needs an entry in `TOUCH_BTNS` and `LOOK` (see below).
- A pad button sets `keys["P:i"]` and `taps["P:i"]`, where `i` is the index in
  the standard mapping. `held(a)` and `hit(a)` read it through `PAD_BIND`
  beside the key and the touch button. `hit` reads all three taps so that all
  are consumed. To give an action a pad default, add it to `DEFAULT_PAD`.
  Movement has no entry, because it is the left stick.

### Touch (`08b_touchlayout.js`, `08c_touch.js`)

- `touchLayout(W, H, insets, { size, notch })` is a pure function. It returns
  every position: `btns` (`{ act, x, y, d }`, `d` is corner-to-corner width),
  `pause`, the stick area `move`, its resting place `rest`, radius `R` and
  sprint `ring`, and the `vitals`, `map` and `boss` boxes for the HUD. It
  tries the requested size and steps down by 0.05, to 0.8 at the least, until
  `layoutProblems(L)` finds nothing. `L.scale` is the size it used.
- **Every control comes from the layout.** Nothing else in `src/` holds a
  pixel position for a touch control. The overlay is an SVG drawn from
  `TOUCH.layout`, hit-testing is `hexContains` on the same entries, and
  `place()` writes the HUD boxes as inline styles. To add a button, add it to
  `TOUCH_BTNS` and `LOOK`, give it a spot in `layoutAt`, and make
  `layoutProblems` pass on every device in `tests/devices.mjs`.
- The sizes, button positions and margins are in the comments and code of
  `layoutAt`. They derive from the short side of the screen. The button
  arrangement is one the owner drew on a OnePlus 13 (905 by 412): each
  button sits a set gap from the one it hangs off, in the direction that
  layout had, and `tests/t13.mjs` holds it to within 3 px there.
- `TOUCH` is the controller. A finger belongs to the control it first touched
  (`TOUCH.owners`, keyed by pointer id) until it lifts: a button, the pause
  square, the stick or the camera. A second finger in the stick area turns the
  camera. `release()` drops every finger and every `T:` key, and runs when the
  state leaves play, on every relayout and when touch mode turns off.
- The stick lands where the thumb does. `TOUCH.move` is `{ x, y, mag }`, and
  `playerUpdate` uses it in place of the movement keys while `mag > 0`, with
  `mag` scaling walk speed. A drag of the camera area is added to `mouse.dx`
  and `mouse.dy`, as a mouse would be. The Attack finger aims after it moves
  8 px. A quick sideways swipe of a camera finger while locked sets
  `mouse.wheel`, which switches the lock.
- **Touch mode.** `TOUCH.on` is set at start when the browser reports a coarse
  pointer, or no hover with touch points, or the URL has `?touch=1`
  (`TOUCH.forced`). It adds `body.touch`, which the CSS uses to show the
  buttons and hide keyboard-only parts. Unless forced, the last input decides:
  a key or a mouse move turns it off, a touch turns it on, and that touch is
  handled as the first press on the controls. Volume and media keys, an
  on-screen keyboard's composition and unidentified keys do not count as a
  keyboard. A forced page ignores the mouse and shows a readout of size,
  insets and scale.
- Layout follows the visible size and the safe-area insets, read through a
  hidden probe element with `env(safe-area-inset-*)`, which is read again only
  after a resize, orientation or visual viewport event or a `TOUCH.relayout()`
  call. `update` compares the size and settings every frame, and those events
  call `relayout` only when that comparison changed, so a resize that changed
  nothing keeps the fingers.
  Tests fake the insets with `window.__fakeInsets` or `TOUCH.fakeInsets`.
- Held upright, a touch device gets `body.portrait`, which shows `#rotate`
  ("Turn your device sideways to play.", with a smaller line about rotation
  lock) over everything, and the game pauses. A tap on it asks for fullscreen
  and a landscape lock (`goLandscape`), for phones with auto-rotate off; it
  does not arm Back or start play. The layout is made for a visible short side
  of 280 px or more.
- `TOUCH.enterPlay` runs from the play tap: one history entry so that Back
  pauses the game, then `goLandscape` (fullscreen, then a landscape lock).
  `popstate` under touch pauses from play and arms another entry. From the
  pause, dead and win screens it only arms another, and from a menu it goes
  to the menu's return screen as that screen's Back button does, so a second
  Back does not leave the page. Back is not caught on the title screen. Each
  of fullscreen and the lock can be refused or missing, as on iPhone, and
  every refusal is caught.
- Under touch the game also pauses when fullscreen ends (Android's Back
  leaves fullscreen first and sends no `popstate`), when the page is hidden
  and when the window loses focus. Resume asks for fullscreen again. Desktop
  keeps its own rule, pausing when pointer lock is lost. A test that calls
  `exitFullscreen` in play therefore ends up paused.
- Plaques by touch. The layout gives `prompt` (the Inspect prompt, tapped to
  open; the first of four spots clear of buttons and HUD), `dpad` (in the
  stick area) and `close` (the card's box; a tap on the card closes it).
  `layoutProblems` checks all three. While a plaque is open, `classify`
  sends the D-pad arms as `T:fwd`, `T:back`, `T:left`, `T:right`, the buttons
  as usual, the card as `T:interact`, and nothing else. The D-pad replaces
  the stick in the SVG only then. `place()` sizes the prompt and the card.
- Settings are `OPT.tsize` (0.8 to 1.2), `OPT.topac` (0.2 to 1) and
  `OPT.tnotch`, saved under `o` in `dungeon-raze.v2` and set in the Controls
  menu. Menu text that differs by input uses `.kbonly` and `.touchonly`, or
  `.lk-mouse` and `.lk-touch` inline. The Execute prompt and the class kit
  show the button names (ATTACK, HEAVY, TOOL, ABILITY) under touch, and How to
  play names the pause button. Button hover styles apply only where
  `(hover: hover)`, so a tap leaves nothing highlighted.
- The stick lands where the thumb does, but its origin is clamped so the stick
  body stays inside the stick area, clear of the health bars. Landing at an
  edge therefore starts with the stick already pushed.
- Under touch the HUD hides the flask and tool counts, because the Flask and
  Tool buttons show them, and the boss name plate is held inside the boss box.

### Controller (`08d_pad.js`)

- `PAD` reads `navigator.getGamepads()` once a frame in `PAD.poll(dt)`, which
  `frame` calls. It merges every listed pad: a button counts as down on any
  pad. `keys["P:i"]` and `taps["P:i"]` are set from that. A trigger
  (`P:6`, `P:7`) is down past half travel. The press edge is taken against the
  last poll's merged state, so the first press of a pad that has just appeared
  is not lost. A missing or throwing `getGamepads` means no pads, with no error.
- `frame` skips `poll` while `G.manual` is set, so tests call `DF.PAD.poll`
  themselves, usually through `DF.sim(s, () => DF.PAD.poll(1 / 60))`.
- `PAD_BIND` maps an action to a `P:` code and `DEFAULT_PAD` holds the
  defaults. It is saved under `p` in `dungeon-raze.v2`. A saved code that
  is not in `PAD_CODES` falls back to the default. `PAD_CODES` is every
  bindable code: 0 to 8, 10 to 15 and 17. `P:9` (Menu or Options) pauses in
  play and resumes from pause, and is fixed. The D-pad is bindable in play and
  moves menu focus on a menu. `mute` is bindable too: `poll` consumes its
  tap in play and calls `SFX.toggle`. `setPadBind` swaps with the action that
  held the code.
- Axes. A pad whose `mapping` is not `"standard"` may rest an axis off-centre
  (older Firefox puts the triggers on axes at -1). `PAD.ax(p, i)` reads such an
  axis as 0 until it has once been inside the dead zone (`PAD.axOk`, by pad
  index and axis, forgotten when the pad is gone). Standard pads are read at
  once. Every stick read goes through `PAD.ax`.
- Sticks. `PAD.vec` takes, from whichever pad pushes a stick furthest, a
  direction scaled by its magnitude past a radial dead zone of 0.2, so an idle
  second pad (Steam adds a duplicate) cannot cancel the other. `PAD.move` is the
  left stick: `x` right, `y` forward, `mag` 0 to 1. `playerUpdate` uses it in
  place of the movement keys while `mag > 0` and the touch stick is idle.
  `PAD.look` is the right stick with a squared response.
- Camera. `poll` turns `cam.yaw` and `cam.pitch` itself, at 3.0 and 1.8 rad/s
  at full push and `OPT.psens` 1, with pitch clamped as in `camUpdate`. It does
  not touch the camera while locked. While locked, a flick of the right stick
  past 0.7 in x sets `mouse.wheel` once. The stick must rest before it
  arms again.
- Sprint is a latch. A tap of the sprint binding flips `PAD.sprint`. It
  clears when the stick rests, when stamina is out, when the state leaves play
  or when the pad goes. The player runs on the pad only while the latch is on
  and `PAD.move.mag >= 0.6`. A sprint attack starts the class dash on every
  input, because `playerUpdate` captures `wasSprint` before it clears
  `p.sprint`. Before this branch that dash was unreachable.
- Mode. `PAD.active` is set by a button press or a stick pushed past 0.5, not
  by drift. A key, a mouse move or a touch clears it (`PAD.init`), except that
  a touch is ignored while `body.padhide` is set, since it is then only a
  camera drag and the buttons it would name are hidden. Unplugging the last
  pad clears it too. It
  toggles `body.pad`, which shows `.padonly` and `.lk-pad` text and hides
  `.kbonly` and `.touchonly`. `body.padc` means a pad is listed at all.
  `body.ps` or `body.xb` is the button family. `PAD.fam` comes from
  `PAD.famOf(pad)`: PlayStation for Sony vendor 054c, DualSense or DualShock, or
  a "Wireless Controller" id that does not name Xbox or 045e (Chrome's Xbox id
  contains "wireless controller"). Use `famOf`, never a raw regex. `padName`
  names a code per family. `keyName` calls it for `P:` codes. `actKey(a)`
  gives the name of the input in use for prompts.
- `PAD.mute` holds codes that stay ignored until released. A screen change mutes
  every button held at that moment. An action in a menu that changes the
  screen takes what is held with it, so a press does not act twice.
- Menus. While the state is not play, `PAD.menu` keeps a focus on the open
  screen: the D-pad or left stick moves it to the nearest control ahead,
  repeating after 0.35 s and then every 0.12 s, `P:0` presses it and `P:1`
  clicks that screen's `[data-back]` button. `focusables` skips the keyboard
  binding column (`#binds button[data-act]`), which the rebind flow covers.
  A screen opens on its first control, or the one with `data-padfirst`
  (`#btnPlay`, because class cards come first). The focus is drawn by
  `.padfocus`, styled under `body.pad`. A range takes left and right.
  `PAD.menu` does not run while `PAD.rebind` is set.
- Rebinding. `PAD.startRebind(a)` waits for a pad button, which the Controls
  menu shows as "Press a controller button". It arms once every button is
  let go and takes the next press. `P:9` cancels. A key wait started with the
  mouse is cancelled by any pad press.
- Starting play. `play()` calls `PAD.enterPlay` only when touch mode is off and
  a pad is the active input. It asks for fullscreen and catches a refusal,
  since a pad has no pointer to lock. Under touch, `TOUCH.enterPlay` runs
  instead. A pad press, a key press in play and a click on the canvas also
  call `SFX.init`, so audio is retried until it runs. `play()` does nothing
  while touch is on and the device is upright (`innerHeight > innerWidth`),
  because the rotate overlay covers the page, and `PAD.focusables` is empty
  under `body.portrait`, so no pad button can resume play there.
- Pausing. `P:9` pauses a pad player. So does unplugging the pad during play,
  which also clears every held `P:` key and the latch. On a desktop, play also
  pauses when pointer lock is lost and when fullscreen that the page entered
  ends. Esc or P also pause whenever the pointer is not locked, which is always
  so for a pad player. Under touch the rules of the Touch section apply.
- With touch on and a pad connected, `TOUCH.update` sets `body.padhide`, which
  hides the buttons and the stick. The flask and tool counts are shown again,
  because no button shows them. `classify` stops treating those areas as
  controls so a finger there turns the camera. The buttons come back when the
  pad is unplugged, when `OPT.padHideTouch` (on by default) is turned off or
  when touch mode ends. A touch alone does not bring them back. The hint line
  (`#hint`) shows under touch only while `body.padhide` is set.
- Rumble. `PAD.rumble(kind)` plays a `dual-rumble` effect from `PAD_RUMBLE` on
  the pad last pressed, only while a pad is the active input and `OPT.rumble`
  is on. `hurtPlayer` plays hurt, parry and guard break, `hitEnemy` plays
  a heavy melee hit. The player's death and `startExecute` play their own.
  A missing actuator, a throw or a rejected promise changes nothing.
- Settings are `OPT.psens` (0.2 to 3), `OPT.padHideTouch` and `OPT.rumble`,
  saved in `o`. The Controls menu shows a pad column and these settings. It
  warns when a listed pad does not report the standard mapping.

### Player

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

### Hidden classes and codes

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
  unlocked class take nothing.
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
  `G.bombs`; it rides its enemy, falls to the floor if the enemy dies and
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
    skip a hidden enemy (`e.hidden`, see Enemies) as well; `grappleTarget`
    and `nearestStaggered` skip both.
  - **Execution.** The enemy is killed, then dropped like a Drop (its body
    falls in the `dead` case of `enemyUpdate`) and lands in one blast
    (`DROP.exec`). The boss takes the execution in place; the dummy stands
    back up.
  - `resetRun` and `respawn` clear `G.rifts` and `G.holes`; both rebuild
    every enemy, so nothing is left falling.
- `G.insp` is set only while the player is in `inspect`. Anything that moves
  them out of it closes the plaque on the next update.

### Enemies

- State machine in `enemyUpdate`: `idle`, `alert`, `chase`, `search`, `wind`,
  `act`, `rec`, `hit`, `recoil`, `stagger`, `roar`, `return`, `dead`, and
  two more that only some enemies use: `fall` (Drop) and `hold` (a grab, below).
- At most two non-boss enemies may attack at once. They claim a token with
  `takeToken`; the rest circle.
- `poise` 0 flinches on any hit, 1 only on heavy hits, 2 never.
- Posture fills from hits and parries and breaks into `stagger`, which opens
  the enemy to an execution.
- `aware` means "hunting the player": true in `chase` and `search`, false in
  `idle` and `return`.
- **Sight.** A regular enemy that is hunting follows the player only while
  `canSee(e)` holds: the line is clear and the player is within `sight` times
  `PURSUIT.seeMul`, in any direction. While it can see, it records where the
  player is and how they are moving (`lsx`, `lsz`, `lvx`, `lvz`). `lost` is
  the time since. A hit, or a neighbour's wake-up, also sets the last-seen
  spot.
- **Search.** After `PURSUIT.lostT` of broken sight, `chase` hands on to
  `search` (`toSearch`), which has three steps in `e.sub`: `go` routes to the
  last-seen spot, `guess` walks on the way the player was heading, `look`
  stands and sweeps. Seeing the player in any step returns to `chase`.
- **Giving up.** `giveUp(e)` is the one way a hunt ends: unaware, state
  `return`. `huntOver(e)` decides it for regular enemies: the player is in
  the boss chamber or dead, or the enemy is past `leashOf(e)` from its post
  with no provoke left. A hit sets `e.prov`, which suspends the leash for
  `PURSUIT.provoke` seconds, and a provoked enemy that wakes neighbours on
  their way home shares it with them.
- **Pack.** An enemy that can see the player keeps regular enemies within
  `PURSUIT.pack` in the hunt. One that is hunting but cannot see takes the
  player's position from it every step (`seeingMate`, `e.told`), so its
  search heads for where the player is now and it does not give up while it
  is being told. One that is idle or walking home is woken (`callPack`),
  under the territory rule below. The boss and the dummy take no part.
- **Territory.** An enemy walking home notices the player again only when
  `inTerritory(e)`: the player is within the leash less `PURSUIT.edge` of its
  post. This stops it turning straight back at the leash edge.
- **Boss chamber.** `G.inBoss` is set in `update`. While it is true, regular
  enemies give up and `alertE` refuses to wake them, whether by sight, a
  neighbour or a hit. `genWorld` keeps tunnel posts out of the chamber. An
  enemy hit in that time still flinches, so it can pass through `hit` and one
  step of `chase` while unaware. `chase` sends an unaware regular enemy
  straight home.
- **The boss** has none of the above. It keeps its 38 m and 30 m limits and
  its heal on return, and routes round rock when the line to the player is
  blocked.
- **Bound types.** An `EDEF` entry with `bound: "water"` or `bound: "wall"`
  is tied to a place. `bound(e)` reads it, and it is the one test for "heavy
  like the boss" in the class tools: the Enforcer's grapple pulls the player
  to it, and the Sapper's execution does not kick it. Its cave-in staggers
  it like any enemy, but not while it is hidden or safe (and `caveImpact`
  skips the forced stagger when a hook refused the hit). The Riftwalker's
  rifts and Drop never take it, and
  `separate` weights it like the boss, so other enemies cannot shove it.
  Its footing is a `foot` hook:
  - `waterFoot(e, x, z)` (bloater, eel, siren): `waterAt` at least 0.5 (the
    shore), `fieldAt` at least `e.r`, and the point is in the enemy's own
    body of water (`e.body`, read from where it first stood) or `bodyAt` is
    -1, which is the shore between two grid points.
  - `wallFoot(e, x, z)` (grabber): the post `hx`, `hz` and nowhere else.
  - `setRoute` gives a type that has a `foot` hook one straight point instead
    of a route, since the route grid knows nothing of water.
- **Hidden and safe.** `e.hidden` is an enemy that is not in the fight: it is
  not drawn, has no tag, cannot be locked, aimed at, hit (no flash, sound or
  alert), caught in a blast, grappled, staggered or executed, and does not
  separate or cross a rift. `makeEnemy` sets it for an `EDEF` entry with
  `ambush: true`, and its own step turns it off. Everything that skips a
  falling enemy skips a hidden one, and a lock drops the moment its enemy
  turns hidden. `e.safe` is the lesser case: still drawn and lockable, but
  not a target for damage (the eel under the water). `hitEnemy` refuses a
  hit quietly, a player's shot flies on past it (so it neither eats the shot
  nor sets off an `aoe` or sticky one), mines and tripwires ignore it, the
  cave-in forces no stagger on it, and `aimYaw` and `aimRanged` pass it
  over unless it is the locked target. An `ambush` type takes no
  part in being woken or waking others: it is left out of `seeingMate`,
  `callPack`, `alertE`'s neighbour wake and the sight wake-up, and its own
  rule says when it acts.
- **Water.** An `EDEF` entry may carry `wade`, a factor on its speed in
  water: below 1 slows it, above 1 speeds it. `wadeOf(def)` returns it, or
  `WATER.slow` when the entry has none, and E's types have none (the bloater
  is 1.0, the eel 2.0, the siren 1.8). `eStep`
  applies it (`wadeMul(waterAt(e.x, e.z), wadeOf(e.def))`), and `walkRoute`,
  charges and lunges go through `eStep`, so nothing needs a check in a state.
  A new way of moving an enemy must go through `eStep` too.
- **Movement.** In view, enemies steer straight at the player and slide
  along walls. Out of view they follow a route: `setRoute(e, x, z)` asks
  `world.route` (at most two per `update`, so callers retry when it returns
  false) and `walkRoute(e, speed, dt)` follows it. `routeAim(e)` is the step
  both it and the boss use to find the next point. `search` and `return` use
  them. A route that makes no headway for 1.5 seconds is dropped and asked
  for again.
- **Posts.** An idle regular enemy more than a metre from its post walks
  back. If a body cannot stand on a post because it is too tight against a
  wall, the nearest spot it can reach becomes the post.
- Every pursuit number is in the `PURSUIT` table next to `EDEF`. An `EDEF`
  entry may carry its own `leash`.
- `threat` on an `EDEF` entry is 0, 1 or 2: weaker than the player, around
  their level or slightly above, much stronger. Read it only through
  `threatOf(e)`, which is where levels will plug in. It colours the name tag
  above the enemy: `.tag.t0` white, `.t1` orange, `.t2` red, in
  `index.tpl.html`. The same classes style the name on the big boss bar.
- The HUD keeps a pool of ten overhead slots, each a name tag over a health
  and posture bar. The locked target takes a slot first. A boss on the big bar
  gets no slot, even when locked, because that bar shows its name. A boss
  that has not noticed the player gets the tag alone (`nobar`).
- A slot shows when the enemy is aware, hurt, or looked at, within 26 metres.
  "Looked at" is `looked` in `08_hud.js`: the enemy's body is inside a box
  around the screen centre and `world.los` from the player is clear. The box
  is tall because the resting camera looks down, so an enemy straight ahead
  sits above the centre. The HUD only reads enemies; looking never wakes one.
- `EDEF.dummy` is the training dummy. Its `dummy: true` flag is honoured in
  nine places: `makeEnemy` (always aware, so no ambush bonus and its bar
  shows), `enemyUpdate` (pinned in place, no AI), `hitEnemy` (health restored
  after every hit), `kill` (refuses), the `execute` case of `playerUpdate`
  (stands back up, and is not kicked by the Sapper or dropped by the
  Riftwalker), `caveImpact` and `separate` (not pushed out of the rubble),
  and `riftBodies` and `holesUpdate` (never crosses a rift, never falls).
  Any new way of killing or moving an enemy must respect it.

### Enemy behaviours (`06b_ebeh.js`, `05b_dbodies.js`)

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
    uses the shot's start, else the blast, else the player.
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
  `drawClouds`, `drawShocks` and `drawSongs`. Each reads the game's list
  (`G.clouds`, `G.shocks`, the singing sirens) and draws only effects
  (`R.sprite`, `R.ring`, `R.flat`), so it is all additive and the sewer's
  triangle budget is untouched. `resetRun` and `respawn` clear both lists.
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
  player (`canAttack`). Her lunge (`kind: "grab"`, unblockable, reach 4,
  never through a wall or pier) calls `grabPlayer` with a target `SIREN.drag` (2 m) past the shore into her pool,
  at `SIREN.dragSpeed` (5 m/s) for `SIREN.dps` (8) a second (`sirenDrag`
  finds the spot; she backs off along the line as she drags so the player
  reaches the water). When the hold ends however it ended she cannot attack
  for `SIREN.grabCD` (6 s) and goes back toward her post. Her song
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

## Recipes

### Add or tune a move

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

### Add a class

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

### Add an enemy

1. Add an entry to `EDEF` with its attacks and its `threat`, and a `leash`
   if it should hunt nearer or further than `PURSUIT.leash`. An attack with
   `trig` can start a sequence; one without can only be reached through
   another's `chain`.
   `unb: true` makes it unblockable and shows the red warning.
2. Add a figure in `makeEnemyFig`, with `f.rim` and `f.eye`. A D type puts
   its figure in `EFIG` and its pose in `EPOSE` (`05b_dbodies.js`) instead.
3. Reference the type name in `PACKS` in `03_world.js`, or, for the sewer, in
   the spawn block at the end of `genSewer`.
4. An attack with special movement needs a `kind` and handling in the `wind`
   and `act` cases of `enemyUpdate`. See `slam`, `charge`, `shot`, `volley`.
   A D type does this through the `wind` and `act` hooks in `EBEH`.
5. Behaviour that only this type has (a rule on when it may attack, a hit it
   refuses, ground it may not stand on, something it does each step) is a hook
   in `EBEH` (`06b_ebeh.js`), not a branch in `enemyUpdate`. Anything that
   moves the type must go through `eStep`.

### Open another portal

1. Give the grade a generator in `WORLD_GEN` (`genWorld` for the cave,
   `genSewer` for D) and, if its air differs, an entry in `ENV_GRADE`. A grade
   with neither entry gets the cave. The new generator must return the same
   shape as `genWorld` and `genHub`, including `waterAt`, `bodyAt`, `bodies`,
   `grates`, `wallTunnels`, `shafts` and `pieces`.
2. Add the grade to `LIVE_GRADES` in `03b_hub.js`, only when its enemies and
   boss are finished. `portalOpen` then opens its frame once the grade below
   is cleared (a boss kill saves that, see `CLEARED`). The frame, glow,
   trigger, label and return point all follow from the `hubPortals()` entry.
   Moving a gate is a change to that list.
3. Give `EDEF` entries for its enemies, with `wade` where water matters, and
   point its spawn packs at them. Until then a live grade runs on E's types
   (D has all but its boss, which is still the Warden).
4. Extend `tests/t8.mjs` and `tests/t22.mjs`: t8's "sealed frames do nothing"
   step assumes only E is open, and t22 makes D live and cleared through `DF`.

## Testing

- `window.DF` exposes the internals to tests. Set `DF.G.manual = true` to stop
  the frame loop from advancing the simulation, then call
  `DF.sim(seconds, eachStep)` to run it at a fixed 60 steps per second.
  Returning `false` from `eachStep` stops early.
- Simulate input by setting `DF.keys[DF.BIND.fwd] = true` or
  `DF.taps[DF.BIND.light] = true`.
- `DEVICE=<id> node test.mjs smoke` runs the page as a phone or tablet from
  `tests/devices.mjs`: its viewport and pixel ratio, touch on, fake insets, and
  play started by a tap. It exposes `__touch(type, points)`, which sends real
  touches through the Chrome DevTools protocol, and `__viewport(w, h)`.
  `node tests/touch-all.mjs <script>` runs a script on every device in turn and
  prints one line each.
- Run `tests/t13.mjs` after any change to `touchLayout`. It runs on the plain
  desktop page: `SCRIPT=$PWD/tests/t13.mjs node test.mjs title`.
- Run `tests/t14.mjs` on every device after any change to the touch controller,
  the touch HUD or menus on small screens:
  `node tests/touch-all.mjs tests/t14.mjs`. Touch steps send real touches, so
  they wait two animation frames before reading the result, compare positions
  with a tolerance, and read `TOUCH.owners` by iteration because the browser
  numbers pointers itself.
- Run `tests/t15.mjs` on every device to look at the controls over the hall
  and over a fight. Open `shots/<device>-touch-hall.png` and
  `shots/<device>-touch-fight.png` and check them by eye.
- Headless Chromium needs these flags for WebGL:
  `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
  Rendering is slow there, a few seconds per screenshot, which is why tests
  drive the simulation directly instead of waiting in real time.
- Run `tests/t16.mjs` after any change to `08d_pad.js`, pad bindings or the pad
  menus. It runs on the desktop page and fakes the Gamepad API with
  `navigator.getGamepads`: `SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`.
  Set `DF.G.manual` and call `DF.PAD.poll` yourself, as the steps do.
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
- Run `tests/t20.mjs` after any change to `fieldFns` rock or the Sapper's
  cave-in: `SCRIPT=$PWD/tests/t20.mjs node test.mjs smoke`. It checks rock
  on a hand-built corridor, then cave-ins in a tunnel of cave 99.
- Run `tests/t17.mjs` after any change to how a pad and touch share the screen.
  It uses a phone with a fake pad. Shots of the fight and the Controls menu go
  to `shots/`:
  `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke`.
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
  in D but the Warden, a siren or eels in each pool room and never both,
  the siren near the crossing, eels in different bodies, every water-bound
  spawn on its footing, grabbers at grates, bloaters only in water). Shots
  go to `shots/t24-*`: look at them, above all `t24-fight-pool-siren` and
  `t24-fight-pool-eel`, which are real pool rooms with everything awake.
- Run `tests/t22.mjs` after any change to the sewer, water, `fieldFns`,
  `meshSink`, the world shader, `visiblePieces`, cleared grades or portal
  opening: `SCRIPT=$PWD/tests/t22.mjs node test.mjs smoke`. It makes D live
  with `DF.LIVE_GRADES.add("D")` and starts a run with `DF.newRun(seed, "D")`.
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
  fog is in a listed piece, and the triangle budget. It also writes
  screenshots (`shots/t22-*.png`) of the cave, hall, sewer rooms, tunnels,
  bends, the boss cavern and wading, which are the only check on whether the
  sewer reads as brick and not as a brown cave: look at them.
- Run `tests/t5.mjs` after any change to cave generation and `tests/t6.mjs`
  after any change to classes or combat rules.
- Run `tests/t10.mjs` after any change to the HUD, enemy name tags or menus,
  and `tests/t11.mjs` to look at them. Both use `smoke`. Their steps wait two
  animation frames before reading the DOM, because the HUD only updates when
  a frame is drawn.
- Run `tests/t12.mjs` after any change to enemy movement, sight, giving up
  or `fieldFns`. It uses `smoke`. `DF.fieldFns` lets a test build a small
  field by hand, which is how the route tests make walls and gaps of an exact
  width.
- Run `tests/t8.mjs` after any change to zones, portals, the hall or the
  dummy, and `tests/t9.mjs` to look at the hall. Both use the `hub` mode:
  `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`. The cave scripts use `smoke`,
  which enters a cave after clicking play.
- A test step that returns an object with a `pass` value other than `true`
  fails the run with exit code 1.
- Screenshots are the only check on how things look. Take them; do not assume.

## Known problems

- Balance is untested by hand. In bot runs the Fighter looks strongest and a
  pack kills a passive player in about seven seconds.
- The camera can pass through characters at close range.
- Hiding and shooting with a ranged class is not prevented. An enemy that is
  hit runs to where the shot came from, which is the only counter.
- A regular enemy hit from inside the boss chamber takes the damage and does
  not respond. Such hits get no ambush bonus (`held` in `hitEnemy`).
- Enemies only route when the player is out of view. In view they still
  steer straight, so a wide enemy can catch on a corner the line of sight
  just clears.
- Controllers are checked only with a faked Gamepad API. No real pad has been
  tried.
- Whether a pad press may start audio and fullscreen differs by browser.
- The DualSense mapping in Firefox may be wrong. A pad that does not report
  the standard mapping gets a note in the Controls menu.
- The Enforcer, the plaques and the codes are untested by hand. The sticky
  bomb's self damage and the grapple's reach were set without a playtest.
- The Sapper is untested by hand. Its numbers, the cave-in's size and how
  long rubble stands were set without a playtest. Rubble is drawn as a heap
  about head high, while it blocks sight and shots as a full wall.
- The Riftwalker is untested by hand. Its numbers, the reach, how long ends
  stay open, the rest time and Drop's fall damage were set without a
  playtest. Nobody can see through a rift; ends are drawn as glowing slits.
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
- The D portal is sealed on the published page by design, until the
  crocodile lands. A D made live by hand fights the D enemies everywhere (rat,
  drowned and brood mother in brood rooms and tunnels, siren or eels with
  rats and bloaters in pool rooms, bloaters in gutters, grabbers at grates)
  and the Warden in the cavern.
- The rat, the drowned and the brood mother are untested by hand. Their
  numbers (speed, health, the cover's angle, the brood timer, cap and
  distances, placement odds) and how they look were set by tests and
  screenshots only.
- The bloater, eel, siren and drain grabber, the hold and their placement are
  untested by hand. Set without a playtest: `CLOUD` (size, length, tick),
  `EEL` (the 8 s count, the 1.2 s glow, 22 damage), `SIREN` (the song's
  pull of 2.6 m/s, the 2 m drag, the 5 m/s drag speed, the 6 s cooldown),
  `GRAB` (reach, arc, the 15 damage that drives it back, the 4 s rearm),
  `HOLD` (the 2 s hold, 0.35 s per mash, the 1.5 s grace), the placement odds
  (0.5 siren room, 0.4 second eel, 0.35 gutter bloater, a third of grates)
  and how all of it looks. Whether the hold feels fair, and whether a siren
  room is too hard with rats and bloaters in it, are the questions.
- A hidden grabber is invisible until it strikes, and its grate is the only
  sign. The grates are drawn for every tunnel, so a grate with no grabber
  looks the same as one with one.
- iPhones cannot run the file directly; they play at
  https://maxjlerman.github.io/dungeon-raze/.
- Touch was checked only in Chromium device emulation. Fullscreen, the
  orientation lock and the Back gesture in particular have not run on a real
  phone or on Safari.
- A swipe to switch lock target picks the next target without regard to the
  direction of the swipe.
- The Assassin's blink picks its own target when nothing is locked, which may
  not be the enemy the player meant.
- In the controls menu, Escape cannot be bound, and the pause key in the
  no-pointer-lock fallback is fixed to P.
- "Return to base" abandons the cave without asking, because nothing is lost
  yet. It will need a confirmation once runs carry rewards.

## Backlog, roughly in the order discussed

1. Tune feel from the owner's playtest: timing windows, sensitivity, difficulty.
2. Give the portal grades meaning: enemy difficulty and kill rewards per
   grade, then open D to S. D's place and water are built (`feat/sewer`) and
   so are its enemies (`feat/d-enemies`, `feat/d-enemies-water`); next are
   the crocodile boss, then adding D to `LIVE_GRADES`. Revisit whether dying should send the player back
   to the base once there are rewards to lose.
3. Loot, inventory and an extraction loop. The owner asked for these early on
   and they were set aside to get combat playable first.
4. More enemy variety and a second boss.
5. A harsher surface area or city zone, if the owner wants to leave the caves.
6. Split the work into lanes for parallel agents: combat and camera, enemies,
   world generation, loot and progression, rendering and effects, HUD, touch
   layout, touch input, tests.
   Agree shared data shapes (`CLASSES`, `MOVES`, `EDEF`) before fanning out.
7. A jump. The owner first asked for it on Space and A or Cross, with dodge
   on B. Dodge has since gone back to Space and Interact to G, so the
   keyboard key for a jump needs asking again (not Ctrl: Ctrl+W closes the
   tab). On a pad, near a plaque the same button inspects instead. What the
   jump is for in a fight (movement, clearing slam shockwaves, jump attacks,
   invulnerability) is undecided; ask the owner before building it. The floor is flat, so there is nothing to
   jump onto. A touch Jump button must fit the owner's honeycomb layout.
8. Hidden classes and joke classes. See `docs/ideas/joke-classes.md`. All
   three plaque classes are built. Still to come: the joke classes, quests on
   the plaques that open portals D to S to a class, and the in-game hunt that
   leads players to the hidden list of codes.

## Decisions already made, with reasons

- **Browser, not Unreal.** The owner considered Unreal for a commercial release
  and then chose a browser build to play sooner.
- **Own renderer, not Three.js.** The workspace it was built in could not
  download libraries, and a dependency-free page can be tested headlessly and
  hosted anywhere.
- **Primitive-built characters.** The hosting page cannot load outside models,
  and this keeps the repo free of binary assets.
- **Healer class left out.** It has no role in a solo game. The owner was
  offered a self-sustain version and had not answered.

## Commit conventions

Do not add `Co-Authored-By: Claude` or `Claude-Session` trailers.
