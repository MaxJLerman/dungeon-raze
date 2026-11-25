# Zones, game state and menus

## Zones (`06_game.js`, `03b_hub.js`)

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
  inside the boss chamber, and `G.chunks`, the crocodile's falling ceiling
  (`respawn` clears it too).
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
  gate has opened in the base." when that opens the next portal.
- **Which gates are open.** `LIVE_GRADES` (in `03b_hub.js`) is the set of
  grades whose content is finished. `portalOpen(grade)`: E is always open;
  a higher grade is open when it is in `LIVE_GRADES` and the grade below is
  cleared. `hubPortals()` takes `open` from it. It holds E and D, so D opens
  once E's boss is dead and C to S stay sealed. A test that takes D out
  through `DF.LIVE_GRADES` puts it back before it ends.

- A button style that outranks `.scr button:hover` and sets a background sets
  the text colour too, or the hover's dark text shows on it.
- `G` is the single state object. `G.state` is one of `title`, `play`,
  `pause`, `dead`, `win`, `class`, `controls`, `howto`, `coop`, and `show(state)`
  switches screens. `MENUS` in `09_main.js` lists the screens that open on top
  of the title or pause screen and return to it; add a new one there and to
  `SCREENS`.
- **The main menu** is the `title` state (`#scr-title`): `#btnSolo` "Play
  solo", `#btnCoop` "Play online", How to play and Controls, and no class
  picker. Both Play buttons open the class screen with
  `openMenu("class", why)`, `why` being `"solo"` or `"online"`; the pause
  screen's Change class calls `openMenu("class")` with none. `classFor`
  holds it (`null` from pause) and `classRender()` sets the screen from it:
  from a Play button the forward button `#btnPlay` shows ("Enter the hall"
  or "Continue", with `data-padfirst`) and the mid-run line `#classSub` is
  hidden; from pause it is the other way round. `classGo()` is the button's
  click: `play()` for solo (after clearing a co-op line left on the main
  menu), `openMenu("coop")` for online. Back from the class screen goes to
  where it was opened from: the main menu when a Play button opened it, the
  pause screen otherwise. Back from the room screen goes to the main menu,
  not the class screen, because `menuBack` keeps one level. With nothing
  focused, Enter or Space on the main menu does what Play solo does, and on
  the class screen a Play button opened it does what the forward button
  does. `#btnCoop`'s click is `playOnline()`: a page `coopCheck()` refuses
  (a file, another site's copy, no relay) is told why on the main menu and
  goes no further. Open the class screen through `openMenu`, never
  `show("class")`, or `classFor` is stale.
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
  `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`. The cave scripts use `smoke`,
  which enters a cave after playing solo. Both modes press Play solo on the
  main menu and then Enter the hall on the class screen; `title` stays on
  the main menu.
- Run `tests/t30.mjs` after any change to the main menu, the class screen's
  forward button or cards, or Exit to main menu, on the desktop page and on the
  smallest phone:
  `SCRIPT=$PWD/tests/t30.mjs node test.mjs title` and
  `DEVICE=iphone-se SCRIPT=$PWD/tests/t30.mjs node test.mjs title`. It
  checks the four buttons and the missing picker, the solo and online
  paths, the class screen from pause (no forward button), Back, Esc and
  the touch Back gesture (a real one included), Enter on the menu, where the co-op line sits,
  that everything fits, the exits from the hall, a cave, the death and win
  screens, that a class picked after an exit is the one played, and an
  exit in the middle of a portal fade, that a co-op line does not outlive a
  solo start, and that Play online on a page that cannot play co-op says so
  on the main menu (the test page is a `file:`, so every step stands in
  `localhost` through `DF.coopLoc`), and that a class card, selected or
  not, stays readable under a real mouse (`__mouse(x, y)`, desktop only).
  Look at `shots/t30-menu.png`,
  `shots/t30-class.png` and the two `shots/iphone-se-t30-*.png`.
  `node tests/t30-nogl.mjs` opens the page in a browser with no WebGL 2 and
  checks the message and that both Play buttons are disabled.

## Known problems

- "Return to base" and "Exit to main menu" abandon the cave without asking,
  because nothing is lost yet. Both will need a confirmation once runs carry
  rewards. In co-op both leave the room, and a host's exit ends it for the
  friend, also without asking.
- Back on the room screen goes to the main menu, not to the class screen it
  was reached from: menus keep one level of where they came from.
