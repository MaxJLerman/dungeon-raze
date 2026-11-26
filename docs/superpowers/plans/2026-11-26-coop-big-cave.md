# A much bigger cave for two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cave that two co-op players enter is a 36-room cave on a 6 by 6 grid, cut into pieces so that no frame draws more than today's whole cave, with the cave one player gets unchanged for every seed.

**Architecture:** `genWorld` takes a second argument, `big`, and with it unset draws from its random stream exactly as today. The sewer's piece cutter becomes one shared routine, `cutPieces`, that the sewer calls with its own values (its hashes do not move) and the big cave calls with circles and winding tunnels. Each world carries its own cut distance, which `visiblePieces` reads. The co-op host and the page build the big cave exactly when a dungeon is built for two (`n === 2` in the world description), so no new field travels.

**Tech Stack:** Plain JavaScript in `src/` (one shared function scope), `node build.mjs`, Node tests (`tests/coop-*.mjs`), Playwright page tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-26-coop-big-cave-design.md`. Read it first. Then read `docs/notes/world.md`, `docs/notes/sewer.md` (the section on pieces), `docs/notes/rendering.md` and, from Task 4 on, `docs/notes/coop.md`.

## Global Constraints

- `node build.mjs` after every source change; tests run against `dist/index.html`.
- All `src/*.js` share one scope: declare a name once across `src/`. Nothing outside `src/dev/` names anything declared there.
- The host copy is the files matching `^0[1-6]`. It loads in Node and in a Worker and names nothing from `07` on. `cutPieces` stays in `03e` and touches `R` nowhere; only `visiblePieces` does, and the host never calls it. `node tests/t26-build.mjs` passes after every task.
- Every world generator returns the same shape. Seeded generators draw in a fixed order. With `big` unset `genWorld` consumes `Rn` exactly as today.
- `tests/t22.mjs` is the proof that nothing moved: its hashes of caves 1, 7 and 99 and of sewers 1, 5 and 9 (mesh, spawns, pieces) are not edited by any task.
- With `NET` and `DEV` null the game is the plain single-player game and never builds the big cave. Core does not read `NET` to decide: the caller passes `big`.
- `big` means something only for grade E. Any other grade ignores it.
- `COOP_TWO` is not changed. `COOP_V` goes from 2 to 3.
- The limit: no frame of the big cave draws more than 81,835 world triangles (the whole of cave 99).
- The Warden, its chamber and its fight are not changed. No new enemy type.
- Notes go in the same commit as the code they describe.
- Never read, print or copy any `tests/codes.local.*` file. Never write a plain plaque code anywhere.
- Commits: `feat:` / `test:` / `docs:` / `refactor:` prefixes, no `Co-Authored-By` or `Claude-Session` trailers, no em dashes and no ", and" in messages.
- A page test step fails the run when it returns an object whose `pass` is not `true`. Node tests print `ok` or `FAIL` lines and end `all passed`.
- Three failures are older than this work and are not this plan's to fix (`docs/notes/status.md`, backlog 11 and 12): `touch-all t14`, `touch-all t29 title` on four short phones, and the flaky `coop-host` check "nothing on the host hurts or moves a proxy".

## Measured in a throwaway trial (a guide, not a target)

The whole design was tried once in a scratch copy, since deleted. Numbers are from Node on this machine.

- Cut with the sewer's settings (`runs: 6`, `reach: 6`, `pad: 3`, `sample: 3`, `edge: 2`, cut distance 71.5 m): 174 to 210 pieces, the cut costs 320 to 400 ms, the whole build about 440 ms; without `sees` about 70 ms.
- The refactor into `cutPieces` left the sewer's piece hashes for seeds 1, 5 and 9 exactly as `t22` holds them.
- **Sight.** With `world.los` as the sight line, seed 13 had three views in which a walkable point 43 to 59 m away lay in a piece that was not drawn. Denser samples (`sample: 2`, `edge: 1`) cost four times the sight lines and did not cure it. What cured it: a sight line for `sees` that is clear wherever the field is at or above -0.5 (`world.los` wants 0.05), so walls count as half a metre thinner. With that, 24 seeds and about 50,000 views had no miss.
- **Triangles.** With that slack and no view test at all, the worst view listed pieces holding 63,428 triangles and the average was 28,900, against the limit of 81,835. The view test only lowers these.
- **The route.** With today's diagonals 57 of 200 seeds gave a route shorter than 10 rooms. Drawing the layout again from `rng(seed + k * 7919)` needed at most 6 draws over 200 seeds and gave routes of 10 (136 seeds), 11 (60) and 12 (4) rooms. With no diagonals a route is never shorter than 11.
- **Packs.** With the spec's table and index, every room at depth 1 held one of the two smallest packs and every room at the deepest depth held a two-brute pack, on all 200 seeds. The most common pack was in at most 42% of a cave's pack rooms (seed 7), and in more than a third on 8 of 200 seeds.
- **Enemies for two.** Seeds 1 to 20 and 99: 155 to 204, mean 178 (171 for seed 1, 164 for seed 7, 188 for seed 99).
- Crystals reached the doubled cap of 116 on every seed. Every seed had four rest points.

## Review Focus

1. **A player moved across the cave in one step** (a respawn at a rest point, a rift, a co-op arrival beside the host): the next frame draws the pieces where the player now stands, not where they were. (Task 3, t31.)
2. **The camera outside every piece**, pushed into rock or pulled back to 1.35 times its distance in the Warden's chamber: the frame still draws what the player's piece sees. (Task 3, t31.)
3. **A world description for two that a page builds small** (a tampered or mistaken `n`): the checksum differs and the page goes to the title with the cave line; it never plays a world the host does not have. (Task 4, t27.)
4. **A friend who joins a big cave already under way**, and one who arrives after a wipe: both get the big cave, the same checksum and the remade enemies. (Task 4, coop-host.)
5. **The minimap on the smallest phone:** 36 rooms on the iPhone SE's map must still show which room the player is in. (Task 3, a screenshot with `DEVICE=iphone-se`.)

---

### Task 0: Record the plan

- [ ] **Step 1: Commit this plan and the spec's amendments** (the pack share is "half", the first rooms hold "one of the two smallest packs", the measured enemy spread).

```bash
git add docs/superpowers/specs/2026-11-26-coop-big-cave-design.md docs/superpowers/plans/2026-11-26-coop-big-cave.md
git commit -m "docs: plan for the bigger co-op cave"
```

---

### Task 1: One shared cutter

A refactor. Nothing the player sees changes.

**Files:**
- Modify: `src/03e_sewerview.js` (`sewerPieces` becomes a caller of `cutPieces`; `visiblePieces` reads the world's cut distance)
- Modify: `src/03c_sewer.js`, `src/03_world.js`, `src/03b_hub.js` (each return gains `cut`)
- Modify: `tests/t22.mjs`
- Modify: `docs/notes/sewer.md`, `docs/notes/world.md`, `docs/notes/rendering.md` (where it names `visiblePieces`)

**Interfaces:**
- Produces: `cutPieces(o)`. `o` holds what `sewerPieces` takes today, `{ nodes, edges, F, W, H, minX, minZ, P, C, M, los }`, plus:
  - `roomBox(n)`: `[x0, z0, x1, z1]`, a box that holds room `n`;
  - `inRoom(n, x, z)`: a number, above 0 where the point is in room `n`;
  - `line(e)`: the tunnel's polyline, an array of `{ x, z }`;
  - `runs` (polyline segments to a piece), `reach` (how far from its polyline a tunnel's cells are looked for), `pad`, `sample`, `edge`, `cut` (metres), and `sees = true`.
  It returns `{ pieces, pieceGrid, pieceAt, pos, col, mat }` as `sewerPieces` does. `M` may be `null`, and then `mat` is `null`. With `sees: false` no sight line is cast and every piece's `sees` is `[]`.
- Produces: `sewerPieces(o)` keeps its name and arguments and calls `cutPieces` with the sewer's values: its rooms' boxes and `roomField` (the boss's circle), `[nodes[e.a], ...e.bends, nodes[e.b]]`, `SEWER.piece.runs`, `SEWER.tunR + 1`, `SEWER.piece.pad`, `.sample`, `.edge`, and `SEWER.piece.fog / ENV_SEWER.fogD`.
- Produces: every world has `cut`, a number of metres: the sewer's is `SEWER.piece.fog / ENV_SEWER.fogD`, and it is `0` in the cave and the hall, whose `pieces` are `null`. `visiblePieces` uses `w.cut` and names neither `SEWER` nor `ENV_SEWER`.

- [ ] **Step 1: Write the failing step in `tests/t22.mjs`,** beside "the cave and hall still draw whole": "a world carries its own cut distance": for `DF.genSewer(5)`, `w.cut === DF.SEWER.piece.fog / DF.ENV_SEWER.fogD`; for `DF.newRun(99)` and `DF.genHub()`, `cut === 0`; and with the sewer's `w.cut` set to 1, `DF.visiblePieces(w, w.spawn.x, w.spawn.z, w.spawn.x, w.spawn.z, false)` lists fewer pieces than it did before the change.
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t22.mjs node test.mjs smoke`. Expected: the new step FAILS (`w.cut` is undefined), every other step passes.
- [ ] **Step 3: Implement** as the Interfaces say. Move code; do not change the order in which cells, triangles or sight lines are visited.
- [ ] **Step 4: Run** `node build.mjs`, then t22, t23, t24 and t25 with `smoke`, and `node tests/t26-build.mjs`, `node tests/coop-host.mjs`. Expected: all pass, and in t22 "genSewer is unchanged by moving code" and "genWorld is unchanged by the refactor" pass with their `GOLD` values untouched.
- [ ] **Step 5: Notes.** `sewer.md`: what moved out of `sewerPieces` and what the sewer hands the cutter. `world.md`: `cutPieces`, its arguments, and `cut` in the world shape. **Commit:** `refactor: one piece cutter shared by every world`.

---

### Task 2: The big cave's layout

The big cave exists and plays, drawn whole. Task 3 cuts it into pieces.

**Files:**
- Modify: `src/03_world.js` (`genWorld`), `src/03b_hub.js`, `src/03c_sewer.js` (each returns `big: false`)
- Modify: `src/06_game.js` (`newRun`, `enterCave`), `src/09_main.js` (the `DF` list)
- Create: `tests/t31.mjs`
- Modify: `docs/notes/world.md`, `docs/notes/zones.md`, `CLAUDE.md` (a row in the table for the big cave: `world.md`, t31), `README.md` (a row in the test table)

**Interfaces:**
- Produces: `genWorld(seed, big = false)`. The world it returns has `big` (`true` or `false`). In this task the big cave still returns `pieces: null`, `pieceGrid: null`, `pieceAt: () => -1` and `cut: 0`.
- Produces: `bigCaveGraph(seed)` returns `{ Rn, nodes, edges, start, boss, path }`: the layout the big cave uses for that seed, with `linkGraph` applied, and the random stream to carry on with. `genWorld(seed, true)` builds from it. On `DF`.
- Produces: `newRun(seed, grade = "E", big = false)` hands the generator `big` only when `grade === "E"`. `enterCave(gradeId, seed, big = false)` passes it on; `seed` keeps its random default.

**The layout, exact:**
- `planGraph` with `GX: 6`, `GZ: 6` and every other option as today (`SP: 44`, `jit: 20`, `rMin: 8.5`, `rVar: 3.5`, `startR: 9.5`, `bossR: 16.5`, `diagP: 0.35`, `loopP: 0.5`, `loopDiagP: 0.6`).
- **The route.** Draw `k` (0, 1, 2 ...) plans the layout from `rng(seed + k * 7919)`. The first draw whose route (the `path` `linkGraph` returns) holds at least 10 rooms is the cave's. Draw 8 is made with `diagP: 0`, which cannot give fewer than 11 rooms, so it always ends. The stream that made the chosen layout is the one every later step draws from.
- **Rest points:** the start; then route rooms 4, 7, 10 ... (`path[3]`, `path[6]` ...) while the index is at most `path.length - 4`; then `path[path.length - 2]`. Built and marked exactly as today's shrines are.
- **Dressing:** the three counts and their try limits are doubled: 920 floor rocks in 18,000 tries, 1,040 stalactites in 18,000 tries, at most 116 crystals in 28,000 tries. The 12.5 m spacing between crystals and the red tint within 40 m of the boss stay.
- **Packs:** today's six, then `["brute", "brute", "spit", "husk", "husk"]` and `["brute", "brute", "spit", "spit", "husk", "husk"]`. `deepest` is the greatest `depth` among nodes whose `kind` is `"room"` once the rest rooms are marked. A room's index is `floor((depth - 1) / (deepest - 1) * 7)` (0 when `deepest` is 1) plus today's `(Rn() * 2) | 0`, clamped to the table. Tunnel posts and the Warden's spawn are as today.
- The order of the steps that draw from `Rn` is today's: layout, tunnels, dressing, crystals, packs, posts.

- [ ] **Step 1: Write `tests/t31.mjs`** (mode `smoke`; a `step(name, body)` helper as t22 has; the big cave through `DF.newRun(seed, "E", true)`):
  - "a plain run is the small cave": after `DF.newRun(99)` and after `DF.enterCave("E", 99)`: `G.world.big === false`, 16 nodes, 47 enemies.
  - "36 rooms, every one reachable": seeds 1, 7, 99: `big === true`, 36 nodes, every `depth >= 0`, the start is node 0 with `r === 9.5`, the boss node 35 with `r === 16.5`, and `w.route` from the spawn to the boss is not null.
  - "the route is at least 10 rooms": `DF.bigCaveGraph(s).path.length >= 10` for `s` from 1 to 200, and for seeds 1, 7, 99 it equals the built world's `path`.
  - "the same seed gives the same cave": two builds of seed 7 have equal `pos`, `spawns` and `path`.
  - "rest points are spread along the route": seeds 1 to 20: the route indices of `w.shrines` are exactly the rule's (compute them in the step), no two are next to each other, there are 4 for a route of 10 to 12 rooms, the first is lit, and no spawn has a rest room as its `node`.
  - "packs deepen with the cave": seeds 1 to 20: group spawns by `node` (`node >= 0`, not the Warden): every group in a room of `depth` 1 is `husk,husk` or `husk,husk,spit`; every group in a room at the deepest pack depth holds two brutes; no one pack is in more than half of the groups; there is one Warden, at the boss.
  - "tunnel guards stay out of the Warden's keep-out": seeds 1 to 20: no spawn with `node === -1` lies within `boss.r + DF.PURSUIT.bossPad` of the boss (add `PURSUIT` to `DF` if it is not there).
  - "as lit as the small cave": seeds 1, 7, 99: 100 to 116 lights, no two within 12.5 m, every light within 40 m of the boss is `DF.CRY.red` (add `CRY` to `DF` if needed).
  - "big is for grade E only": `DF.newRun(5, "D", true)`: `G.world.sewer` is true and `G.world.big` is not.
  - Screenshots, to look at: the start (`t31-start`), a room on the route (`t31-room`), halfway along a tunnel looking down it (`t31-tunnel`), the Warden's chamber from its entrance (`t31-boss`). Use t22's `look` helper.
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t31.mjs node test.mjs smoke`. Expected: FAIL (`DF.bigCaveGraph` is not a function; `big` is undefined).
- [ ] **Step 3: Implement** as the Interfaces and the layout say. How `genWorld` is arranged inside is yours; every branch on `big` must leave the other side drawing from `Rn` as before.
- [ ] **Step 4: Run** `node build.mjs`, then t31, t22, t5, t12 and t20 with `smoke`, t8 with `hub`, and `node tests/t26-build.mjs`, `node tests/coop-host.mjs`, `node tests/coop-caves.mjs`. Expected: all pass with t22's hashes untouched. Look at the four `shots/t31-*.png`: the big cave must look like `shots/t22-cave99.png`'s cave.
- [ ] **Step 5: Notes and tables.** `world.md`: a section on the big cave (when it is built is Task 4's to write; here: what differs, the redraw rule and why draw 8 ends it, the rest rule, the pack index, `bigCaveGraph`). `zones.md`: `newRun` and `enterCave`'s third argument. The rows in `CLAUDE.md` and `README.md`. **Commit:** `feat: a 36-room cave from genWorld`.

---

### Task 3: The big cave in pieces

**Files:**
- Modify: `src/03_world.js`, `src/08_hud.js` (only if Step 5 says so)
- Modify: `tests/t31.mjs`
- Modify: `docs/notes/world.md`, `docs/notes/rendering.md`

**Interfaces:**
- Consumes: `cutPieces(o)` (Task 1), `genWorld(seed, true)` (Task 2).
- Produces: `CAVE_PIECE = { runs: 6, reach: 6, pad: 3, sample: 3, edge: 2, slack: 0.5 }` in `03_world.js`.
- Produces: the big cave returns the cutter's `pieces`, `pieceGrid`, `pieceAt`, `pos` and `col` (`mat` stays `null`), and `cut: SEWER.piece.fog / ENV_CAVE.fogD` (71.5 m). It hands the cutter: each room's circle (`n.r - Math.hypot(x - n.x, z - n.z)` and the box round it), `e.pts` as the tunnel's line, the `CAVE_PIECE` values, and as `los` a sight line that marches as `world.los` does (0.8 m steps) and is blocked where `fieldAt` is below `-CAVE_PIECE.slack`. `world.los` itself is not changed.
- Produces: `sees: !COOP_HEADLESS_HERE`. The host copy never draws, so it skips the sight lines: its build of the big cave is about 70 ms, and it builds before the page does. `world.pos` is the same either way, so the checksum agrees.

- [ ] **Step 1: Write the failing steps in `tests/t31.mjs`:**
  - "the big cave is in pieces and the small cave is not": seed 99 big: `pieces.length` between 150 and 230, every triangle is in exactly one piece (the `count`s sum to `pos.length / 3` and the ranges do not overlap), `cut` within 0.01 of 71.53; `DF.newRun(99)`: `pieces === null`, `cut === 0`, `DF.visiblePieces(G.world, 0, 0, 0, 0) === null`.
  - "everything the camera can see is in a drawn piece": t22's step of that name, for the big cave, on seeds 1, 5, 7, 13, 42 and 99 (13 is the seed that fails without the slack): the same `camAt`, every 2 m of the route at four headings, five spots in every room at eight (the centre and 0.6 of `n.r` to each side), every third point of every tunnel at four, the camera also at 1.35 times its distance within `boss.r + 4` of the boss. `cut` is `w.cut`. `miss === 0` and `views > 4000`.
  - "no view lists more than the whole of cave 99": in the same loop, the triangles of the pieces `DF.visiblePieces(w, cx, cz, x, z, false)` lists never sum to more than `cap` (cave 99's `pos.length / 9`, read in the step). Return the most and the average.
  - "the big cave draws no more in a frame than the whole of cave 99": t22's frame step, for big seeds 1, 7 and 99: 20 points along the route, two frames each, `DF.R.stats.tris` at most `cap` and above 0.
  - "a player moved across the cave is drawn where they stand" (Review Focus 1): seed 99 big, the player at the start; draw two frames; set the player and `cam.px`, `cam.pz` to the room before the boss; draw two frames: `DF.R.stats.tris > 0`, and `DF.visiblePieces` for the new spot holds `w.pieceAt` of the player and does not hold the start's piece.
  - "the camera outside every piece still draws the player's pieces" (Review Focus 2): `DF.visiblePieces(w, w.minX - 50, w.minZ - 50, w.spawn.x, w.spawn.z)` is a non-empty array; and with the player at the Warden's centre and the camera 22 m behind at each of eight headings, the list holds the boss room's piece.
  - "the big cave builds in under 2 seconds": time `DF.newRun(11, "E", true)`; return the milliseconds. The aim is under 800.
  - "the big cave is unchanged": a `GOLD` for big seeds 1, 7 and 99 of `[h(pos), h(col), path.join(","), hs(JSON.stringify(spawns)), hs(JSON.stringify(pieces)) ^ h(pieceGrid)]`, with `h` and `hs` as t22 defines them. Leave `GOLD` empty until Step 4.
  - Screenshots: the minimap with every room and tunnel seen, at its own size (`t31-map`) and blown up as t22 does (`t31-map-big`); a view down the longest clear sight line the step can find from a room's edge across the room into a tunnel (`t31-far`); the three views of a tunnel bend that t22 takes for the sewer (`t31-bend-1` to `-3`).
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t31.mjs node test.mjs smoke`. Expected: the new steps FAIL (`pieces` is null).
- [ ] **Step 3: Implement** as the Interfaces say.
- [ ] **Step 4: Run t31, put the hashes it returns into `GOLD`, run it again.** Expected: all pass twice running. If the sight step or either triangle step fails, the levers are, in this order: shorter stretches (`runs`), more slack (up to 1), denser samples. A shorter cut distance is allowed only if `t31-far` shows nothing appearing at the cut, and is recorded in `world.md`. The extra ring of neighbours in `cutPieces` is not to be removed. Thicker fog is not yours to choose: stop and report.
- [ ] **Step 5: Look at every `shots/t31-*.png`,** and run `DEVICE=iphone-se SCRIPT=$PWD/tests/t31.mjs node test.mjs smoke` for `shots/iphone-se-t31-map.png` (Review Focus 5). No wall, floor or ceiling may be missing in `t31-far` or the bends. If the rooms or the player's mark on either map cannot be told apart, widen the map's lines for a world this wide in `08_hud.js` and nothing else, and say so in the report; if they can, leave `08_hud.js` alone.
- [ ] **Step 6: Run** t22, t9, t11, t12 and t20 with `smoke`, `node tests/t26-build.mjs`, `node tests/coop-host.mjs`. Expected: all pass, t22's hashes untouched.
- [ ] **Step 7: Notes.** `world.md`: `CAVE_PIECE`, why the slack is there (seed 13, and that denser samples did not cure it), the measured pieces, triangles and build time, that the host skips `sees`. `rendering.md`: the big cave is drawn by pieces, the small cave and hall whole. **Commit:** `feat: the big cave is drawn in pieces`.

---

### Task 4: A cave entered by two is the big cave

**Files:**
- Modify: `src/06d_coophost.js` (`build`), `src/07c_coopclient.js` (`coopBuild`), `src/06c_coopwire.js` (`COOP_V`, `coopExtras`)
- Modify: `tests/coop-host.mjs`, `tests/coop-wire.mjs`, `tests/coop-caves.mjs`, `tests/t27.mjs`, `tests/t28.mjs`, `tests/coop-e2e.mjs`
- Modify: `docs/notes/coop.md`, `docs/notes/world.md` (when the big cave is built), `README.md` (the co-op paragraph)

**Interfaces:**
- Consumes: `newRun(seed, grade, big)`, `enterCave(gradeId, seed, big)`, `world.big`.
- Produces, host: `build` settles `n` (2 for a cave when `two` is set or two players are in the room, else 1) before it builds, and builds with `newRun(seed, grade, n === 2)`. So `S.n === 2` and the big cave go together for grade E, and a sewer started for two in a test is the sewer with `n` 2.
- Produces, client: `coopBuild(d)` builds a cave with `enterCave(d.grade, d.seed, d.n === 2)`.
- Produces, wire: `COOP_V = 3`. `coopExtras`: a group is deep when it holds two or more brutes (today: when it is exactly `brute, brute, spit`).

- [ ] **Step 1: Write the failing checks in `tests/coop-host.mjs`:**
  - "a cave built for two is the big cave": a hall with two clients, travel to 99: the `world` event has `n === 2`, `h.G.world.big === true`, 36 nodes. `h.start({ seed: 99, grade: "E" })`: not big, 47 enemies, the `sum` `cave()` has today. `h.start({ seed: 5, grade: "D", two: true })`: `h.G.world.sewer`, not big, `h.S.n === 2`.
  - "a friend who joins a cave for one gets the small cave": hall with one client, travel 99, a second joins: its join has `n === 1`, the small cave's `sum`, 47 enemies.
  - "it stays big" : built for two; the friend leaves: `big` and the `sum` are unchanged. Both dead (a wipe): after the reset the world is the same object or has the same `sum`, `big` is true and the enemy count is what it was.
  - "a friend who joins the big cave under way" (Review Focus 4): built for two, the friend leaves and joins again: its join has `n === 2`, the big cave's `sum` and the full enemy list; with an enemy killed and then a wipe before it answers `at`, its arrival brings a `reset` and every enemy alive.
  - "extras in the big cave": seed 99 for two: the spawns after the Warden's are the extras; a room whose own pack holds two or more brutes has 2, any other pack room 1; none has `node === -1`.
  - "the enemy count for two": seeds 1 to 20 and 99 through `h.start({ seed, grade: "E", two: true })`: every count from 140 to 215. Print the least, the mean and the most.
  - "the host builds the big cave quickly": one such start takes under 1 second (the host skips `sees`; about 70 ms measured).
  - "a minute in the big cave": seed 99 for two, one client standing at the start and one in the room at `path[5]`, 60 seconds of host steps as the file's runner drives them: the mean cost of a step is under 4 ms. Print it.
- [ ] **Step 2: Run** `node build.mjs && node tests/coop-host.mjs`. Expected: the new checks FAIL (`big` is false for two).
- [ ] **Step 3: Implement** as the Interfaces say.
- [ ] **Step 4: Bring the existing two-player checks across.** Every check in `tests/coop-host.mjs` that builds for two now runs in the big cave. Where one names an enemy by number or a place by coordinates that belonged to small cave 99, find the same thing by what it is (the first husk of a room pack, the room before the boss, the Warden) and keep what it asserts. Do not weaken an assertion to make it pass; if one cannot hold in the big cave, stop and report it. Leave the flaky check named in Global Constraints as it is.
- [ ] **Step 5: `tests/coop-wire.mjs`:** the join of cave 99 for two now carries the big cave's enemies (replace 62 with the count the host has); it and the join of the seed with the most enemies among 1 to 20 each encode to fewer than 16,384 bytes. Print the larger size.
- [ ] **Step 6: `tests/coop-caves.mjs`:** also build seeds 1 to 10 for two (`start({ seed, grade: "E", two: true })`) in Node and in each engine and compare the sums, reported as the small caves are. If an engine differs, stop and report before changing the generator.
- [ ] **Step 7: Page steps.** `tests/t27.mjs`, "puppets are built to match" (`coopSolo({ seed: 99, two: true })`): also `G.world.big === true`, 36 nodes, `DF.coopWorldSum(G.world)` equals the join's `sum`; after `DF.coopEnd("left")` and `DF.newRun(99)`: not big, 47 enemies. A new step, "a cave for two built small is refused" (Review Focus 3): tamper the `world` event for two so that `n` is 1: the page is on the title showing `COOP_SAY.cave` and `DF.net() === null`. `tests/t28.mjs`, the trip by two: the page lands in a cave with `G.world.big`, `pieces` set and the host's sum. Replace any count that named small cave 99 for two with the big cave's.
- [ ] **Step 8: `tests/coop-e2e.mjs`:** where two pages entered cave 99 and counted 62 enemies, both now count what the host lists for the big cave (assert the two pages agree with each other and with a number you measure and write in), and both have `G.world.big` and equal sums. The Warden's kill by hits of 160 keeps its number unless the run shows otherwise: its health is unchanged.
- [ ] **Step 9: Run** `node build.mjs`, then `node tests/coop-host.mjs`, `node tests/coop-wire.mjs`, `node tests/coop-caves.mjs`, `node tests/t26-build.mjs`, t27, t28, t31 and t22 with `smoke`, `SCRIPT=$PWD/tests/t29.mjs node test.mjs title`, `node tests/coop-e2e.mjs`. Expected: all pass. Afterwards `lsof -i :8787` and `lsof -i :8123` show nothing.
- [ ] **Step 10: Notes.** `coop.md`: in "A dungeon for two", that it is the big cave, how host and page each decide (`n`), that the host skips `sees`, `COOP_V` 3, the new rule for a deep pack, the measured enemy spread, join size and step cost, and under Known problems that the run's length for two is untested by hand. `world.md`: when the big cave is built. `README.md`: the co-op paragraph. **Commit:** `feat: a co-op cave entered by two is the big cave`.

---

### Task 5: Walking the big cave alone in the dev build

**Files:**
- Modify: `src/dev/10_dev.js`
- Modify: `tests/t26.mjs`, `tests/t26-build.mjs`
- Modify: `docs/notes/dev-menu.md`

**Interfaces:**
- Produces: `devBigCave(seed)` in `src/dev/10_dev.js`: `enterCave("E", seed, true)`, then what `devGate` does after its own (`DEV.run`, `play()`). On `DF`. One button, "Big cave (co-op size)", in the dev menu's "Enter a gate" row.

- [ ] **Step 1: Write the failing steps.** `tests/t26.mjs` (mode `hub`): `DF.devBigCave(99)`: `G.zone === "cave"`, `G.world.big`, 36 nodes, `DF.net() === null`, `G.state === "play"`; the button exists in the dev screen and its click does the same; a Return to base and a walk through gate E afterwards gives the small cave. `tests/t26-build.mjs`: the release build holds neither `devBigCave` nor the button's label.
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t26.mjs node test.mjs hub`. Expected: FAIL (`DF.devBigCave` is not a function).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** t26 with `hub`, `node tests/t26-build.mjs`. Expected: both pass.
- [ ] **Step 5: `dev-menu.md`. Commit:** `feat: the dev menu enters the big cave alone`.

---

### Task 6: Sweep and status

**Files:**
- Modify: `CLAUDE.md` ("Where the project stands": a cave entered by two is the 36-room cave), `docs/notes/status.md` (this branch's record; backlog 9 done; the Warden for two is next), `README.md` if the test table or the co-op text is behind. `TODO` is the owner's file and is left alone.

- [ ] **Step 1: Run every script in `CLAUDE.md`'s table once more** on the final build, plus `DEVICE=iphone-se SCRIPT=$PWD/tests/t30.mjs node test.mjs title`. Expected: all pass but the three failures named in Global Constraints. Report any other failure with its output; do not edit a solo test to make it pass.
- [ ] **Step 2: Look at** `shots/t31-*.png`, `shots/t22-cave99.png` (the small cave, unchanged) and `shots/t28-*.png`.
- [ ] **Step 3: Update the files.** In `status.md` write the measured numbers: pieces, build time in Node and in the page, the worst view's triangles, the enemy spread for two, and that it runs above the 150 to 190 first expected. **Commit:** `docs: record the bigger co-op cave`.
