# DungeonRaze codebase: readiness for 4 to 5 player co-op

Scope: a read-only audit of `src/` at commit `1127ae7` (branch `main`, 2026-11-20). Every finding cites a file and line. "Sources" here are code locations, not URLs. Counts come from `grep`, `wc -l` and a small counting script run over `src/`. One experiment was run outside the repository (a Node script in a scratch directory that loads the source files into a `vm` context with stubs); its results are marked "Experiment". Nothing in the repository was changed, built or run. The Playwright tests were not run, because they write screenshots.

Paths are relative to `/Users/maxlerman/Documents/Research/.research/dungeon-raze/`.

## 1. How many places read the single player, and which systems assume exactly one

### Takeaway
The game has exactly one player object, `G.player`, and no attacker or target parameter anywhere in the damage path: `hitEnemy` and `hurtPlayer` both look up `G.player` themselves. About 1,000 `p.<field>` reads sit behind 78 `G.player` lookups, so most of the volume is mechanical; the real work is in roughly a dozen functions where "the player" means "the target" or "the attacker", plus the crocodile.

### Cited Findings
- `G.player` is one field of the state object, created by `makePlayer(OPT.cls)` on every zone change — `src/06_game.js:9`, `:2051`, `:2065`.
- `G.player` occurrences per file (78 in all): `06_game.js` 57, `08_hud.js` 6, `08c_touch.js` 5, `05b_dbodies.js` 2, `06b_ebeh.js` 2, `07_render.js` 2, `09_main.js` 2, `07b_dfx.js` 1, `08d_pad.js` 1. The enemy hooks get the player as `c.p` instead: 21 occurrences, all in `06b_ebeh.js` — counting script over `src/*.js`.
- 50 of the 118 top-level functions in `06_game.js` reference `G.player`. The usual pattern is `const p = G.player` at the top — for example `src/06_game.js:3488`, `:4295`, `:2491`, `:2623`.
- `p.<field>` occurrences (regex `(?<![\w.])p\.[a-zA-Z]`): 871 in `06_game.js`, 110 in `06b_ebeh.js`, 89 in `07_render.js`, 47 in `08_hud.js`. By function: `playerUpdate` 387, `useSpecial` plus `useTool` 99, `hurtPlayer` 48, the hold functions 30, rifts and Drop 27, `enemyUpdate` 25, `hitEnemy` 21, clouds, shots and `separate` 16, bombs, cave-in and mines 11, `update` 11; in `06b_ebeh.js` the rat to grabber hooks 33 (plus 7 `c.p`), the crocodile 73 (plus 13 `c.p`). In the world files `p.` is a point, not the player, so those are left out.
- **Damage to enemies has no attacker.** `hitEnemy(e, dmg, post, o)` reads `G.player` for the Riftwalker bonus, the class's ambush and backstab multipliers, the backstab angle, berserk life steal, the knock direction and focus gain — `src/06_game.js:2488-2575`. It has 11 call sites.
- **Damage to the player has no target.** `hurtPlayer(dmg, e, atk)` reads `G.player` — `src/06_game.js:2622-2714`. It has about 14 call sites (15 textual occurrences including the definition).
- **Shots have no owner identity.** A shot is `own: "p"` or `own: "e"`; `fire` builds it from `G.player` — `src/06_game.js:2893-2913`. An enemy shot is tested against the one player only — `:5487-5488`. A parried shot flips to `own: "p"` — `:5494-5501`.
- **Blasts take the class of the one player.** `explode` multiplies posture by `G.player.cls.blastPost` whatever caused the blast — `src/06_game.js:2254-2255`, and again at `:5539`.
- **Enemy targeting and sight.** `enemyUpdate` works out `dx, dz, dist, toP, alive` once from the one player and everything after uses them — `src/06_game.js:4359-4363`. `canSee`, `inTerritory` and `huntOver` read `G.player` — `:2279-2308`. An enemy more than 75 m from the player that is not hunting is not updated at all — `:4364`. Wake-up by sight reads `p.sprint` and `p.state` — `:4400-4402`. `alertE` records the player's position as last seen — `:2372-2376`. Each enemy has one last-seen memory (`lsx, lsz, lvx, lvz`) — `:1947-1951`.
- **Attack tokens** are a global cap of two across all non-boss enemies — `src/06_game.js:2268-2275`. Player death clears every token — `:2815`.
- **`G.inBoss`** is one flag set from the one player's distance to the boss room — `src/06_game.js:5627-5633`. It gates `alertE` (`:2370`), `huntOver` (`:2306-2307`), the ambush bonus (`:2513`), the brood mother (`06b_ebeh.js:163`), the eel (`:240`) and the crocodile's start and reset (`06b_ebeh.js:1451`, `:1476`).
- **Grabs and `held`.** `grabPlayer(e, o)` puts `G.player` in `held` with `p.hold = { by: e, ... }` — `src/06_game.js:2721-2738`. `G.grabGrace` is one global timer — `:2726`, `:2755`, `:5634`. `endHold` puts every enemy in state `hold` back to `rec`, which assumes one hold in the world — `:2740-2749`. `releaseHold` clears the dodge taps directly in the input tables — `:2759-2761`.
- **Lock-on** is `p.lock`, an object reference to an enemy (60 occurrences in `06_game.js`); `pickLock`, `aimRanged` and `plaqueAt` score candidates against the global `cam.yaw` — `src/06_game.js:2842`, `:2885-2891`, `:3055`.
- **Camera.** One global `cam` — `src/06_game.js:56-68`. `camUpdate` follows `G.player` — `src/09_main.js:239-334`. Simulation code writes it: `snapCam` (`06_game.js:2035-2040`), `respawn` (`:2155-2156`), unlocking (`:3578`) and a rift crossing (`:5256-5258`).
- **HUD.** `08_hud.js` reads `G.player` for bars, lock reticle, line of sight for name tags and the kit — `src/08_hud.js:81`, `:84`, `:316`, `:479-480`. `render()` poses and draws one player figure and uses the player's position for visible pieces and lights — `src/07_render.js:926-934`, `:547-548`.
- **Death and respawn.** `playerDie` sets `G.slowT`, clears tokens and counts `G.deaths` — `src/06_game.js:2802-2816`. 1.6 s later `update` sets `G.state = "dead"` — `:5706`. `respawn()` moves the player to `G.checkpoint`, refills them and rebuilds every enemy with `spawnEnemies()`, clearing rock, mines, rifts, holes, clouds, chunks, shots and bombs — `:2107-2158`.
- **Kill rewards.** `kill(e)` gives focus and a 40% tool charge to `G.player`, counts `G.kills`, moves that player's lock, and on a boss calls `clearGrade(grade, OPT.cls)`, sets `G.bossDead`, `G.gate` and `G.slowT = 1.2` — `src/06_game.js:2409-2453`.
- **Focus and tool charges** are fields of the one player; hits add focus in `hitEnemy` (`:2571`, `:2574`), parry and perfect dodge in `hurtPlayer` (`:2631`, `:2651`), executions at `:3963-3972`; the hall refills them — `:3495-3503`.
- **Class tools are global lists with global caps.** `G.rifts` is one pair, "at most two", and a third end shifts out the oldest — `src/06_game.js:5170`, `:5179`. `G.mines`, `G.caveins`, `G.bombs`, `G.holes`, `G.pending` carry no owner — `:5061`, `:4959`, `:4839`, `:5335`, `:3343`.
- **Executions.** `nearestStaggered` picks for the one player with no claim on the enemy — `src/06_game.js:2819-2831`. `startExecute` sets `p.exT = e` and the `execute` case pulls the player to a spot beside the enemy — `:2973-2989`, `:3949-3956`. The crocodile's mark logic tests `p.state === "execute" && p.exT === e` — `src/06b_ebeh.js:1458-1462`.
- **The crocodile** picks where to surface from the player's position and whether the player is in water — `src/06b_ebeh.js:692-710`; it resets when the player leaves the cavern or dies — `:1451`; its plates, slam, roll target, falling chunks ("3 to 8 m from the player") and bloaters all take `c.p` — `:883`, `:1051`, `:1219-1220`, `:1347`, `:1620-1621`, `:1694`, `:1710`.
- **Other single-player reads:** map discovery marks rooms seen from the one player — `src/06_game.js:5686-5705`; the win gate tests the one player — `:4168-4175`; the hall portal trigger does too — `:5709-5717`; `separate` pushes the one player and enemies apart — `:5591-5614`; drips fall round the one player — `:2211-2220`; bombs hurt the one player — `:4871-4876`.

