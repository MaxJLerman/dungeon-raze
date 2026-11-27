# Zones, game state and menus

## Zones (`06_game.js`, `03b_hub.js`)

- `G.zone` is `"hub"` for the hall or `"cave"`, and stays `"cave"` for every
  grade's run, the sewer included. `G.grade` says which. `G.world` holds
  whichever world is active, and nothing else is kept loaded.
- `enterHub(fromGrade, coop = false)` builds the hall and puts the player at
  the start, or in front of that grade's portal looking toward the middle of
  the hall. With `coop` true it builds the co-op hall (`genHub(true)`) and
  does not end co-op: that is a co-op world swap (`coop.md`). `enterCave(gradeId, seed, big = false)` calls
  `newRun(seed, gradeId, big)`; `seed` defaults to a random one.
  `newRun(seed, grade = "E", big = false)` records `G.grade`, sets
  the air from `ENV_GRADE[grade]` (the cave's when the grade has none), builds
  the world with `WORLD_GEN[grade]` (`genWorld` when the grade has none), and
  hands it `big` only when `grade` is `"E"`, so `big` builds the big cave
  (`world.md`) and any other grade ignores it; it turns
  the audio echo on for a world with `sewer: true` and starts the run. It is
  what the cave and sewer tests call.
- `genHub()` returns every field `genWorld` returns, with empty arrays where a
  field has no meaning, plus `hub: true`, `portals` and `dummySpot`. Keep it
  that way: code that reads `G.world` has no checks for the hall.
  `genHub(true)` is the co-op hall, built from `hubPortals(true)`; a test may
  pass a list of portals in place of the flag.
- The hall and the cave share `fieldFns` and `meshSink` in `03_world.js`, so
  both collide and pack triangles the same way.
- The hall is centred on the origin with north at +Z. The player starts facing
  +Z, so E, at +X, is on their left.
- A portal is `{ x, z, yaw, grade, open }`, listed in `hubPortals()`. The
  position is a point on the floor in front of the frame and `yaw` faces into
  the hall. The frame, its collision block, floor ring, glow, light, label and
  return point are all built from the entry. Its opening sits `PORTAL_IN`
  behind the position, and stepping within `PORTAL_R` of the opening of an
  open one asks before the trip (**A gate asks first**, below). The trip is
  `startTrans` (in a co-op run `NET.onPortal`, `coop.md`), which fades out, swaps the world at full black and fades
  in. The transition is advanced by `update`, which does nothing else while
  `G.trans` is set, so `DF.sim` drives it in tests. `G.trans` is `{ t,
  swapped, grade }`, or `{ t, swapped, swap }` for a transition that makes
  its own world (a co-op world swap, `coopTravel`): at full black
  `transUpdate` calls `swap()` in place of `enterCave(grade)`, and a `swap`
  that returns false has left the world for good (co-op ended), so the fade
  stops there with `G.trans` null and `G.fade` 0. `RM` (reduced motion) is
  a `let`; `DF.setRM(on)` sets it for a test.
- **A gate asks first.** The portal check at the end of `update` calls
  `gateAsk(q)` for the open gate the player stands in: `G.ask` is `{ grade,
  yaw }` and `G.state` is `"enter"`, whose screen the frame loop shows (core
  has no DOM, as with the win screen). The check does nothing while `G.ask`
  is set. `gateAnswer(yes)` is the answer, and does nothing with none
  asked: it clears `G.ask`, puts an `"enter"` state back to `"play"`, and
  then yes is the trip (`startTrans(grade)`, or `NET.onPortal(grade)` in a
  co-op run) and no throws the player out of the arch, `startDodge(sin yaw,
  cos yaw, 1, true)`: a free dodge of the class's full distance the way the
  gate faces, whichever way they walked in, with their facing, their lock
  and `cam` left alone. The shortest dodge (3.8 m) is longer than the
  circle is deep, so it lands outside. No also sets `G.askOff`, which keeps
  every gate from asking until the player is outside all of them, where
  the check clears it. A co-op page that may not ask (`NET.asks()` false:
  a friend's, or the host's page with a trip asked for) goes to
  `NET.onPortal` as before, asked or not. The exit gate over a dead boss
  (`G.gate`) asks nothing. A test that walks into a gate answers with
  `DF.gateAnswer(true)`.
- `resetRun()` clears everything that must not cross a world swap. It
  clears `G.ask` and `G.askOff`, and an `"enter"` state goes back to
  `"play"`, so a world that goes under a gate's question takes the question
  with it. Add new
  per-run state there. It clears `G.inBoss`, the flag for the player being
  inside the boss chamber, `G.chunks`, the crocodile's falling ceiling
  (`respawn` clears it too), `G.waves`, the Warden for two's aftershocks
  (`respawn` empties it too), `G.seal`, the Warden for two's seal
  (`coop.md`), `G.dark`, the dark of its last phase (back to `{ v: 0, to:
  0 }`, the lights full), and `G.edef`, the scaled enemy definitions of
  a co-op dungeon for two (`coop.md`), so every world starts with `EDEF`'s
  own; a co-op build sets it again after.
- `respawn()` puts the player at the checkpoint, clears the rock,
  `G.waves` and `G.chunks` (the same cave again), and with `G.seal` standing then lays
  the seal's ring again (`sealNow()`) and puts the player at its door spot
  (`sealDoor`) in place of the checkpoint: the seal outlives one player's
  death and not a wipe (`coop.md`).
- `R.env` (ambient and fog) is set per zone from `ENV_HUB`, `ENV_CAVE` and, for
  the sewer, `ENV_SEWER` (damp green-dark, thicker fog), through `ENV_GRADE`.
  `setEnv` copies the preset.
- In the hall, focus and tool charges refill on their own, the minimap is
  hidden and the run timer does not advance.
- Plaques. `hubPlaques()` lists `{ id, cls, x, z, yaw }` for the three plaques
  on the left wall (x = 14.85), and `genHub` returns them as `plaques` (the
  cave returns `[]`). `cls` is the class a plaque unlocks, `null` while sealed.
  `plaqueFront(q, d)` is a point `d` in front of one, `PLAQUE_Y` its height,
  and `plaqueAt()` the plaque the player is near and facing, or `null`. The
  glow is drawn as sprites each frame, because the hall mesh is built once
  and the glow brightens on unlock.

## Game state and time (`06_game.js`, `09_main.js`)

- **Cleared grades.** `CLEARED` maps a class id to the grades its boss kill has
  cleared, saved as `c` in `dungeon-raze.v2`. `clearGrade(grade, cls)` records
  one (true when new), `gradeCleared(grade)` is true if any class cleared it,
  and `resetCleared()` empties it. A saved `c` that is not an object loads as
  nothing cleared. `kill` records the grade when a boss dies, and says "A new
  gate has opened in the base." when that opens the next portal (not in a
  co-op run, whose hall keeps D sealed).
