# The D-rank gate: the sewer

Design agreed with the owner on 2026-11-18. Read `CLAUDE.md` first for the
conventions (axes, the walkable field, zones, portals, tests).

The D gate is three projects, built in this order:

1. **The sewer** (this document): the place, the water, and D opening once
   E is beaten.
2. **The seven D enemies.** Decided in outline; see "Later projects" below.
3. **The crocodile boss.** Decided in outline; see "Later projects" below.

## Why

The portal grades are a ladder. Each grade above E must be harder than the
one before and take longer to clear, and be less straightforward. D is the
first step up. The owner wants it to be harder through new enemies that need
strategy, not through bigger numbers, and set in a sewer: twisting, winding
brick tunnels between larger rooms where sewer water runs freely. Water
slows the player, so where to stand becomes part of every fight.

## Goals

1. **D opens after E.** The D portal opens the first time the player kills
   E's boss, and stays open (saved).
2. **A sewer zone** behind the D portal, generated from a seed like the cave,
   about 1.5 times the length of an E run: a few more rooms than E, longer
   and more twisting tunnels, and some dead ends and loops so the way to the
   boss is not obvious.
3. **Water** that slows walking, running and dodging for the player, with a
   per-enemy-type factor so some enemies are slowed and others are faster in
   it.
4. **The look and sound** of an old sewer: crumbling brick, a dim green light
   that flickers now and then, water dripping everywhere, echo.
5. **Room kinds** laid out for the enemies to come: the arrival hall, pool
   rooms, brood rooms, and the boss cavern's shape.
6. **Drawing only what can be seen**, so a world this size, in brick, runs
   smoothly on phones.

## Non-goals

- The new enemies and the crocodile boss (projects 2 and 3).
- Rewards or loot. E has none either.
- Scaling enemy numbers (health, damage) by grade. D's difficulty comes from
  its own enemies.
- Opening C to S.
- Real floor heights. The floor stays one flat plane for every system.
- Any change to the classes, controls or touch layout.

## Anti-goals

- **A cave painted brown.** If the sewer reads as the E cave in brick colours,
  it has failed even if it works. The walls must look built: straight runs,
  even widths, arches, pipes, walkway edges.
- **E's enemies in the published D.** The owner does not want E's enemies in
  D at all, as filler or otherwise. Until project 2 lands, the D portal stays
  sealed on the live page. A push to `main` publishes straight to GitHub
  Pages.
- **Water as a special case for readers of the field.** Water is not rock
  and does not block anything. It is a second layer on the same grid, read
  through one function. Nothing should test "am I in the sewer" to find water.
- **A death that costs ten minutes.** A longer run needs more rest points
  (below).

## Constraints

From `CLAUDE.md`, the ones this work touches most:

- Everything is generated in code. No images, models or data loaded at run
  time. Brick is vertex colour and geometry.
- All `src/*.js` share one scope; a name is declared once across `src/`.
- Collision, sight, routes, the camera and the Sapper's rubble all read the
  one walkable field (`fieldFns`). The sewer must produce that field, so all
  of them work unchanged, including `addRock` for the crocodile fight's
  falling ceiling later.
- `genHub()` and `genWorld()` return the same shape. A new world function
  must return that shape too, and a new field on it (such as `waterAt`) must
  exist on all three, so no reader needs a zone check.
- `resetRun()` holds per-run state.
- `node build.mjs` after every change; tests drive the simulation with
  `DF.sim`.

## Approaches

Three were considered. All keep the single walkable field.

1. **The cave generator with sewer settings.** Least new code, but the
   walls come out as smooth wobbly blobs. It would look like a cave in
   brick colours, which is the anti-goal.
2. **A new generator on a square grid.** Rectangular rooms, straight
   tunnels, right-angle turns, built shapes like the hall. It looks most
   like a sewer, but it is the most new code, it redoes what the cave
   already does (connections, depth, rest points, posts), and right angles
   feel like a maze, not "twisting and winding."
3. **The cave's room plan with sewer shapes on it.** The owner chose this one.
   `genWorld`'s graph logic still decides rooms, connections, the way to the
   boss, loops, dead ends, rest points and posts. What changes is the
   shape stamped into the field and the mesh built on it.

## The design

### D opens after E

- A saved record of cleared grades, next to `UNLOCKED`, in `dungeon-raze.v2`.
  The first time a grade's boss is killed (where `kill` sets `G.bossDead`
  today), that grade is added and saved. Killing D's boss records D, which C
  will use later.