### Inferences
- A useful seam already exists: the D enemy hooks never read `G.player` for behaviour, they read `c.p`, which `enemyUpdate` builds per enemy per step (`src/06_game.js:4434-4435`). If `enemyUpdate` chooses a target player per enemy at line 4359, the hooks for the rat, drowned, brood mother, bloater, eel, siren and grabber follow with little change. Only 2 `G.player` reads remain in `06b_ebeh.js` (`:144`, `:1286`).
- `playerUpdate` is 690 lines with 387 player reads behind one binding (`:3488`), so it converts to "update this player" by changing its signature. The same holds for `heldUpdate`, `startMove`, `startDodge`, `useTool` and `useSpecial`.
- The functions that need design, not renaming: `hitEnemy`, `hurtPlayer`, `kill`, `explode`, `projUpdate`, `enemyUpdate`'s senses, `takeToken`, `grabPlayer`/`endHold`, `nearestStaggered`/`startExecute`, `riftBodies`, `separate`, `respawn`, `update`'s `G.inBoss` and portal trigger, and the crocodile's step.

### Gaps
- The counts of `p.` are textual. A handful in `06_game.js` may be a local `p` that is not the player; this was not checked line by line.
- The 1,212 lines of crocodile code were read in part (spot choice, reset, marks, hooks), not in full.

## 2. Randomness and determinism

### Takeaway
World generation uses a seeded integer generator and is repeatable within one JavaScript engine; the combat simulation uses unseeded `Math.random` at about 20 gameplay sites and a variable timestep in the live loop, so it is not deterministic today. With `Math.random` replaced and a fixed step it is repeatable in one engine (shown by experiment), but identical results across browsers cannot be assumed, which rules out lockstep and points to state synchronisation.

### Cited Findings
- The seeded generator is `rng(seed)`, integer arithmetic with `Math.imul`, and `hash2`, also integer — `src/01_math.js:23-37`. It is used only by world generation and one mesh: `src/03_world.js:513`, `src/03c_sewer.js:207`, `:516`, `:752`, `src/07_render.js:627`.
- No world generator calls `Math.random` (count 0 in `03_world.js`, `03b_hub.js`, `03c_sewer.js`, `03d_sewerdress.js`, `03e_sewerview.js`).
- `Math.random` appears on 51 lines: `06_game.js` 31, `06b_ebeh.js` 12, `09_main.js` 3, `04_audio.js` 3, `07_render.js` 2.
- Sites that change gameplay: enemy start values `cd`, `walk`, `ph`, `strafe` (`06_game.js:1915-1923`); the run's seed (`:2080`); pack wake-up delays (`:2340`, `:2394`); the 40% tool refund on a kill (`:2420`); the enemy's attack choice (`:4193`); strafe timing (`:4536-4537`, `06b_ebeh.js:202-203`); attack cooldown (`06_game.js:4794`); the crocodile's time under (`06b_ebeh.js:867`), mouth plan and plate counts (`:947-952`), ceiling timer (`:1161`), chunk spots (`:1219-1220`) and bloater mouth (`:1382`).
- Cosmetic sites that draw from the same stream: `sparks` (`06_game.js:2163-2175`), `splash` (`:2187-2197`), drips (`:2215-2246`), buff sparks (`:3525-3528`), `:4749`, `:5036-5037`, rubble and chunk seeds (`:4953`, `06b_ebeh.js:1238-1239`), camera shake (`09_main.js:300-302`).
- The live loop is variable step: `dt = min((now - last) / 1000, 0.05)` from `requestAnimationFrame`, split into two updates when the step is over 22 ms — `src/09_main.js:336-355`. Smoothing uses `1 - Math.exp(-k * dt)` — `src/01_math.js:11`, `:18`.
- Tests use a fixed step: `DF.sim(sec, each)` calls `update(1 / 60)` in a loop — `src/09_main.js:753-761`.
- World generation feeds floating-point library functions into the collision field: the cave's tunnel wobble uses `Math.sin` (`src/03_world.js:550-555`) and rooms and tunnels use `Math.hypot` (`:603`, `:617`). Function counts: `03_world.js` sin 11, cos 8, atan2 3, hypot 13; `03c_sewer.js` sin 4, cos 4, atan2 6, hypot 36, pow 1; `03d_sewerdress.js` sin 18, cos 17. The field is stored as `Float32Array` — `src/03_world.js:584`, `src/03c_sewer.js:385`.
- `tests/t22.mjs` holds hashes of caves 1, 7 and 99 and of sewers 1, 5 and 9, and runs only in headless Chromium — `CLAUDE.md` (Testing section), `test.mjs:12-19`.
- Experiment (Node v22.13.1, arm64): `genWorld(99)` and `genSewer(5)` each gave the same mesh hash twice. `genWorld(99)` produced 245,505 vertices, which is 81,835 triangles, the figure `CLAUDE.md` gives for cave 99.
- Experiment: 20 s of simulation at 60 steps a second on cave 99 with scripted input gave an identical end-state hash on two runs when `Math.random` was replaced by a seeded generator, and different hashes with the real `Math.random`.
- Some enemy logic is order and budget dependent: `setRoute` allows two route searches per `update` (`src/06_game.js:4230-4232`, `G.routeN` reset at `:5618`).

### Inferences
- The ECMAScript specification leaves `Math.sin`, `cos`, `atan2`, `hypot`, `exp` and `pow` implementation-approximated, so Chrome, Firefox and Safari may differ in the last bit. This is background knowledge, not something the code shows. Because iPhones play through Safari (`CLAUDE.md`, Known problems), a party can mix engines. Storing the field as 32-bit floats hides most last-bit differences but not at thresholds (`F[k] < need`, sorts by distance, marching squares), so a seed is not proven to give the same sewer on every browser.
- Safer options for sharing a world: the host or server sends the field grids (`F`, `Wt`) and the spawn list instead of only the seed; or the generators are made bit-exact by replacing `Math.hypot` with `Math.sqrt(x*x + z*z)` (`sqrt` and the basic operators are exactly specified) and the few `sin`/`cos`/`atan2` calls that feed the field with table or polynomial versions. Either choice changes t22's hashes.
- Deterministic lockstep (send only inputs) is not a sound choice for this code: unseeded randomness, cosmetic effects on the gameplay stream, variable `dt`, exponential smoothing and cross-engine maths all stand in the way. A model that sends state from one authority avoids all of them. Under that model the unseeded `Math.random` is harmless on the authority.
- Node and Chromium both run V8, so a Node server and Chrome clients are likely to agree on world generation; Safari and Firefox clients are the open case.