- **Which gates are open.** `LIVE_GRADES` (in `03b_hub.js`) is the set of
  grades whose content is finished. `portalOpen(grade)`: E is always open;
  a higher grade is open when it is in `LIVE_GRADES` and the grade below is
  cleared. `hubPortals()` takes `open` from it. `hubPortals(true)`, the
  co-op hall's, ignores the save: E open, every other gate sealed, so a
  co-op host with no save and both pages build the same mesh. It holds E and D, so D opens
  once E's boss is dead and C to S stay sealed. A test that takes D out
  through `DF.LIVE_GRADES` puts it back before it ends.

- A button style that outranks `.scr button:hover` and sets a background sets
  the text colour too, or the hover's dark text shows on it.
- `G` is the single state object. `G.state` is one of `title`, `play`,
  `pause`, `dead`, `win`, `enter`, `class`, `controls`, `howto`, `coop`, and `show(state)`
  switches screens. `MENUS` in `09_main.js` lists the screens that open on top
  of the title or pause screen and return to it; add a new one there and to
  `SCREENS`.
- **The gate's question** is the `enter` state (`#scr-enter`): the heading
  `#enterQ`, "Enter gate E?" with the gate's letter and no second line, and
  two buttons, `#btnEnter` "Enter" (with `data-padfirst`) and `#btnStay`
  "Stay out". Core opens it (`gateAsk` sets the state, above) and the frame
  loop shows it; the frame loop also puts the play screen back when the
  state is `"play"` again under it (an answer from `gateAnswer` alone, as a
  test gives, or a world that went). It is not one of `MENUS`. The HUD
  stays up under it, and solo the game stands still, as under pause.
  `enterAnswer(yes, lock)` is every answer from the screen: it does nothing
  off the screen or in its first `ENTER_GUARD` (350 ms, real time from
  `show("enter")`), so a click or press made before the screen appeared
  answers nothing; otherwise `gateAnswer(yes)` and then `play(lock)`.
  The buttons call it; on the keyboard Enter is Enter and Esc is Stay out,
  and **Space answers nothing**, because Space is the dodge and a player
  dodging into a gate would answer by accident. A controller's A presses
  the focused button and B is Stay out (`controller.md`), and the touch
  Back gesture is Stay out (`touch.md`). A browser will not lock the mouse
  from an Esc press, so Esc passes `lock` false: `play(false)` leaves the
  mouse free and the next click on the canvas locks it, where asking would
  be refused and set `G.noLock` for good. `show` of any screen but
  `"enter"` clears `G.ask`, so a question that something else covered
  (a pause) is asked again when play is back and the player still stands
  in the arch.