- *Builder's call, made in the design:* the record is kept per class (class
  id to the grades that class has cleared). That leaves room for the
  backlog's plaque quests, which may open portals to one class. Today the
  rule reads it globally: a grade counts as cleared if any class cleared it.
- `hubPortals()` derives `open` instead of hard-coding it: E is always open.
  A higher grade is open when the grade below it is cleared **and** the
  grade is live.
- **Live.** A list in code of the grades whose content is finished. Today
  that is E only. D joins it when project 2 lands. This is what keeps the
  sewer off the published page. Tests make D live and cleared through `DF`,
  as `DF.setPlaqueCode` does for codes.
- The hall is built once on entry, so a newly opened D shows the next time
  the player is in the hall. That happens on its own, because winning returns
  them there.
- A short message when D opens, at the moment of the kill, saying a new gate
  has opened in the base.
- `enterCave(gradeId, seed)` picks the generator by grade: E gets
  `genWorld`, D gets the sewer. `ENV_SEWER` sits next to `ENV_CAVE` and
  `ENV_HUB`.

### Layout

- **Graph.** The same method as `genWorld`: a jittered grid of nodes, a
  spanning tree, extra edges for loops, a BFS for depth and the path. Sized
  so that the walked length from start to boss is about 1.5 times E's,
  measured across seeds (see Tests). There are more nodes than E's 16, and
  the spacing is wider for longer tunnels. Some nodes are dead-end spurs:
  rooms or short tunnel stubs with one connection, off the main path.
- **Tunnels** are even-width channels, about the width of E's tunnels,
  made of straight runs joined by angled bends: a polyline, not a sine
  wobble. They twist more than E's. Their field is the distance to the
  polyline, with no noise added.
- **Rooms** are rounded rectangles in the field, with no noise. Medium rooms
  are noticeably larger than E's chambers, so pools have room beside the
  walkways.
- **Crumble.** In a few places a wall section has collapsed: a small bulge
  of rough field and a heap of brick. This is the only irregularity in the
  field.
- **Rest points.** Four: the arrival hall and three more spaced along the
  path, about a quarter of the way apart, the last just before the boss
  cavern. They use the shrine mechanics as they are. Their look is the
  builder's call, but in sewer style.
- *Builder's call, made in the design:* rest rooms hold no enemies, as in
  E (a room with a shrine gets kind `"shrine"` and no spawns). The node
  count is sized so that, after the start, the rest rooms and the boss,
  there are still clearly more fighting rooms than E has.

### Room kinds

Each room gets a kind when the graph is built:

- **Arrival hall** (the start). Medium sized. A ladder comes down from a
  manhole in the ceiling where the player arrives, and a rest point. No
  enemies. The tunnels leave from its far end.
- **Pool room.** Water pools separated by walkway floor. In project 2 it
  holds sirens or eels, never both. It never holds a brood mother.
- **Brood room.** Mostly dry floor, perhaps a gutter. In project 2 it holds
  a brood mother. Never sirens.
- **Boss cavern** (below).

The mix of pool rooms and brood rooms per run is the builder's call. Both
should appear in every run. Each spawn records its room kind, so project 2
can fill rooms by kind without touching the generator.

Until project 2, spawns use E's enemy types as stand-ins. That only happens
in tests and in a D made live by hand, never on the published page.

### Water

- **One layer, one reader.** The generator writes a water amount per grid
  point (0 dry, 1 water) next to the field. `world.waterAt(x, z)` reads it
  bilinearly, as `fieldAt` does. `genWorld` and `genHub` return a `waterAt`
  that is always 0.
- **Where it is:** pools in pool rooms, a gutter down one side of some
  tunnels, and the boss cavern's water. Dry walkways always connect every
  entrance of a room, so no route through the map is forced through water.
  The player chooses to wade.