### Gaps
- Cross-engine world equality was not tested. Running t22's hash step in Firefox and WebKit through Playwright would settle it.
- The experiment's state hash covered the player and enemies (position, health, state, yaw), not every list.

## 3. Hit-stop and slow motion

### Takeaway
Both are global time controls that live in the frame loop, not in `update`. Tests and a headless server never see them, so they are already close to being presentation; with several players they must become local or per-entity effects, because as written one player's hit would freeze the world for everyone.

### Cited Findings
- Applied in one place: while `G.hitstop > 0` the frame simulates nothing; else while `G.slowT > 0` it simulates `dt * 0.3` — `src/09_main.js:344-351`.
- `DF.sim` and `update` ignore both — `src/09_main.js:753-761`, `src/06_game.js:5616-5718`.
- Hit-stop is set by: any melee, blink or execution hit on an enemy, 0.055 s or 0.1 s heavy (`src/06_game.js:2569`); any hit on the player that is not damage over time, 0.06 s (`:2695`); an execution, 0.13 s (`:4039`, `:4042`).
- Slow motion is set by: a boss kill, 1.2 s (`:2444`); a perfect dodge, 0.4 s (`:2630`); a parry, 0.16 s (`:2648`); the player's death, 0.8 s (`:2812`); an execution, 0.4 s (`:3960`).
- Both are cleared by `resetRun` — `:2025-2026`.