- **The main menu** is the `title` state (`#scr-title`): `#btnSolo` "Play
  solo", `#btnCoop` "Play online", How to play and Controls, and no class
  picker or blurb. It is centred, title over buttons, and its `.row` is a
  grid of two buttons to a row (`#scr-title .row` in the template); an odd
  last button, which is the dev build's `#btnDev`, sits alone in the middle
  beneath. Its `.sub` is empty and hidden, and only `boot()` shows it, to
  say the browser has no WebGL 2. Nothing else shows there but a co-op
  line: it carries no note about turning a phone, which the rotate screen
  says to a phone held upright (`touch.md`). Play solo opens the class screen with `openMenu("class",
  "solo")`; the pause screen's Change class calls `openMenu("class")` with
  no reason. `classFor` holds it (`"solo"`, or `null` from pause) and
  `classRender()` sets the screen from it: from Play solo the forward
  button `#btnPlay` shows ("Enter the hall", with `data-padfirst`) and the
  mid-run line `#classSub` is hidden; from pause it is the other way
  round. `classGo()` is the button's click: `play()`, after clearing a
  co-op line left on the main menu. Back from the class screen goes to
  where it was opened from: the main menu when Play solo opened it, the
  pause screen otherwise. With nothing focused, Enter or Space on the main
  menu does what Play solo does, and on the class screen Play solo opened
  it does what the forward button does. `#btnCoop`'s click is
  `playOnline()`: a page `coopCheck()` refuses (a file, another site's
  copy, no relay) is told why on the main menu and goes no further;
  otherwise it opens the room screen directly, `openMenu("coop")`. **An
  online start has no class screen:** the class is chosen on the room
  screen once a room is up (`coop.md`), and `openMenu("coop")` calls
  `renderPicker()` for the cards there. `renderPicker` fills every
  `.picker`; the room screen's (`#coopCls`), and every one during a co-op
  run, gets the base classes only. An
  address with `?room=CODE` opens the room screen at boot
  (`coopInvite`, `coop.md`). Open the class screen through `openMenu`,
  never `show("class")`, or `classFor` is stale.
- **The line of class cards.** `.cards` is a grid of five to a row. On a
  screen 420 px high or less (a phone on its side) the template makes it
  one line that scrolls sideways and reaches both edges of the screen,
  through `.scr`'s side padding, which `.scr` holds as `--side-l` and
  `--side-r`: five cards fit between the padding, so with the hidden
  classes open the sixth shows at the edge. `renderPicker` rebuilds the
  cards on every pick, so it keeps each line's `scrollLeft`, and
  `cardsReveal()` brings the chosen card into the line clear of the
  padding. `openMenu` calls it again after `show`, because a line on a
  hidden screen cannot be measured. A taller screen keeps the grid.
- **Return to base.** `toBase()` is `enterHub(G.grade)` then `play()`, from
  `#btnBase` (pause, hidden in the hall), `#btnDeadBase` (death) and
  `#btnAgain` (win). In a co-op run it asks the host to take the party to
  the hall (`coopBase()`) and then `play()`; a friend's page hides both
  buttons (`show`, `coopLeads()`, `coop.md`).
- **Exit to main menu.** `toTitle()` is `enterHub()` then `show("title")`:
  a fresh hall behind the menu. `#btnExit` (pause), `#btnDeadExit` (death)
  and `#btnWinExit` (win) call it. `enterHub` ends a co-op run for this
  page first, so a friend's exit leaves the host playing and a host's exit
  closes the room, and `resetRun` clears a portal fade in progress. It
  asks nothing and leaves fullscreen as it is.
- `update(dt)` advances the simulation. The frame loop scales `dt` for
  slow motion (`G.slowT`) and skips it for hit-stop (`G.hitstop`).
- Timings in the data tables are in seconds, so the game is frame-rate
  independent.

## Recipe: open another portal

