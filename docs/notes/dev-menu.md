# Dev menu (`src/dev/10_dev.js`)

- Local builds only (see Rules of the build in `CLAUDE.md`). `devHost(loc)` is true for
  `file:` and for `localhost`, `127.0.0.1` and `[::1]`; only then does the
  dev file set `DEV` (`{ god, unlocked, tick }`) and `DF.DEV`.
- `let DEV = null` sits beside `UNLOCKED` in `06_game.js`. Core code reads it
  only as `DEV && ...`, so a release build behaves as if it were never there.
- The dev file runs after `boot()`, so it builds `#scr-dev` in JS (the
  template carries nothing), binds its own clicks, and pushes `"dev"` onto
  `SCREENS` and `MENUS`. `#btnDev` ("Dev menu") is appended to
  the main menu's `.row`, whose grid puts a fifth button alone under the
  other four (`zones.md`), and `#btnDevPause` ("Dev") sits on the pause
  screen; Back, Esc and the pad's back button
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
- **Big cave (co-op size)** (`[data-dev-big]`, `devBigCave(seed?)`) is the last
  button of the Enter a gate row. It runs `enterCave("E", seed, true)`, the
  36-room cave a co-op pair gets, with no net, and sets `DEV.run` as
  `devGate` does. Without a seed the cave is random. It is for walking and
  looking at the big cave alone; a Return to base and gate E give the small
  cave again, since only a co-op swap or this button passes `big`.
- **Jump to a boss** (`[data-dev-boss]`, `devBoss(grade, seed?)`, the list
  in `DEV_BOSSES`) starts a fresh run at its last rest point, lit and made
  the checkpoint, facing `world.boss`. Seeds 1 to 12 of E and D all have a
  rest point before the boss; a cave with only one would start at arrival.
- **Nothing is saved.** `devGate` and `devBoss` set `DEV.run` to the world
  they built (kept through `respawn`, which keeps the world), and
  `DEV.noSave()` is true for that world or while god mode is on; `kill`
  then skips `clearGrade`, so a dev kill opens no gate for good.
- **Co-op alone, with lag** (`#devCoop`, `src/dev/20_lagdial.js`, the lag
  dial in `coop.md`). `coopSolo(o)` (`DF.coopSolo`) runs a co-op run alone
  against a host stepped on the page. Besides the link's `ping`, `jit`,
  `loss`, `rnd`, the scripted `mate`, `before`, `tamper` and `save`, it
  takes `hub` (the host starts in the co-op hall; `seed` is then the first
  trip's) and `pid` (2: this page is the friend and the scripted player is
  the host's page, pid 1, which the returned `mateAsk(name, ...args)` can
  have travel) and `two` (the host's cave is a dungeon for two, whoever is
  in it). Without `save` the dev run follows it from world to world.
- **Warden for two, alone** (`[data-dev-w2]` "Fight", `[data-dev-w2p="2"]` to
  `"4"` "Phase 2" to "Phase 4"; `devWardenTwo(seed?)`, `devWardenPhase(n)`,
  `devWardenRun()`, all on `DF`). Fight runs `coopSolo({ two: true, mate:
  "fight" })` (a random cave for two without a seed), then stands this player
  at `sealDoor(world)` (the door spot, 9 m from the chamber's centre on the
  route in, inside the ring the seal will lay) and the scripted player 1.6 m
  to its right, lights the last rest point and makes it the checkpoint, as
  `devBoss` does, and returns the run. The link `coopSolo` makes carries
  `solo = true`, which is how Fight tells its own run from a real room. **A
  room with a real friend, or one being joined, is never torn down:** Fight
  starts nothing and `#devW2Msg` on the dev screen says so; only a run
  `coopSolo` made is replaced. A Phase button calls `host.phase(n)` on the
  run and returns to play (a roar, and at 4 the seal and the dark, as a real
  hit does it); it does nothing with no live run, or once the Warden is in
  that phase or later, and stays on the dev screen when the phase did not
  rise to it (`host.phase` returns `null`: outside its chamber `hpFloor`
  holds it at phase 3). `devWardenRun()` is the run while the page is still in
  it, else `null`. Nothing is saved (`DEV.run` follows the run, as with the
  lag dial). The pause menu's Exit and `enterHub` end the room, so `NET` is
  `null`, the link closed and `G.seal` `null` afterwards; Return to base in a
  co-op run goes to the co-op hall, as it does for a real pair. A wipe takes
  the seal down and the room goes on, as in any co-op run.
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