### Inferences
- With four melee players each landing about three light hits a second, the summed hit-stop requests come to roughly 0.66 s per second (4 x 3 x 0.055). They overlap through `Math.max`, so the world would not stop that long, but it would stutter for every player on every other player's hit. A perfect dodge by one player would slow the whole fight for 0.4 s for all.
- Options: keep them as local presentation only (the attacker's client briefly holds its own figure and the struck enemy's pose and shakes its own camera, while the authority's clock runs on); or per-entity freeze timers on attacker and victim inside the simulation. Global slow motion is only defensible for moments the whole party shares, such as the boss kill.
- Because the authority already runs without them in tests, removing them from the shared clock is a small code change. The cost is feel: the single-player game's impact comes partly from these freezes, and they would need retuning.

### Gaps
- No playtest data exists on how much the feel depends on them (`CLAUDE.md` says balance and feel are untested by hand).

## 4. Separation of simulation from rendering, input, audio and the DOM

### Takeaway
Separation is better than the single-scope build suggests: the twelve files `01` to `06b` (14,723 lines) load and run in Node with a four-line stub and never touch a browser global. What is not separated is the direction of calls: simulation code plays sounds, spawns particles, writes camera state and HUD messages inline, and reads the camera and device sticks directly.

### Cited Findings
- All source files are concatenated into one function scope with no modules — `build.mjs:7-10`.
- `document.` appears only in `08_hud.js` (3), `08c_touch.js` (16), `08d_pad.js` (8) and `09_main.js` (19); `localStorage` only in `06_game.js` (2, inside `try`, `:246`, `:262`); `window.` once each in `02_gl.js` and `04_audio.js`, inside functions.
- Renderer calls from simulation files: `06_game.js` has `R.env` reads and writes (`:1981-1996`) and `R.setWorld` in `newRun` and `enterHub` (`:2049`, `:2063`). `06b_ebeh.js` has none. `R.nodePos` and `R.toScreen` are used only in `07_render.js` and `08_hud.js` (`07_render.js:972-1035`, `08_hud.js:74-447`), never in game logic.
- Audio calls from simulation: 76 `SFX.` calls in `06_game.js`, 18 in `06b_ebeh.js`. `SFX` does nothing until its audio context exists — `src/04_audio.js:60`, `:79`.
- Effects spawned inside simulation code: `sparks(` 28 times in `06_game.js` and 9 in `06b_ebeh.js`; `G.rings` 14 and 2; `G.shake` 25 and 13; `say(` 23 and 1; `PAD.rumble` 7 (`06_game.js:2577`, `:2654`, `:2681`, `:2707`, `:2736`, `:2814`, `:2977`). 44 of 118 top-level functions in `06_game.js` touch at least one of these.
- Simulation reads device state directly: `TOUCH.move` and `PAD.move` in `playerUpdate` (`06_game.js:3542-3549`), `PAD.sprint` (`:3659-3660`), `mouse.wheel` (`:3580-3584`), `PAD.move` in plaque input (`:3141`, `:3159`).
- Simulation reads the camera for aim and movement: `cam.yaw` at `06_game.js:2842`, `:2885`, `:2891`, `:3055`, `:3358`, `:3373`, `:3450`, `:3551-3552`, `:3700`.
- Render objects live on simulation entities: `fig: makePlayerFig(id)` (`:1855`), `fig: makeEnemyFig(s.type)` (`:1925`). The simulation reads the figure's scale for stride, shot height and spark height (`:2483`, `:2560`, `:3986`, `:4022`, `:4219`, `:4225`, `:4282`) and its eye colour (`:2422`, `06b_ebeh.js:187`). Figures are plain node trees with primitive names and need no GL to build — `src/02_gl.js:2-24`, `src/05_figures.js:2-40`.
- Presentation writes onto simulation entities: `e.vis` (`07_render.js:938`), pose phases `e.pt`, `e.pph`, `e.wph`, `e.surf`, `e.gy`, `e.ex` (`05b_dbodies.js:434`, `:435`, `:647-648`, `:1095`, `:1193`). The HUD decays `G.msgs`, `G.flashRed`, `G.flashWhite` (`08_hud.js:193-202`) and `camUpdate` decays `G.shake` (`09_main.js:298`).
- The simulation sets UI state: `G.state = "win"` (`06_game.js:4173`), `"dead"` (`:5706`), `"play"` in `respawn` (`:2111`, `:2157`); `hurtPlayer` and `grabPlayer` refuse unless `G.state === "play"` (`:2625`, `:2724`).
- Simulation runs only in the `play` and `dead` states, so any menu pauses the world — `src/09_main.js:343`. Pointer-lock loss, fullscreen exit, blur and a hidden page pause the game — `src/09_main.js:459`, `:493`, `:504`, `src/08c_touch.js:515-521`.
- There is no network code: no `fetch`, `WebSocket`, `RTCPeerConnection` or `XMLHttpRequest` in `src/` or `index.tpl.html`; the only outside request is Google Fonts — `index.tpl.html:7-9`. The only package is Playwright as a dev dependency — `package.json`.
- Experiment: files `01_math.js` through `06b_ebeh.js` loaded in a Node `vm` context with these stubs appended: `PAD = { rumble(){}, move:{x:0,y:0,mag:0}, active:false, sprint:false, fam:"xb" }`, `TOUCH = { move:{x:0,y:0,mag:0}, on:false }`, `RM = false`, `padName = () => ""`, and `R.setWorld` replaced by an empty function. Getters on `document`, `window`, `navigator`, `localStorage`, `performance`, `requestAnimationFrame`, `matchMedia`, `AudioContext` and others recorded any access: none was touched at load or in 30 s of simulated play.
- Experiment timings: `newRun(99, "E")` took about 0.19 s and `newRun(5, "D")` about 1.0 s. Thirty seconds of simulation cost 0.19 ms a step on the cave with 32 to 47 enemies, and 0.67 ms a step on the sewer with 93 to 109 enemies, with every regular enemy woken and placed near the player (a heavier load than real play).

### Inferences
- A headless Node server is close: a second build target that concatenates `01` to `06b` with the stub block, a fixed-step loop on a timer, and an export of the functions `window.DF` already lists (`src/09_main.js:610-762`). At 0.2 to 0.7 ms a step, a 60 Hz room uses about 1 to 4 percent of one core, so one small machine could host many rooms. That is before the cost of serialising state.
- The same result means the simulation could run in a Web Worker on a player's machine, which matters for a host-authoritative model: the host's simulation would not stop when its tab loses focus or `requestAnimationFrame` is throttled.
- The inline sounds, particles, messages, shake and rumble need to become events, for two reasons: a server must not run them, and clients need to hear and see them. Roughly 94 sound calls, 37 `sparks`, 24 `say`, 7 rumble and about 40 shake or flash writes would go through one `emit(kind, data)` call that the local presentation consumes and the network forwards. Most are one-line edits. Some effects can instead be derived on the client from state changes (an enemy entering `stagger`, a shot disappearing).
- `e.fig.o.sc` should move to `EDEF` (a `sc` number per type) so entities hold no render objects; then entities serialise cleanly and a server builds no figures.

### Gaps
- The experiment drove one scripted player. It did not exercise every class tool, the crocodile fight or the hall, so a browser dependency on a rare path is possible, though the `grep` counts above make it unlikely.
- Browser frame cost was not profiled; the step times are for Node on an Apple arm64 machine.

## 5. State shape and serialisation

### Takeaway
Run state is almost all under `G` and entities are plain object literals, which is the easy half. The hard half: no entity but a rift end has an id, entities point at each other and at definitions by object reference, and some state lives outside `G` (camera, input tables, rock inside the world's closure, two module counters, saved progress).

### Cited Findings
- `G` is declared at `src/06_game.js:2-52`. Five more fields are added later without being declared there: `G.caveins`, `G.mines`, `G.bombs`, `G.insp`, `G.grabGrace` (`:2001-2017`), and tests add `G.manual`. 45 distinct `G.` fields are referenced across `src/`.
- State outside `G`: `cam` (`:56-68`); `keys`, `taps`, `mouse` (`:53-55`); `OPT`, `BIND`, `PAD_BIND` (`:116-150`); `UNLOCKED` (`:209`); `CLEARED` (`:226`); `riftId` (`:5165`) and `riftA` (`:5195`); the rock list, base field copy and rock counter inside the `fieldFns` closure (`src/03_world.js:248-250`); `seen` flags on world nodes and edges (`06_game.js:5695`, `:5701`); `lit` on shrines (`:4155`); `PAD.sprint` and `TOUCH.move`.
- The player is a literal with 47 keys at creation (`:1817-1867`); more are added as play goes on (`aim`, `exT`, `exX`, `ddx`, `pdUsed`, `riftBonus`, `riftCD`, `hold`, `gT`, `bT`). An enemy is a literal with 63 keys (`:1893-1970`); D types add more (the crocodile's `mode`, `modeT`, `spot`, `tun`, `marks`, `shores`, `cross`).
- No ids: `makeEnemy` assigns none (`:1893-1970`); shots, bombs, mines, cave-ins, holes and clouds have none (`:2896`, `:4839`, `:5061`, `:4959`, `:5335`, `06b_ebeh.js:217`). Only rift ends (`06_game.js:5178`) and rocks (`03_world.js:285`) get one.
- Enemies are removed by filtering the array, so an index is not stable — `06_game.js:5659`. Enemies are added mid-fight by the brood mother and the crocodile's falls — `src/06b_ebeh.js:183`, `:1388`.
- Object references between entities: `p.lock`; `p.exT` (`:2979`); the blink target `p.bT` (`:4101`); `p.hold.by` (`:2731`); `p.hitSet`, a `Set` of enemies (`:2928`); `proj.src` (`:4289`, `06b_ebeh.js:1017`); `proj.hitSet` (`:2913`); `bomb.e` (`:4843`); `mine.links`, mines pointing at each other both ways (`:5073-5074`); `e.alertBy` (`:2341`); `e.mom` (`06b_ebeh.js:181`); `e.atk` and `e.plan`, references into `EDEF`; `e.def`; `p.cls`; `e.fig`, `p.fig`; `G.checkpoint`, a shrine object (`:4156`); `riftSnap` keys a `Map` by enemy object (`:5232-5237`).
- Experiment, naive JSON sizes with `fig`, `def` and `cls` dropped and enemy references turned into indices: player 724 to 813 bytes; an enemy 849 to 2,604 bytes, about 1.1 kB on average; all 32 enemies of the cave run 36.7 kB; all 93 of the sewer run 99.3 kB. With `fig` and `cls` left in, the player alone is 31 kB.
- Cosmetic lists that need no sync: `G.parts` (capped at 700, `:2162`), `G.arcs`, `G.rings`, `G.drips`, `G.ghosts`, `G.msgs`.

### Inferences
- Serialisation work: give every enemy, shot, bomb, mine, cave-in, hole, cloud and chunk an id from one counter; send references as ids; write an explicit list of fields per entity kind, since most of an enemy's 63 keys are AI scratch (route, search steps, stuck timers) that a client does not need.
- A client needs perhaps a dozen values per enemy to draw and predict it: position, height, yaw, health, posture, state, state time, current attack, phase and a few flags (`hidden`, `safe`, `aloft`, `aware`). That is about 20 to 30 bytes packed. Thirty active enemies at 20 updates a second is then about 12 to 18 kB/s per client before delta compression. The naive JSON form would be about 660 kB/s for the same load, so a hand-written encoder is needed, not `JSON.stringify(G)`.
- The poses are driven by state and timers on the entity (`e.state`, `e.t`, `e.atk`, `e.walk`), so a client that receives those can pose remote enemies with the existing `poseEnemy` and `EPOSE` code unchanged.
- For host migration or join in progress, a full snapshot including AI scratch and the world's rock list would be needed; that is a larger encoder than the per-tick one.

### Gaps
- No binary encoding was written or measured; the packed sizes are estimates.
- The size of a "busy fight" snapshot was measured with every enemy awake near the player, not from recorded play.

## 6. Input

### Takeaway
Input is already abstracted into named actions read through two functions, which is most of what a per-player input frame needs. Four things leak past the abstraction: analogue sticks, the camera yaw, the lock-switch wheel, and one place where the simulation writes the tap table.

### Cited Findings
- `held(a)` and `hit(a)` read the keyboard or mouse binding, the touch key `T:action` and the pad key through `PAD_BIND` — `src/06_game.js:153-163`. Actions are listed in `ACTIONS` — `:99-115`.
- Game logic calls them at 14 places, all in `06_game.js`: `:2771`, `:3204`, `:3539-3540`, `:3564`, `:3570-3576`, `:3593-3594`, `:3660`. No other simulation file calls them.
- Presses are buffered on the player for 0.3 s (`p.buf`, `p.bufT`) — `:3595-3602`.
- Leaks: stick vectors read from `TOUCH.move` and `PAD.move` (`:3542-3549`) and the pad sprint latch (`:3659-3660`); movement direction built from `cam.yaw` (`:3551-3554`); guard facing and ranged aim follow `cam.yaw` (`:3700`, `:2875-2891`); tools and abilities aim along `cam.yaw` when nothing is locked (`:3358`, `:3373`, `:3450`); lock choice scores by angle from `cam.yaw` (`:2842`); `mouse.wheel` switches lock target (`:3580-3584`); `releaseHold` writes `taps` (`:2759-2761`); plaque code entry reads `taps` and `PAD.move` (`:3127-3150`).
- Tests already drive input by writing the tables: `DF.keys[DF.BIND.fwd] = true`, `DF.taps[DF.BIND.light] = true` — `CLAUDE.md` (Testing), `src/09_main.js:753-761`.

### Inferences
- A per-player input frame would hold: move x and y with magnitude, camera yaw, held flags (guard, sprint), and one-step taps (light, heavy, dodge, tool, heal, special, lock, lock switch, interact). About 8 to 12 bytes a step.
- Converting `held` and `hit` to take the player (or to read a "current input" set before each player's update) changes about 25 lines. This is the smallest step in the refactor.
- Because aim follows the camera, the camera yaw must travel in the input frame; camera pitch is not read by the simulation.
- Plaque codes (`readSyms`) can stay local to each client, since unlocks are per player.

### Gaps
- None of substance; this area was read in full.

## 7. Mutable world state that would need syncing

### Takeaway
The generated world is static apart from a short list: rock added to the field, shrine and gate flags, and the entity lists. Rock is cheap to sync because it is five numbers applied by a deterministic repaint.

### Cited Findings
- Rock: `addRock(ax, az, bx, bz, r)` writes a capsule into the field and returns an id; `removeRock(id)` and `clearRocks()` repaint from a base copy — `src/03_world.js:243-300`. Callers: the Sapper's cave-in (`src/06_game.js:4994`, removed at `:4963`) and the crocodile's fallen ceiling (`src/06b_ebeh.js:1293`, removed at `:1248`, `:1256`). Both drop every enemy's route when rock changes (`06b_ebeh.js:1249`).
- A cave-in and a chunk landing also move bodies out of the rock, the player included — `caveImpact` at `src/06_game.js:4970-5025`, `crocChunkLand` at `src/06b_ebeh.js:1285-1340` (the body list, player first, is built at `:1292`).
- Shrines: `sh.lit` and `G.checkpoint` — `src/06_game.js:4148-4166`.
- Boss and exit: `G.bossDead`, `G.bossSeen`, `G.gate` — `:2442-2443`, `:2383`.
- Map discovery: `n.seen`, `e.seen` — `:5688-5705`.
- Hall portals: `open` is computed when the hall is built, from `portalOpen` and so from the local `CLEARED` — `src/03b_hub.js:29-46`.
- Enemy posts can move (`e.hx`, `e.hz`) — `src/06_game.js:4476-4477`.
- Entity lists that carry gameplay: `G.enemies`, `G.projs`, `G.bombs`, `G.mines`, `G.caveins`, `G.rifts`, `G.holes`, `G.clouds`, `G.shocks`, `G.chunks`, `G.pending` — `:10-51`, `:2001-2024`.
- Water never changes after generation and blocks nothing — `CLAUDE.md` (Water), `src/03_world.js:301-311`.

### Inferences
- Rock sync is an event with the capsule's five numbers and a tick; each client calls its own `addRock` and gets the same field, because `repaint` is plain arithmetic on the grid (`Math.hypot` aside, see section 2). The risk is ordering: a client that predicts its own movement must apply the rock on the same step as the authority, or it will briefly walk through or be blocked.
- Map discovery can be per player or shared; shared is simpler and suits co-op.
- A late joiner needs: seed or field, live rocks, lit shrines, checkpoint, boss and gate flags, and the full entity lists.

### Gaps
- `03c_sewer.js` (1,589 lines) was not read in full; a mutable field on sewer rooms other than `seen` is possible but none showed up in the `grep` for assignments from game code.

## 8. Zones, flow and saved data

### Takeaway
The flow is built round one player owning the whole world: one world loaded, the player rebuilt at each zone change, death resetting the dungeon, menus pausing time, and progress stored per browser. Each of these needs a party rule, and most are design decisions before they are code.

### Cited Findings
- One world at a time: `G.world` is replaced by `newRun` or `enterHub`, each of which calls `resetRun()` and makes a new player — `src/06_game.js:2042-2078`. The player's health, flasks and charges therefore reset on every trip.
- The hall is a world of the same shape as a dungeon and runs the same `update` — `src/03b_hub.js:67`, `src/06_game.js:5616`.
- The trip starts when the one player steps into an open portal; `startTrans` fades, and the whole simulation is frozen while `G.trans` is set — `src/06_game.js:5709-5717`, `:2085-2106`, `:5620-5623`. The seed is drawn from `Math.random` — `:2080`.
- `resetRun()` clears all per-run state — `:1999-2034`.
- `respawn()` rebuilds every enemy and clears rock, mines, rifts and shots — `:2107-2158`. In the hall it rebuilds the hall — `:2109-2113`.
- The win state is global and triggered by the one player at the gate — `:4168-4175`. "Return to base" calls `enterHub(G.grade)` — `src/09_main.js:91-93`.
- Saved data is one `localStorage` key, `dungeon-raze.v2`, with bindings `b`, pad bindings `p`, options `o`, unlocked classes `u` and cleared grades `c` — `src/06_game.js:244-258`. `CLEARED` maps a class id to grades; a gate is open when any class has cleared the grade below — `:226-239`, `src/03b_hub.js:30-34`.
- A boss kill records the clear for the local class and saves at once — `src/06_game.js:2441`, `:228-234`.
- The class is `OPT.cls`, a local option; hidden classes are gated by the local `UNLOCKED` set — `:209-222`, `:2051`.
- Pausing stops the simulation — `src/09_main.js:343`.

### Inferences
- Party travel needs a rule for who starts a gate (leader, everyone in the ring, or a ready check), a seed chosen by the authority, and a transition that all clients run together. The freeze during `G.trans` suits that, since the whole party moves at once.
- Which gates are open for a party is undecided by the code: the host's progress, any member's, or each member's own. `portalOpen(grade)` is the single choke point (`src/03b_hub.js:30`), so the rule is easy to change once chosen.
- Per-player progress can stay in each client's `localStorage` for a game among friends: the authority announces "boss dead in grade X" and each client records it for its own class. Anything that must resist tampering (ranked clears, rewards, the loot the backlog plans) would need accounts and server storage, which this code has none of.
- Death needs a co-op rule in place of `respawn()`: for example a downed state with revive, or a respawn at the shared checkpoint that leaves the enemies alone, and a reset only when the whole party is dead. `playerDie` clearing every token and `huntOver` ending every hunt when "the player" is dead (`:2305`, `:2815`) both need the same rule.
- Pause must become a local menu over a running world. Today touch and desktop both pause on focus loss, which in a host-authoritative game would stop the world for everyone if the host's tab did it.
- The player object should survive zone changes in multiplayer (or the reset should be deliberate), since it will also carry identity and connection state.

### Gaps
- The intended design for death, revives and shared rewards is not written anywhere in the repository; `CLAUDE.md` backlog item 2 only says to revisit whether dying sends the player to the base.

## 9. Tests

### Takeaway
The tests are white-box scripts that run inside one headless Chromium page and poke the globals through `window.DF`. They would keep working through a players-array refactor only with a compatibility alias, and they cannot today express two players or a host and a client; a Node harness could, cheaply.

### Cited Findings
- `test.mjs` (120 lines) launches Chromium with software WebGL, opens `dist/index.html` from disk, blocks every request that is not a file, clicks Play, then runs each step of a script with `page.evaluate` — `test.mjs:12-19`, `:57-61`, `:92-112`.
- There are 25 scenario scripts `tests/t1.mjs` to `t25.mjs` plus `touch-all.mjs`, `devices.mjs` and `codes-print.mjs`: 6,779 lines. The largest are `t25.mjs` (1,022), `t24.mjs` (916), `t14.mjs` (890), `t16.mjs` (837).
- Steps are strings of JavaScript that use `DF.G`, `DF.sim`, `DF.newRun` and direct calls such as `DF.hitEnemy`, `DF.hurtPlayer`, `DF.grabPlayer` — for example `tests/t12.mjs:4-30`. `sim(` appears 529 times across the scripts and `G.player` 134 times.
- `DF.sim` advances the real simulation at a fixed 60 steps a second without rendering — `src/09_main.js:753-761`. `G.manual` stops the frame loop from simulating — `:342-343`.
- Some tests replace `Math.random` to fix an outcome — `tests/t6.mjs:122-123`, `tests/t23.mjs:181`.
- `window.DF` exposes about 150 internals by name — `src/09_main.js:610-762`.
- The simulation is a singleton: every file shares one function scope and `G` is one constant — `build.mjs:7-10`, `src/06_game.js:2`.

### Inferences
- A refactor to `G.players` breaks the 134 `G.player` uses and every direct call whose signature changes (`hurtPlayer`, `grabPlayer`, `hitEnemy`). A getter `G.player` returning `G.players[0]`, and default arguments meaning "player 0", would keep the existing 6,779 lines running while new tests cover the multi-player paths. This is the main safety net for the refactor and worth protecting.
- Two simulated players in one page becomes possible as soon as input is per player: a test builds two input frames and steps `update`.
- A host and a client cannot both live in one page, because the simulation is a singleton. Two ways round it: open two Playwright pages joined by a real or loopback transport (`test.mjs` would have to stop blocking network requests, `:57-61`), or run two simulations in two Node `vm` contexts, as the experiment did, joined by an in-memory channel with injected delay and loss. The Node route needs no browser and runs at about 0.2 ms a step, so protocol tests could cover minutes of play in seconds.
- Nothing in the suite measures feel under latency; that needs people playing.

### Gaps
- The tests were not run for this audit, so their current pass state is unverified here.

## 10. Size of the work: steps, difficulty and the riskiest parts

### Takeaway
Keeping the JavaScript and adding networking is a large refactor but not a rewrite: about 60% of the code (world generation and simulation) is already headless and deterministic enough for state sync. The mechanical steps are modest; the cost and risk sit in multi-target enemy and boss behaviour, the death and party flow, and making parry and dodge feel right under latency. The effort figures below are the auditor's judgment from the code, not measurements.

### Cited Findings
- Simulation and world files that run headless today: 14,723 of 19,114 lines (files `01` to `06b`), per the experiment in section 4.
- Functions that need an attacker or target parameter: `hitEnemy` (11 calls), `hurtPlayer` (about 14), `grabPlayer` (3 calls: siren `src/06b_ebeh.js:367`, grabber `:520`, crocodile `:1678`), `explode` (8), `fire` (6), `kill` (4) — counting script.
- Parry windows are 0.18 to 0.28 s by class (0.2 for six of the eight) and halve on a repeated press — `src/06_game.js:351`, `:382`, `:411`, `:445`, `:3645`. Dodge invulnerability is 0.26 to 0.32 s — `:356`, `:388`, `:416`, `:452`. Both are judged at the instant the enemy's hit resolves inside `hurtPlayer` — `:2627-2668`.
- `posePlayer(p)` takes the player as an argument and reads only `G.t` and `G.insp` besides — `src/07_render.js:34-358`. `makePlayerFig(id)` builds a figure from a class id — `src/06_game.js:1855`.
- The project's build rule is a single HTML page with no run-time network requests but fonts, published to GitHub Pages — `CLAUDE.md` (Rules of the build), `.github/workflows/pages.yml`.

### Inferences

Refactor steps in a workable order. Sizes: S about days, M about a week, L two to three weeks, for one experienced developer who knows the code; agents can shorten the mechanical ones.

| # | Step | Size | Notes |
|---|------|------|-------|
| 1 | Per-player input frames: `held`/`hit` read a frame; camera yaw, stick vector, sprint latch and lock switch move into it | S | About 25 lines in `06_game.js`. Unblocks everything else. |
| 2 | Presentation events: route sounds, sparks, messages, shake, flash and rumble through one `emit`; move figure scale into `EDEF`; take `R.setWorld`, `R.env`, `cam` writes and `G.state` out of simulation code | M | About 200 one-line sites. Mechanical. Needed for a server and for clients to hear remote events. |
| 3 | `G.players` array with a `G.player` alias; pass the player into `playerUpdate` and its helpers; per-player lock, hold, grab grace, inspect, rift pair, mine and cave-in caps | M | Most of the 871 `p.` reads sit behind one binding per function. Keep the tests green through the alias. |
| 4 | Attacker and target through the damage path: `hitEnemy(…, by)`, `hurtPlayer(target, …)`, owners on shots, bombs, mines, blasts, clouds; kill credit, focus and tool refunds | M | About 45 call sites. Decide who gets rewards (last hit, all near, whole party). |
| 5 | Enemy targeting for several players: target choice and switching, senses and last-seen per target, the 75 m sleep rule, tokens per target, `separate`, `G.inBoss` per player, give-up rules | L | Design plus code in `enemyUpdate` and the pursuit helpers. Retune tokens and health for party size. |
| 6 | Bosses and D types for several players: crocodile spot choice, plates, roll, chunks, reset; siren song and drag; grabber; brood | L | 1,212 lines of crocodile logic keyed to one player. Server-side only, so it syncs easily once the policy is written. |
| 7 | Party flow: lobby in the hall, starting a gate together, death and revive rule, shared checkpoint, wipe, exit gate, per-player progress, local pause | M to L | Mostly design. `respawn`, `kill`, `update`'s portal trigger and `09_main.js` screens. |
| 8 | Hit-stop and slow motion made local or per-entity | S | Section 3. Feel needs retuning. |
| 9 | Ids on every entity; field lists; snapshot and delta encoder; spawn, despawn and world events (rock, shrine, gate) | M to L | Section 5. No library in use; hand-written binary encoder. |
| 10 | Transport and rooms: WebSocket server, or WebRTC with a signalling server; room codes, join, leave, timeouts | M | New infrastructure. Breaks the "one static HTML file, no network" rule, so hosting changes. |
| 11 | Client: interpolation of remote players and enemies, prediction and reconciliation of the local player, teleport flags, drawing other players, party HUD and minimap dots | L | The same `playerUpdate` code can run on the client for prediction, a real advantage of staying in JavaScript. |
| 12 | Lag handling for parry, dodge and grabs | M, high risk | See below. |
| 13 | Tests: compatibility alias, two-player sim tests, Node host and client protocol tests with delay and loss | M | Section 9. |

Rough totals, low confidence: model (a), one player's browser as host, about 8 to 12 developer-weeks to a playable four-player build that feels acceptable on good connections; model (b), a dedicated Node server, about 2 to 3 weeks more for the server build, deployment and room management, less if steps 2 and 9 are done cleanly. Balance and feel tuning for a party is extra and open-ended, and the single-player game itself has not been tuned by hand yet.

Model (a), host-authoritative in a browser:
- Works with the code as it stands plus steps 1 to 13; the host keeps rendering as now.
- The host's loop is `requestAnimationFrame` and the game pauses on blur, hidden page, lost pointer lock and fullscreen exit (section 4). All of that must stop pausing the world, and the simulation should move to a fixed-step timer or a Web Worker so a backgrounded host does not freeze the party.
- The host has zero latency and the others do not, which is uneven in a game of 0.2 s parry windows.
- If the host leaves, the run ends unless full-state host migration is built (the large snapshot of section 5).
- Peer-to-peer needs WebRTC with a signalling service and relays for players behind strict routers, or a plain relay server; either is infrastructure the project does not have. A phone as host is fragile.

Model (b), dedicated Node server:
- The experiment shows the simulation already runs in Node; the server build is a concatenation of twelve files plus stubs and a fixed-step loop.
- Every player has the same latency; rooms survive any one player leaving; the server is the one place for per-player progress if accounts are ever wanted.
- Costs: a server to run and pay for, deployment, and the world must match between Node and each browser (section 2), or the server sends the field.
- Step 2 becomes mandatory, not optional, because the server must not run presentation.

Hardest features to network, hardest first:
1. **Parry, perfect dodge and invulnerability timing.** Judged on the authority at the step the hit lands (`src/06_game.js:2627-2668`). A remote player sees the wind-up late by half the round trip plus the interpolation delay and their press arrives late by the other half, so the usual 0.2 s window shrinks by roughly the round-trip time plus the buffer. Fixes are known but costly: let each client judge hits on its own player and report the result (acceptable in co-op against the environment), or rewind enemy attack timing on the authority by the player's measured delay.
2. **Grabs and drags (`held`).** The authority takes over the player's position for up to 2 s and counts dodge presses (`:2763-2801`); this fights client prediction and needs an authoritative override state. The code also assumes one hold in the world (`endHold`, `G.grabGrace`). The crocodile's death roll moves both bodies together (`06b_ebeh.js:1569-1573`, `crocRollStep` at `:1693`).
3. **Executions.** Player and enemy are locked together with invulnerability, a heal and a kill (`:3949-4050`). Two players can pick the same staggered enemy since nothing claims it (`:2819-2831`). The crocodile's marks wait for "the" executing player (`06b_ebeh.js:1458-1462`).
4. **The crocodile.** Not hard to sync (its mode, timers and tunnel plan are a few fields) but every decision is about one player, so its policy has to be rewritten for a party: who it surfaces under, who the plates target, whose parry knocks it down, where chunks fall, when it resets.
5. **Rifts.** Teleports for players, enemies and shots in mid-step, with the camera turned (`:5200-5296`); one global pair (`:5170-5180`); a shot that crosses changes owner. Clients must not interpolate across a crossing, and a predicted player needs the rift state on the same step.
6. **Rock in the field.** Cheap to send, but it changes collision for every predicting client and pushes bodies out when it lands (`:4970-5025`), so it must be applied on an agreed step.
7. **Hit-stop and slow motion.** Technically simple once made local; the risk is to feel (section 3).
8. **Mines and tripwires.** Mutual references between mines (`:5073-5074`) need ids; otherwise they are ordinary server-side entities.
9. **Reflected shots.** Ownership flips on parry (`:5494-5512`); fine once shots have ids and owners.

Other risks:
- Feel has never been tuned by hand even for one player (`CLAUDE.md`, "Where the project stands"). Adding networking before the single-player feel is settled means tuning two things at once.
- Enemy difficulty for a party is unset: two attack tokens against five players is trivial, and health, posture and rewards have no scaling.
- The 75 m sleep rule and the route budget of two searches per update (`:4364`, `:4230-4232`) were sized for one player; with a party spread across a map more enemies are awake and asking for routes at once.

### Gaps
- No network code exists to measure, so every latency and bandwidth statement is an estimate.
- The effort figures are judgment. They assume the current code quality holds across the files not read in full (most of `03c_sewer.js`, `05b_dbodies.js`, parts of `06b_ebeh.js`).
- Whether the owner wants strangers matched online or only friends with a room code changes steps 10 and 7 a great deal; the repository does not say.

## 11. What is portable to another engine, and what would be rewritten

### Takeaway
The data tables and the design carry over to any engine as they are; the algorithms carry over as logic to be translated; the renderer, figures, poses, HUD, input and audio (about 40% of the lines) would be replaced. A web 3D engine is the only option that reuses the simulation code itself.

### Cited Findings
- `CLASSES` (8 classes, `src/06_game.js:338-613`), `MOVES` (39 moves, `:615-1176`) and `EDEF` (13 enemy types, `:1203-1800`) contain no functions or arrow expressions (0 matches for `=>` or `function` in those ranges); they hold numbers, strings and references to colour constants (`:325-335`).
- Tunable tables are plain data: `PURSUIT` (`:1801-1812`), `HOLD` (`:2719`), `WATER`, `BROOD`, `CLOUD`, `EEL`, `SIREN`, `GRAB` (`:1177-1202`), `STICKY` (`:4837`), `CAVEIN` (`:4884`), `MINE` (`:5048`), `RIFT` (`:5144`), `DROP` (`:5310`), `DRIP` (`:2210`), `CROC` (`src/06b_ebeh.js:605-641`), `SEWER` (`src/03c_sewer.js:3-92`).
- The simulation is 2D on the XZ plane with a flat floor: bodies are circles tested against a scalar field sampled on a one-unit grid — `src/03_world.js:16-130`; collision, sight, routes and the camera all read that one field — `CLAUDE.md` (World). There is no physics engine and no dependency.
- World generation outputs plain arrays: positions, colours, a material byte per vertex, lights, spawns, nodes and edges — `src/03_world.js:321-343`, `:995-1009`.
- Characters are built from boxes, cones, cylinders and spheres in code and posed procedurally from entity state — `src/05_figures.js`, `src/05b_dbodies.js`, `src/07_render.js:34-491`.
- All sound is synthesised in code — `src/04_audio.js`.
- The design is written down: `CLAUDE.md` (1,748 lines) and the specs in `docs/superpowers/specs/`.

Lines per file (`wc -l`):

| File | Lines | Subsystem |
|------|------:|-----------|
| `01_math.js` | 144 | maths, seeded random |
| `02_gl.js` | 648 | renderer |
| `03_world.js` | 1,009 | field, collision, routes, cave |
| `03b_hub.js` | 422 | hall |
| `03c_sewer.js` | 1,589 | sewer layout and water |
| `03d_sewerdress.js` | 620 | sewer decoration |
| `03e_sewerview.js` | 267 | sewer visibility pieces |
| `04_audio.js` | 314 | audio |
| `05_figures.js` | 539 | figures |
| `05b_dbodies.js` | 1,711 | D enemy bodies and poses |
| `06_game.js` | 5,718 | state, data tables, combat, AI |
| `06b_ebeh.js` | 1,742 | D enemy and crocodile behaviour |
| `07_render.js` | 1,386 | posing, lights, drawing |
| `07b_dfx.js` | 389 | D effects |
| `08_hud.js` | 505 | HUD |
| `08b_touchlayout.js` | 273 | touch layout |
| `08c_touch.js` | 605 | touch controller |
| `08d_pad.js` | 470 | gamepad |
| `09_main.js` | 763 | events, menus, camera, loop, test hook |
| **Total** | **19,114** | |

Also: `index.tpl.html` 1,440 lines (CSS, HUD and menu markup), tests 6,779 lines, `test.mjs` 120, `build.mjs` 26.

Lines per subsystem:

| Subsystem | Lines | Share |
|-----------|------:|------:|
| Game simulation (`06`, `06b`) | 7,460 | 39% |
| World generation (`03` to `03e`) | 3,907 | 20% |
| Figures and poses (`05`, `05b`) | 2,250 | 12% |
| Drawing and effects (`07`, `07b`) | 1,775 | 9% |
| Touch (`08b`, `08c`) | 878 | 5% |
| Main, menus, camera (`09`) | 763 | 4% |
| Renderer (`02`) | 648 | 3% |
| HUD (`08`) | 505 | 3% |
| Gamepad (`08d`) | 470 | 2% |
| Audio (`04`) | 314 | 2% |
| Maths (`01`) | 144 | 1% |

Inside `06_game.js`, by line range: state, bindings, options and save 1-336; `CLASSES` 338-613 (276); `MOVES` 615-1176 (562); tunables and `EDEF` 1177-1812 (636); player, enemy, zones, run and respawn 1817-2158 (342); effect helpers 2160-2265 (106); senses, kill, `hitEnemy`, `hurtPlayer`, hold and death 2267-2816 (550); lock, aim and move starts 2818-3049 (232); plaques and codes 3050-3207 (158); grapple, abilities and tools 3208-3486 (279); `playerUpdate` 3487-4176 (690); enemy movement and `enemyUpdate` 4179-4836 (658); bombs, cave-in and mines 4837-5143 (307); rifts and Drop 5144-5400 (257); clouds, shots, `separate` and `update` 5401-5718 (318). About 1,470 lines of the file are data tables.

Inside `06b_ebeh.js`: hook contract and helpers 1-135; rat, drowned, brood mother 136-212; bloater and eel 213-299; siren 300-448; grabber 449-530; crocodile 531-1742 (1,212).

### Inferences
- **Portable as data, any engine:** the class, move and enemy tables and every tunable table, about 1,500 to 1,700 lines, exported as JSON with one small script. Also the grade list, portal layout, plaque text and the written design. These hold the tuning work.
- **Portable as algorithm, to be translated line for line:** the seeded generator and noise; the room graph, marching squares and both world generators; the field functions (bilinear read, push-out, line of sight, A* routes, rock); the combat rules in `hitEnemy` and `hurtPlayer`; the player and enemy state machines; pursuit and search; the hook contract and each D type; the crocodile. This is about 9,800 lines of logic (simulation and world generation less the tables). It has no engine dependency, so it translates to C#, C++ or GDScript directly. In an engine it would probably keep its own kinematic movement on the field instead of adopting engine physics, at least at first, because the tests and tuning are built on it.
- **Rewritten or discarded in Unity, Unreal or Godot:** the WebGL renderer and its brick and water shader (648); primitive figures and procedural poses (2,250) if real models and animation clips are used, which then have to match the wind, act and recover timings in `MOVES` and `EDEF`; drawing and effects (1,775); HUD, menus and CSS (505 plus 1,440 of template); touch, gamepad and keyboard handling (1,348 plus most of `09_main.js`), replaced by the engine's input system; audio (314), replaced by assets; the test suite (6,779), rebuilt in the engine's test tools. The 9,800 lines of logic are rewritten in another language as well. In effect everything is rewritten and the data and design are what survive.
- **Reused in a web 3D engine (Three.js, Babylon.js, PlayCanvas):** files `01`, `03` to `03e`, `06` and `06b` stay as they are (11,511 lines, 60%); HUD, touch, pad and main (2,616) stay with small changes because they are DOM code; the renderer, figures and drawing (4,673 lines) are replaced. The generated world arrays can be handed to the new engine as a mesh.
- An engine's networking layer supplies transport, replication, remote calls and often lobbies, which covers steps 9 and 10 and part of 11 in section 10. It does not answer steps 3 to 8: who an enemy targets, how tokens, grabs, executions and the boss treat several players, and what death means in a party. Those decisions and their logic are owed in any engine.
- The single-file, no-install, plays-on-a-phone-from-a-link delivery is a property of the current build that a native engine gives up or has to re-create through a web export.

### Gaps
- No estimate was made of the art and animation cost of a move to models and clips; the repository has no assets to judge from.
- Whether an engine's web export would run acceptably on the phones in `tests/devices.mjs` is outside this audit.

## 12. Where `CLAUDE.md` and the code differ

### Takeaway
No claim in `CLAUDE.md` that was checked turned out wrong; two are looser than the code.

### Cited Findings
- "`G` is the single state object" is approximately true. State also lives in `cam`, the input tables, `OPT`, `UNLOCKED`, `CLEARED`, two module counters, the rock list inside the world's closure and flags on world objects — section 5, `src/06_game.js:53-68`, `:209`, `:226`, `:5165`, `:5195`, `src/03_world.js:248-250`.
- `README.md` says five classes; `CLASSES` has eight, three of them hidden — `README.md` ("What is in the game"), `src/06_game.js:338-613`. `CLAUDE.md` describes all eight.
- Confirmed as written: all files share one scope (`build.mjs:7-10`); no run-time network requests but fonts (`index.tpl.html:7-9`, zero network calls in `src/`); hit-stop and slow motion are applied by the frame loop (`src/09_main.js:344-351`); at most two attack tokens (`src/06_game.js:2268-2275`); `DF.sim` runs fixed 60 steps a second (`src/09_main.js:753-761`); cave 99 is 81,835 triangles (experiment: 245,505 vertices); input goes through `held` and `hit` (`src/06_game.js:153-163`); the saved key and its fields (`:244-258`).

### Inferences
- `CLAUDE.md` is reliable enough to serve as the design specification for a port.

### Gaps
- Only the claims relevant to multiplayer were checked; the touch, pad and sewer sections were not verified line by line.