1. Give the grade a generator in `WORLD_GEN` (`genWorld` for the cave,
   `genSewer` for D) and, if its air differs, an entry in `ENV_GRADE`. A grade
   with neither entry gets the cave. The new generator must return the same
   shape as `genWorld` and `genHub`, including `waterAt`, `bodyAt`, `bodies`,
   `grates`, `wallTunnels`, `shafts` and `pieces`.
2. Add the grade to `LIVE_GRADES` in `03b_hub.js`, only when its enemies and
   boss are finished (D went in once the crocodile was). `portalOpen` then
   opens its frame once the grade below is cleared (a boss kill saves that,
   see `CLEARED`). The frame, glow, trigger, label and return point all
   follow from the `hubPortals()` entry.
   Moving a gate is a change to that list.
3. Give `EDEF` entries for its enemies, with `wade` where water matters, and
   point its spawn packs at them. Until then a live grade runs on E's types
   (D has its own types throughout, the crocodile in the cavern).
4. Extend `tests/t8.mjs` and `tests/t22.mjs`: t8's "D opens once E is
   cleared" step expects E and D open with E cleared and the rest sealed,
   "frames are solid" walks into the sealed frames only, and t22 takes D out
   of `LIVE_GRADES` and back through `DF` to check a grade that is not live.

## Tests

- Run `tests/t8.mjs` after any change to zones, portals, the hall or the
  dummy, and `tests/t9.mjs` to look at the hall. Both use the `hub` mode:
  `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`. t8 holds the gate's
  question: that a gate asks once, Enter, the throw for every class and
  for a player who walked in sideways, no second question until the player
  has left, a world swap under it, and the screen itself (its text, the
  guard, Space, Enter, Esc with no mouse lock asked for, a controller's A
  and B, an exit under it); run it as the smallest phone too for the Back
  gesture (`DEVICE=iphone-se`, where its "hall HUD" step fails on `main`
  as well). Look at `shots/t8-enter.png` and `shots/iphone-se-t8-enter.png`.
  The cave scripts use `smoke`,
  which enters a cave after playing solo. Both modes press Play solo on the
  main menu and then Enter the hall on the class screen; `title` stays on
  the main menu.
- Run `tests/t30.mjs` after any change to the main menu, the class screen's
  forward button or cards, or Exit to main menu, on the desktop page and on the
  smallest phone:
  `SCRIPT=$PWD/tests/t30.mjs node test.mjs title` and
  `DEVICE=iphone-se SCRIPT=$PWD/tests/t30.mjs node test.mjs title`. It
  checks the four buttons, their grid and the centring, the missing
  picker and blurb, the solo path through
  the class screen and the online path straight to the room screen, the
  class screen from pause (no forward button), Back, Esc and
  the touch Back gesture (a real one included), Enter on the menu, where the co-op line sits,
  that everything fits, the exits from the hall, a cave, the death and win
  screens, that a class picked after an exit is the one played, and an
  exit in the middle of a portal fade, that a co-op line does not outlive a
  solo start, and that Play online on a page that cannot play co-op says so
  on the main menu (the test page is a `file:`, so every step stands in
  `localhost` through `DF.coopLoc`), and that a class card, selected or
  not, stays readable under a real mouse (`__mouse(x, y)`, desktop only),
  and, with every hidden class open, that the cards are one line from
  edge to edge on a phone, that a real touch drags it, and that a picked
  card stays in sight (the grid, with nothing cut off, on a taller
  screen). `node tests/touch-all.mjs tests/t30.mjs title` runs it on
  every device.
  Look at `shots/t30-menu.png`, `shots/t30-class.png`,
  `shots/t30-class-all.png` (every class) and the three
  `shots/iphone-se-t30-*.png`.
  `node tests/t30-nogl.mjs` opens the page in a browser with no WebGL 2 and
  checks the message and that both Play buttons are disabled.

## Known problems

- The gate's question frees the mouse where it was when play began, which
  after a pause is where Resume was, and that is where Enter is. A click
  later than the guard (350 ms) would enter. Not seen by a person yet.
- `tests/t8.mjs` as a phone fails "hall HUD" (`fadeOnTop`), on `main` too.
  The cause is not investigated; t8 was a desktop script until the gate's
  question.

- "Return to base" and "Exit to main menu" abandon the cave without asking,
  because nothing is lost yet. Both will need a confirmation once runs carry
  rewards. In co-op the host's Return to base takes both players to the
  hall, and Exit leaves the room (a host's exit ends it for the friend),
  also without asking.