- **Shaped for the enemies to come** (*builder's call, made in the design;
  project 2 may adjust the numbers*):
  - A pool room holds two to four separate bodies of water, so an eel's
    shock covers one body and the player can step to dry ground or another
    pool to avoid it. Tunnel gutters never join a room's pools.
  - Walkways are at least 3 m wide. Each pool room has at least one
    crossing, a walkway 2 to 3 m wide running between two pools, which is
    where a siren guards. No pool is narrower than 4 m, so a siren has room
    to swim.
  - The world returns its water bodies (an id per connected region on the
    grid, with each body's points and room) and the positions and facing of
    the grates and pipe mouths in tunnel walls, for the drain grabber, as it
    returns the cavern's wall tunnels.
- **The player in water.** Walking, running and dodging are slowed by one
  factor, `WATER.slow` (start at about 0.6 and tune). A dodge in water
  covers less ground but keeps its timing and invulnerability window: the
  dodge distance is scaled, and `p.ddur` is not. The factor applies to the
  move from the dodge's start point, so a dodge from dry ground into water
  slows as it enters. Attack lunges are scaled the same way.
- **Enemies in water.** Each `EDEF` entry gets a `wade` factor that
  multiplies its speed in water: below 1 is slowed, above 1 is faster. E's
  types get about the player's factor. Project 2 gives the rat, siren and
  eel factors above 1. It goes through the same steps that move an enemy now
  (`eStep`, `walkRoute`, charges and lunges), not through a check in each
  state.
- **Drawn.** The water surface is drawn a little below the floor, about
  0.3 m, with a brick lip at the edge of each pool. It is animated: slow flow
  ripples, plus brighter streaks where it runs. Anything standing in water
  is drawn sunk by the same amount, scaled by `waterAt`, so it reads as
  wading to the shins. That depth is drawing only: collision, hits, shots and
  the camera stay on the flat floor.
- **Felt.** Ripples and splashes at the feet while wading, and a wading
  footstep sound, so the player always knows they are in it.
- The minimap shows water.

### Look and sound

- **Walls.** The marching-squares walls stay, so collision still matches the
  picture, but they are drawn as brick: courses that follow the wall, mortar
  lines, some bricks missing or darker, moss and damp stains near the floor
  and the water. The vertical faces stand straight, with no per-vertex
  jitter.
- *Builder's call, made in the design:* the brick pattern (courses, mortar,
  per-brick shade) is drawn by the world shader from world position, turned
  on per vertex (for example through a spare value in the vertex data), so
  the cave and hall look exactly as before. A shader pattern is code, not an
  image, so the no-assets rule allows it. Stains, moss, missing bricks and
  crumbled heaps are vertex colour and geometry as usual. This keeps wall
  triangles near the cave's count.
- **Tunnels.** An arched vault overhead, which `ceilAt` follows, so the
  camera collides with the arch. Brick ribs every few metres, pipes along the
  walls, grates and drains low in the walls. Decoration does not block
  anything.
- **Rooms.** Higher vaulted ceilings, pillars as part of the field where a
  room is big enough, walkway edges in dressed stone.
- **Light.** The crystals do not appear. Lamps give a dim green light, and
  some flicker now and then: a lamp's brightness drops and stutters for a
  moment, at random. The flicker is per lamp, not the whole scene.
  `ENV_SEWER` sets a damp greenish fog and ambient.
- **Drips** from the ceiling as small falling sprites with tiny splash rings,
  denser over water, and drip sounds.
- **Echo.** Sounds in the sewer go through a short echo in `04_audio.js`.
  The hall and cave keep their sound.

### The boss cavern

Built in this project as a shape; the fight comes in project 3.

- The biggest room, and the most detailed. Its entrance is on the near side.
- **Outer moat** of water around the room's edge, **a centre pool**, and a
  ring of dry ground between them. There are dry crossings from the entrance
  onto the ring.
- **Wall tunnels.** Several sewer tunnel mouths (three to five) open halfway
  up the far wall. Each pours a stream of water down into a pool at the foot
  of the wall, and that pool feeds the moat. The mouths are decoration at
  height; nothing walks into them in this project. Their positions are
  returned on the world so project 3 can use them.
- **Ceiling cracks** with light shafts coming through: shafts drawn as
  additive beams, plus pools of light on the ground.
- Room for rubble: the ring is wide enough that `addRock` heaps from the
  falling ceiling in project 3 still leave space to fight.
- With project 1 alone, the cavern holds the E boss as a stand-in (tests
  only), so the run can be finished, the gate opens and D is recorded.

### Drawing only what can be seen

The owner asked for only what the player can see to be drawn, so that
nothing round a bend costs anything. Three layers:

1. **Pieces.** At build time the sewer's world mesh is split into pieces
   along the room plan: each room is a piece, and each tunnel is cut into
   stretches of a few bends. Each triangle belongs to the piece its centre
   lies in. Each piece keeps its bounding box.
2. **What each piece can see.** Also at build time, each piece gets a list
   of the pieces visible from anywhere in it, worked out with the field's
   own sight test (`world.los`) between sample points in both. The list errs
   generous: a piece is on it if any sample pair sees, and its neighbours
   are always on it, so nothing pops in at a corner. The camera sits behind
   and above the player and can be in a different piece; the piece the
   camera is in is the one that counts, with the player's piece added.
3. **Each frame,** draw the pieces on that list that are within the fog
   distance and whose box is at least partly inside the view.

