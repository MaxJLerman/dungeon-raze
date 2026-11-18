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
- Plaques. `hubPlaques()` lists `{ id, cls, x, z, yaw }` for the three plaques
  on the left wall (x = 14.85), and `genHub` returns them as `plaques` (the
  cave returns `[]`). `cls` is the class a plaque unlocks, `null` while sealed.
  `plaqueFront(q, d)` is a point `d` in front of one, `PLAQUE_Y` its height,
  and `plaqueAt()` the plaque the player is near and facing, or `null`. The
  glow is drawn as sprites each frame, because the hall mesh is built once
  and the glow brightens on unlock.

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
  `gbreak`, `heal`, `execute`, `blink`, `grapple`, `inspect`, `dead`.
- `inspect` is a plaque close-up. `openPlaque(q)` sets it and `G.insp`
  (`{ q, k, dir, syms, stick }`, `k` running 0 to 1 over `INSPECT_T`), and
  `closePlaque(now)` ends it. `inspectUpdate` runs instead of the rest of
  `playerUpdate`. `camUpdate` blends to the plaque and ignores the mouse,
  and the pad does not turn the camera. `show()` closes it when the state
  leaves play, and `resetRun` and death clear it.
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
  (`vsnap`) and a step through a short rift (`vstep`, a look only).
  - **Rift ends** (tool) are entries in `G.rifts`, at most two, oldest
    first: `{ x, z, yaw, t, life, id }`, `yaw` facing the player when it
    opened. `openRift(x, z, yaw)` returns the end, or `"close"` or `"room"`
    when refused (a refused tool press spends nothing). A third end shifts
    out the oldest; `riftsUpdate` closes ends after `RIFT.life`.
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
    `landEnemy`, which hurts it by the height fallen, forces a stagger by
    the Sapper's rule, and hurts other enemies round it. Landings never hurt
    the player. **A falling enemy is skipped by** `hitEnemy`, `pickLock`,
    `aimYaw`, `aimRanged`, `explode`, the melee hit loop, the shot hit loop,
    the Starfall target, mines and tripwires, `separate` and `riftBodies`.
    A new way of hitting or targeting an enemy must skip it too.
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
  and posture bar. The locked target takes a slot first. A boss on the big bar
  gets no slot, even when locked, because that bar shows its name. A boss
  that has not noticed the player gets the tag alone (`nobar`).
- A slot shows when the enemy is aware, hurt, or looked at, within 26 metres.
  "Looked at" is `looked` in `08_hud.js`: the enemy's body is inside a box
  around the screen centre and `world.los` from the player is clear. The box
  is tall because the resting camera looks down, so an enemy straight ahead
  sits above the centre. The HUD only reads enemies; looking never wakes one.
- `EDEF.dummy` is the training dummy. Its `dummy: true` flag is honoured in
  seven places: `makeEnemy` (always aware, so no ambush bonus and its bar
  shows), `enemyUpdate` (pinned in place, no AI), `hitEnemy` (health restored
  after every hit), `kill` (refuses), the `execute` case of `playerUpdate`
  (stands back up, and is not kicked by the Sapper or dropped by the
  Riftwalker), `caveImpact` and `separate` (not pushed out of the rubble),
  and `riftBodies` and `holesUpdate` (never crosses a rift, never falls).
  Any new way of killing or moving an enemy must respect it.

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
   grade, then open D to S. Revisit whether dying should send the player back
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
   tab). On a pad, near a plaque the same button inspects instead. What the jump is for in a fight (movement,
   clearing slam shockwaves, jump attacks, invulnerability) is undecided; ask
   the owner before building it. The floor is flat, so there is nothing to
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
