# Dev menu (`src/dev/10_dev.js`)

- Local builds only (see Rules of the build in `CLAUDE.md`). `devHost(loc)` is true for
  `file:` and for `localhost`, `127.0.0.1` and `[::1]`; only then does the
  dev file set `DEV` (`{ god, unlocked, tick }`) and `DF.DEV`.
- `let DEV = null` sits beside `UNLOCKED` in `06_game.js`. Core code reads it
  only as `DEV && ...`, so a release build behaves as if it were never there.
- The dev file runs after `boot()`, so it builds `#scr-dev` in JS (the
  template carries nothing), binds its own clicks, and pushes `"dev"` onto
  `SCREENS` and `MENUS`. `#btnDev` sits on the main menu and
  `#btnDevPause` on the pause screen; Back, Esc and the pad's back button
  return as from any menu. The backquote key runs `devToggle()`: from play
  it pauses and opens the menu over pause, on the menu it goes back, and on
  any other screen it does nothing. A player who binds backquote to an
  action keeps the action and loses the shortcut. `devRender()` refreshes
  the menu's labels.
- **Unlock hidden classes** (`#devUnlock`, `devUnlockAll()`) puts every
  locked class in `DEV.unlocked`, which `classOpen` reads beside
  `UNLOCKED`. It is never saved; a dev class chosen and saved falls back to
  the first pickable class on the next load.
- **Enter a gate** (`[data-dev-gate]`, `devGate(grade)`) runs `enterCave`
  for any of `GRADE_IDS`, ignoring `portalOpen`; C to S get the cave. It
  clears nothing (`CLEARED` is untouched).
- **Jump to a boss** (`[data-dev-boss]`, `devBoss(grade, seed?)`, the list
  in `DEV_BOSSES`) starts a fresh run at its last rest point, lit and made
  the checkpoint, facing `world.boss`. Seeds 1 to 12 of E and D all have a
  rest point before the boss; a cave with only one would start at arrival.
- **Nothing is saved.** `devGate` and `devBoss` set `DEV.run` to the world
  they built (kept through `respawn`, which keeps the world), and
  `DEV.noSave()` is true for that world or while god mode is on; `kill`
  then skips `clearGrade`, so a dev kill opens no gate for good.
- **God mode** (`#devGod`, `devGod(on?)`) sets `DEV.god`, off on each load
  and kept through world swaps. `hurtPlayer` still runs the dodge (and
  perfect dodge), parry and block branches, so plates can be parried back;
  a block costs no stamina or chip, and any hit past them returns `"none"`.
  `grabPlayer` refuses, and `DEV.tick()` at the end of `update` keeps
  health, stamina, flasks (3), tool charges and focus (100) full. `#devBadge`
  ("GOD") shows at the top of the screen while it is on. A new way of
  hurting or holding the player must go through those two functions, as it
  already must.
  Run `tests/t26.mjs` after any change to it:
  `node build.mjs && SCRIPT=$PWD/tests/t26.mjs node test.mjs hub`.
