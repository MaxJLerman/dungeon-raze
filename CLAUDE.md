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

## Rules of the build

- `node build.mjs` after every source change. The page that runs is
  `dist/index.html`, and it is committed so the repo is playable as cloned.
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
- The ceiling height at a point is `world.ceilAt(x, z)`.
- Spawn packs are chosen by a chamber's distance from the start, in `PACKS`.

### Game state and time (`06_game.js`, `09_main.js`)

- `G` is the single state object. `G.state` is one of `title`, `play`,
  `pause`, `dead`, `win`, `class`, `controls`, and `show(state)` switches
  screens.
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

### Player

- State machine in `playerUpdate`: `free`, `guard`, `attack`, `dodge`, `hit`,
  `gbreak`, `heal`, `execute`, `blink`, `dead`.
- Presses are buffered for 0.3 seconds in `p.buf` so chained inputs feel
  responsive.
- Melee attacks aim with `aimYaw`, which snaps to the lock target or a nearby
  enemy. Ranged attacks aim with `aimRanged`, which follows the camera with a
  little assist.
- All damage to enemies goes through `hitEnemy`. All damage to the player goes
  through `hurtPlayer`, which handles invulnerability, perfect dodge, parry,
  block, guard break and class armour.

### Enemies

- State machine in `enemyUpdate`: `idle`, `alert`, `chase`, `wind`, `act`,
  `rec`, `hit`, `recoil`, `stagger`, `roar`, `return`, `dead`.
- At most two non-boss enemies may attack at once. They claim a token with
  `takeToken`; the rest circle.
- `poise` 0 flinches on any hit, 1 only on heavy hits, 2 never.
- Posture fills from hits and parries and breaks into `stagger`, which opens
  the enemy to an execution.
- Enemies steer straight at the player and slide along walls. There is no
  pathfinding.

## Recipes

### Add or tune a move

Edit `MOVES` in `06_game.js`. Fields: `wind`, `act`, `rec` (seconds), `dmg`,
`post` (posture damage), `range`, `arc` (radians, `TAU` for all round), `lunge`
(distance moved), `stam`, `next` (the chained move), `anim`, `tilt` and `dir`
(slash arc shape), `heavy`, `lance` (straight thrust effect). A ranged move has
`proj` instead of the melee fields. If you use a new `anim` name, add its pose
to the `attack` case of `posePlayer` in `07_render.js`.

### Add a class

1. Add an entry to `CLASSES` in `06_game.js`, copying an existing one. `chain`,
   `heavy` and `dash` name moves; `tool.id` and `special.id` name behaviours.
2. Add its moves to `MOVES`.
3. If the tool or ability is new, add a branch to `useTool` or `useSpecial`.
4. Add a branch to `makePlayerFig` in `05_figures.js` and set `f.rim` and
   `f.tips`.
5. Add an idle arm pose and guard pose for it in `posePlayer`.
6. Add a case for it to `tests/t6.mjs` and run that script.

The class picker and HUD read `CLASSES` and need no changes.

### Add an enemy

1. Add an entry to `EDEF` with its attacks. An attack with `trig` can start a
   sequence; one without can only be reached through another's `chain`.
   `unb: true` makes it unblockable and shows the red warning.
2. Add a figure in `makeEnemyFig`, with `f.rim` and `f.eye`.
3. Reference the type name in `PACKS` in `03_world.js`.
4. An attack with special movement needs a `kind` and handling in the `wind`
   and `act` cases of `enemyUpdate`. See `slam`, `charge`, `shot`, `volley`.

## Testing

- `window.DF` exposes the internals to tests. Set `DF.G.manual = true` to stop
  the frame loop from advancing the simulation, then call
  `DF.sim(seconds, eachStep)` to run it at a fixed 60 steps per second.
  Returning `false` from `eachStep` stops early.
- Simulate input by setting `DF.keys[DF.BIND.fwd] = true` or
  `DF.taps[DF.BIND.light] = true`.
- Headless Chromium needs these flags for WebGL:
  `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
  Rendering is slow there, a few seconds per screenshot, which is why tests
  drive the simulation directly instead of waiting in real time.
- Run `tests/t5.mjs` after any change to cave generation and `tests/t6.mjs`
  after any change to classes or combat rules.
- Screenshots are the only check on how things look. Take them; do not assume.

## Known problems

- Balance is untested by hand. In bot runs the Fighter looks strongest and a
  pack kills a passive player in about seven seconds.
- The camera can pass through characters at close range.
- Enemies can snag on tight bends because they have no pathfinding.
- There is no gamepad support.
- The Assassin's blink picks its own target when nothing is locked, which may
  not be the enemy the player meant.
- In the controls menu, Escape cannot be bound, and the pause key in the
  no-pointer-lock fallback is fixed to P.

## Backlog, roughly in the order discussed

1. Tune feel from the owner's playtest: timing windows, sensitivity, difficulty.
2. Loot, inventory and an extraction loop. The owner asked for these early on
   and they were set aside to get combat playable first.
3. More enemy variety and a second boss.
4. Gamepad support.
5. A harsher surface area or city zone, if the owner wants to leave the caves.
6. Split the work into lanes for parallel agents: combat and camera, enemies,
   world generation, loot and progression, rendering and effects, HUD, tests.
   Agree shared data shapes (`CLASSES`, `MOVES`, `EDEF`) before fanning out.

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

Commits are authored and committed as `MaxJLerman
<93211492+MaxJLerman@users.noreply.github.com>` (set in the repo's local git
config). Do not add `Co-Authored-By: Claude` or `Claude-Session` trailers.