The cave and the hall stay as one mesh drawn whole, as now.
- The renderer's lights list keeps working as now. The nearest lamps are
  picked in `buildLights()`.
- **Budget** (*builder's call, made in the design*): only headless
  Chromium is available for checking, so the measure is triangles drawn,
  not frame rate. From any spot in the sewer, the world triangles drawn in
  a frame must be no more than the whole E cave draws today, measured over
  several seeds.

## Tests

A new script, `tests/t22.mjs`, using `smoke` with D made live and cleared
through `DF`:

- Over many seeds, the sewer is connected, every room kind appears, no room
  is both a pool room and a brood room, and the start-to-boss walked length
  averages about 1.5 times E's on the same seeds.
- Dry walkways connect the entrances of every room (a route with water
  forbidden exists).
- `waterAt` is 0 in the hall and the cave.
- The player walks and dodges a shorter distance in water by the expected
  factor, and the dodge lasts the same time.
- An enemy with `wade` above and below 1 covers more and less ground in
  water.
- The D portal is sealed when D is not live, sealed when E is not cleared,
  and opens when both hold. Killing E's boss saves E as cleared, and the save
  survives a reload.
- Screenshots: the arrival hall, a tunnel, a pool room, a brood room, the
  boss cavern, and wading. Checked by eye for the anti-goal.
- The triangle budget holds from sample spots across several seeds.
- Walking round bends and through room entrances, screenshots show no
  missing walls, floor or ceiling, and the pieces drawn always include
  everything a full draw shows in the same view (compare a full draw with
  the culled draw from the same camera).

Also run `t5`, `t8`, `t12`, `t20` and `t21`, because the field, zones, routes,
rock and rifts all touch this.

## Left to the builder

- Every number not given above: node count and spacing, tunnel and room
  sizes, `WATER.slow`, wade factors for E's types, drawn water depth, the
  flicker timing, tunnel stretch length and the sight sampling density.
- Whether the sewer is a new function beside `genWorld` or `genWorld` with
  settings, as long as the graph logic is shared, not copied.
- The rest point's look, the ladder, brick colours and patterns, how
  crumbled sections are spread.
- How the echo is built.

## Later projects (decided in outline)

Recorded here so projects 2 and 3 start from what the owner agreed.

### Project 2: the D enemies

Water speed depends on the enemy. E's enemies do not appear in D; the rat
is the common filler.

- **Rat** (common, weak). Rears up on its hind legs to attack on land; swims
  flat and fast in water. It cannot attack while swimming. It must climb out
  and rear first, and that is the opening. Comes in packs.
- **Siren** (strong). Fast in water and cannot go on land. She reaches the
  bank with a lunge from the water's edge that grabs the player and drags
  them in, and a song that pulls the player toward the water, broken by a
  dodge. She guards crossings, in pool rooms.
- **Drowned** (medium). Carries a manhole cover as a shield and blocks
  anything from the front. Flank it, or break the guard with heavies.
  In tunnels and brood rooms.
- **Bloater** (weak). Drifts in any water and bursts into poison when
  killed. The splash hurts enemies too.
- **Eel** (medium). Stays in water, and now and then glows and then shocks
  the whole body of water it is in. In pool rooms without a siren.
- **Drain grabber** (ambush). Arms from pipes and grates in tunnel walls
  that grab a player passing. Tunnels only.
- **Brood mother** (medium, high priority). A bloated rat that keeps sending
  out rats from behind the pack until killed. In brood rooms.

### Project 3: the crocodile

- It circles the cavern under the water, in the moat and the centre pool,
  and surfaces at a new spot each time, then rears up on its hind legs and
  attacks. A wake and bubbles show where it is heading, and it surfaces with
  a short warning. While it is under, it cannot be locked onto. On land it is
  open to punishment, and staggering it there keeps it out longer.
- **Tunnel phase.** Now and then it leaps into one of the wall tunnels and
  whips its tail to fling a spiked plate at the player, a real shot. It
  throws 1 to 4 times per tunnel and visits 1 to 4 tunnels, each count
  random. It then drops back into the arena. Before half health the
  throws per tunnel are 1 or 2.
- A surge of water or glowing eyes in a tunnel's mouth warns which tunnel
  it is coming out of.
- A parried plate flies back up the tunnel, knocks the crocodile out, and it
  lands stunned on the ring.
- Below half health the ceiling cracks give way: chunks fall with a dust
  warning and become rubble (`addRock`) that blocks its lunges and gives
  cover.
- Its shadow shows through the water when it swims under a light shaft.
- Bloaters wash down the falls. Popping one beside the surfaced crocodile
  hurts it.
