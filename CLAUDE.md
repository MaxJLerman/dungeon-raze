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

## Rules of the build

- `node build.mjs` after every source change. The page that runs is
  `dist/index.html`, and it is not committed.
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
- `world.route(ax, az, bx, bz, rad)` finds a walkable route for a body of
  that radius by searching the same grid. It returns the points to walk to in
  order, not including the start, or `null` when there is none. It lives in
  `fieldFns`, so the hall has it too. `world.path` is something else: the
  list of chamber ids from the start to the boss.
- The ceiling height at a point is `world.ceilAt(x, z)`.
- Spawn packs are chosen by a chamber's distance from the start, in `PACKS`.

### Zones (`06_game.js`, `03b_hub.js`)

- `G.zone` is `"hub"` for the hall or `"cave"`. `G.world` holds whichever
  world is active, and nothing else is kept loaded.
- `enterHub(fromGrade)` builds the hall and puts the player at the start, or
  in front of that grade's portal looking toward the middle of the hall. `enterCave(gradeId, seed)` records
  `G.grade` and calls `newRun(seed)`. `newRun` still means "start a cave from
  this seed" and is what the cave tests call.
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
- `R.env` (ambient and fog) is set per zone from `ENV_HUB` and `ENV_CAVE`.
- In the hall, focus and tool charges refill on their own, the minimap is
  hidden and the run timer does not advance.

### Game state and time (`06_game.js`, `09_main.js`)

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
- A touch button does not go through `BIND`. It sets `keys["T:" + action]`
  and `taps["T:" + action]`, and `held(a)` and `hit(a)` read that key beside
  the bound one. `hit` reads both taps so that both are consumed. The stick
  sets `T:sprint` when it is pushed past its ring. An action with a touch
  button needs an entry in `TOUCH_BTNS` and `LOOK` (see below).

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
- The sizes, honeycomb offsets and margins are in the comments and code of
  `layoutAt`. They derive from the short side of the screen.
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

- State machine in `enemyUpdate`: `idle`, `alert`, `chase`, `search`, `wind`,
  `act`, `rec`, `hit`, `recoil`, `stagger`, `roar`, `return`, `dead`.
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
  and posture bar. The locked target takes a slot first. A boss's slot is the
  tag alone (`nobar`), because the big bar shows the rest.
- A slot shows when the enemy is aware, hurt, or looked at, within 26 metres.
  "Looked at" is `looked` in `08_hud.js`: the enemy's body is inside a box
  around the screen centre and `world.los` from the player is clear. The box
  is tall because the resting camera looks down, so an enemy straight ahead
  sits above the centre. The HUD only reads enemies; looking never wakes one.
- `EDEF.dummy` is the training dummy. Its `dummy: true` flag is honoured in
  five places: `makeEnemy` (always aware, so no ambush bonus and its bar
  shows), `enemyUpdate` (pinned in place, no AI), `hitEnemy` (health restored
  after every hit), `kill` (refuses) and the `execute` case of `playerUpdate`
  (stands back up). Any new way of killing an enemy must respect it.

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

1. Add an entry to `EDEF` with its attacks and its `threat`, and a `leash`
   if it should hunt nearer or further than `PURSUIT.leash`. An attack with
   `trig` can start a sequence; one without can only be reached through
   another's `chain`.
   `unb: true` makes it unblockable and shows the red warning.
2. Add a figure in `makeEnemyFig`, with `f.rim` and `f.eye`.
3. Reference the type name in `PACKS` in `03_world.js`.
4. An attack with special movement needs a `kind` and handling in the `wind`
   and `act` cases of `enemyUpdate`. See `slam`, `charge`, `shot`, `volley`.

### Open another portal

1. Set `open: true` on its entry in `hubPortals()`. The frame, glow, trigger,
   label and return point all follow from the entry. Moving a gate is the
   same kind of change: give it a new position and `yaw`.
2. Give `enterCave` something to do with the grade, for example pass settings
   to `genWorld` and scale `EDEF` values. Today the grade only names the cave.
3. Extend `tests/t8.mjs`: the "sealed frames do nothing" step assumes only
   the first portal is open.

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
- There is no gamepad support.
- iPhones cannot run the file directly; they need the GitHub Pages address.
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
   grade, then open D to S. Revisit whether dying should send the player back
   to the base once there are rewards to lose.
3. Loot, inventory and an extraction loop. The owner asked for these early on
   and they were set aside to get combat playable first.
4. More enemy variety and a second boss.
5. Gamepad support.
6. A harsher surface area or city zone, if the owner wants to leave the caves.
7. Split the work into lanes for parallel agents: combat and camera, enemies,
   world generation, loot and progression, rendering and effects, HUD, touch
   layout, touch input, tests.
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

Do not add `Co-Authored-By: Claude` or `Claude-Session` trailers.
