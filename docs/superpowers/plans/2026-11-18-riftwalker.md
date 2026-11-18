# The Riftwalker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Riftwalker, a hidden melee class that opens paired rifts the player, regular enemies and shots pass through, drops packs from the ceiling and is unlocked at the last sealed plaque.

**Architecture:** An end is an entry in `G.rifts`; a crossing is judged on a mover's path in the step and turns it to the other end. Bodies are checked once per `update` after they move (`riftBodies`); shots are checked inside `projUpdate` before their wall and hit checks (`riftShot`). Both call one transform, `riftMove`. Rifts never touch the walkable field, sight or routing. Drop and the execution use a new enemy state, `fall`, which `hitEnemy` and every targeting helper treat as out of the fight.

**Tech Stack:** Vanilla JS in the concatenated `src/*.js` scope, own WebGL renderer, headless Chromium tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-18-riftwalker-design.md`. Read it and `CLAUDE.md` before any task.

## Global Constraints

- Declare every name once across all of `src/`; `grep -n "name" src/*.js` before adding one. Checked free when this plan was written: `RIFT`, `MAGENTA`, `v1`, `v2`, `v3`, `vsnap`, `vstep`, `G.rifts`, `G.holes`, `openRift`, `riftMove`, `riftBodies`, `riftShot`, `riftsUpdate`, `startDrop`, `holesUpdate`, `dropEnemy`, `landEnemy`.
- `node build.mjs` after every source change. Tests run against `dist/index.html`.
- No dependencies, no assets, no textures.
- Rifts never change `fieldAt`, `resolve`, `los`, `route` or `ceilAt`. No reader of the field learns about rifts.
- The boss and the dummy never cross a rift and are never dropped. The boss's shots never cross.
- Nothing comes out of a rift with the field under it below its radius; every exit goes through `resolve`.
- No new touch or pad buttons, no change to `touchLayout`.
- A plain code never appears in a committed file, commit message, test or comment. Only the hash goes in `SHIPPED_CODES`; the plain code goes in the ignored `tests/codes.local.json` and to the owner in conversation.
- Nothing named or drawn after Valve's portal gun: no "portal gun", no blue and orange oval pair.
- Commit messages carry no `Co-Authored-By` or `Claude-Session` trailers.
- Test steps return `{ pass, ... }`; anything but `pass: true` fails the run.

## Review Focus

1. **A pair either side of the player in a tunnel, with a pack coming.** Expected: each enemy is carried once, walks back through as air during `RIFT.rest`, and reaches the player; no enemy is carried more than once in any 3 s. Test in Task 3.
2. **An end opened near a wall or Sapper rubble, and a body entering at the edge of the line.** Expected: it comes out with `fieldAt >= r - 0.05` after `resolve`, never in rock. Test in Task 3.
3. **A Drop or execution while the landing end closes mid-fall, or `resetRun`/`respawn` mid-fall.** Expected: the fall still lands at the spot chosen when it started; a reset puts every falling enemy down at its spot with `y = 0` and state no longer `fall`. Test in Task 4.
4. **A falling enemy targeted** by a lock, `aimYaw`, a melee arc, a shot, an `explode`, `nearestStaggered`, a token. Expected: none of them touch it; a lock on an enemy that starts to fall is dropped. Test in Task 4.
5. **A crossing during the player's `dodge`, `attack`, `blink`-like states, or while inspecting a plaque.** Expected: crossing works in every player state but `dead`, `execute` and `inspect` (in which the player does not move under their own control); the camera turns with them. Test in Task 3.

---

## File map

| File | Change |
| --- | --- |
| `src/06_game.js` | `MAGENTA`, `CLASSES.riftwalker`, `v1`-`v3`/`vsnap`/`vstep` moves with `reach`, `RIFT`, `G.rifts`, `openRift`, the `rift` tool, `riftMove`, `riftBodies`, `riftShot`, `riftsUpdate`, the trait in `hitEnemy`, `G.holes`, `startDrop`, `holesUpdate`, the `fall` state, `dropEnemy`, `landEnemy`, the `drop` ability, the Riftwalker execution, resets, `PLAQUE_TEXT`, `SHIPPED_CODES` |
| `src/03b_hub.js` | Riftwalker plaque gets `cls: "riftwalker"` |
| `src/05_figures.js` | Riftwalker branch of `makePlayerFig` |
| `src/07_render.js` | Riftwalker poses, ends, holes, the reach tear |
| `src/04_audio.js` | `SFX.tear`, `SFX.cross`, `SFX.shut`, `SFX.hole` |
| `src/09_main.js` | `DF` exports |
| `tests/t21.mjs` | New: ends, crossing, Drop (`smoke` mode) |
| `tests/t6.mjs` | Riftwalker fight, reach, shard, execution, hidden |
| `tests/t18.mjs` | Riftwalker plaque live; the sealed step makes its own sealed plaque |
| `tests/codes.local.json` | Riftwalker code (ignored by git) |
| `README.md`, `CLAUDE.md` | Test table, notes |

---

### Task 1: The Riftwalker and its blade

**Files:**
- Modify: `src/06_game.js` (colours at line 279, `CLASSES` after `sapper`, `MOVES` after `sdrop`, `startMove` at 2091, the melee hit loop near 2935), `src/05_figures.js`, `src/07_render.js`, `src/04_audio.js`, `src/09_main.js`
- Test: `tests/t6.mjs`

**Interfaces:**
- Produces: `MAGENTA = [0.95, 0.3, 0.75]`. `CLASSES.riftwalker`: `hidden: true`, `col: MAGENTA`, `chain: "v1"`, `heavy: "vsnap"`, `dash: "vstep"`, `tool: { id: "rift", name: "Rift", max: 4, ch: "◇" }`, `special: { id: "drop", name: "Drop", cost: 45 }`, `ranged` unset, numbers between the Assassin and the Fighter, `kit` lines as the spec's table. A move field `reach: true`: `startMove` aims it with `aimYaw(base, m.range + 0.5, 0.7)` instead of the default 4.8 m; the hit loop is unchanged (it already reads `m.range` and `m.arc`; give reach moves a narrow arc, about 0.6 rad, so a long cut does not sweep a crowd). Sight still has to be clear. `v1`, `v2`: reach cuts, `range` 5.0. `v3`: `proj: { speed 26, dmg ~18, post ~16, kind: "shard", life 0.9 }`. `vsnap`: reach 6.0, high `post`. `vstep`: `lunge` about 5, `ifr` about 0.3.

- [ ] **Step 1: Write the failing tests** in `tests/t6.mjs`, after the Sapper's steps, using the file's `cls`, `tp`, `K` helpers:
  - `{ name: "riftwalker", eval: fight("riftwalker", 4.2) }`, and add `"riftwalker"` to whatever list the file's summary reads, as the Sapper was added.
  - `"riftwalker cuts reach about 5 m"`: a brute 4.6 m away, idle, held (`e.state = 'idle'` each step); `K('light')`, `DF.sim(0.5)`; pass when the brute lost health and the player moved less than 1 m.
  - `"riftwalker's third cut throws a shard"`: three lights 0.3 s apart on a brute 9 m away; pass when some `G.projs` entry has `kind === 'shard'` and `own !== 'e'` during the sim.
  - `"riftwalker is hidden until unlocked"`: as the Sapper's step, with `riftwalker`.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: FAIL on the four new steps (`setClass` of an unknown class, or `CLASSES.riftwalker` undefined).

- [ ] **Step 3: Implement** the colour, class, moves and `reach` as in Interfaces; the figure branch in `makePlayerFig` (a long hooded coat with jagged seams in `MAGENTA`, a forearm device on the left, a short curved blade in the right hand, `f.rim`, `f.tips`); idle, guard and attack poses for any new `anim`; a small tear drawn beside the target for a `reach` hit (sprites and a ribbon, about 0.2 s); `SFX.tear`, `SFX.cross`, `SFX.shut`, `SFX.hole` in `04_audio.js` (used by later tasks).

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every step passes. Take a screenshot of the figure in the hall with a scratch script and look at it.

- [ ] **Step 5: Commit**

```bash
git add src tests/t6.mjs
git commit -m "feat: the Riftwalker and its blade"
```

---

### Task 2: Rift ends

**Files:**
- Modify: `src/06_game.js` (`RIFT` and the end functions near the Sapper's `MINE`; `useTool` at 2552; `update` at 4231; `resetRun` at 1417; `respawn` at 1516), `src/07_render.js`, `src/09_main.js`
- Test: `tests/t21.mjs` (new)

**Interfaces:**
- Produces: `RIFT = { half: 0.9, tall: 2.2, life: 20, near: 2, far: 8, apart: 3, room: 1.0, rest: 3, safe: 0.4, bonus: 0.5, bonusT: 2, cd: 0.25 }` (numbers may be tuned; names are fixed).
- `G.rifts`: at most two ends `{ x, z, yaw, t, life, id }`, oldest first. `yaw` faces the player at the moment it opened.
- `openRift(x, z, yaw) -> end | string`: the end, or a refusal reason (`"close"` within `RIFT.apart` of the other open end, `"room"` when the field is under `RIFT.room` at the centre or under 0.3 anywhere along the line). On success a third end shifts out the oldest.
- `riftPair(A) -> end | null`: the other end if two are open.
- The `rift` tool: aims along `cam.yaw`, steps out from `RIFT.near` to `RIFT.far` by 0.25 m keeping the furthest spot before the field drops under `RIFT.room` (the Sapper's cave-in aim is the pattern), calls `openRift(x, z, cam.yaw + PI)`. A refusal `say`s a short message ("No room for a rift", "Too close to the other rift") and returns `false`, spending no charge.
- `riftsUpdate(dt)`: ages ends and removes those past `life`.
- `resetRun` and `respawn` set `G.rifts = []`.
- `DF` exports `RIFT`, `openRift`.

- [ ] **Step 1: Write the failing tests** in a new `tests/t21.mjs`, header comment and run line as `t20`. Copy `t20`'s `game` helper as is, with `DF.setClass("riftwalker")`. Steps:
  - `"the tool opens an end ahead, facing the player"`: at a `tunnel()` point, `p.yaw = cam.yaw = t.yaw`, `K('tool')` once; pass when `G.rifts.length === 1`, its distance from the player is within `[RIFT.near, RIFT.far]`, `angDiff(end.yaw, cam.yaw + PI)` is under 0.05, and `p.tool` went down by one.
  - `"a third end replaces the oldest; ends close after their life"`: three `openRift` calls at points 4 m apart along the tunnel; pass when two remain and the first is gone; then `DF.sim(RIFT.life + 0.1)`; pass when none remain.
  - `"ends too close or with no room are refused for free"`: an end, then `K('tool')` aimed so the spot falls within `RIFT.apart` of it; then `openRift` at a point with `fieldAt < RIFT.room`; pass when the reasons are `"close"` and `"room"` and `p.tool` is unchanged.
  - `"a new run and a respawn clear the ends"`: open two, `DF.respawn()` (set a checkpoint first as `t20` does) then check; open two, `DF.newRun(99)`, check.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke`
Expected: FAIL, `DF.openRift is not a function` or `G.rifts` undefined.

- [ ] **Step 3: Implement** as in Interfaces, plus drawing in `07_render.js`: a jagged vertical tear per end (ribbons and sprites in `MAGENTA` round a dark centre, the second end a little paler), dimmer when unpaired, shrinking over its last second, a faint thread on the floor between a pair; `SFX.tear` on open, `SFX.shut` on close.

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke`
Expected: every step passes. Screenshot a pair in a tunnel and look at it.

- [ ] **Step 5: Commit**

```bash
git add src tests/t21.mjs
git commit -m "feat: the Riftwalker opens rift ends"
```

---

### Task 3: Passing through

**Files:**
- Modify: `src/06_game.js` (`update`, `projUpdate` at 4107, `hitEnemy` at 1765, `hurtPlayer` at 1893), `src/09_main.js`
- Test: `tests/t21.mjs`

**Interfaces:**
- Consumes: `G.rifts`, `riftPair`, `RIFT` from Task 2.
- Produces: `riftMove(o, ox, oz, r) -> boolean`. `o` has `x, z` and may have `vx, vz, yaw`. `(ox, oz)` is where it was at the start of the step. For each open end `A` with a pair `B`: let `n = (sin A.yaw, cos A.yaw)` and `u = (cos A.yaw, -sin A.yaw)` (along the line). The mover crossed `A` when the sign of `(pos - A)·n` differs between `(ox, oz)` and `(o.x, o.z)` and, at the crossing point, `|(q - A)·u| <= RIFT.half`. Then, with `a = B.yaw - A.yaw + PI`: the offset `q - A` turned by `a` is added to `B`; the direction of travel `d = pos - old` turned by `a` decides the exit side `s = sign(d'·nB)`; the mover is put at that point plus `nB * s * (r + 0.15)`; `vx, vz` and `yaw` (if present) turn by `a`; then `G.world.resolve(o, r)`. Returns `true` on a crossing (at most one per call).
  - In `(x, z)` with `yaw` meaning forward `(sin, cos)`, turning a vector `(x, z)` by angle `a` is `(x cos a + z sin a, -x sin a + z cos a)`. Turning `yaw` by `a` is `yaw + a`. Check this against the test, not by eye.
- `riftBodies(prev)`: called in `update` after `enemyUpdate` and before `projUpdate`; `prev` is `{ p: [x, z], e: Map(enemy -> [x, z]) }` taken at the top of `update` (after the transition check). For the player (not in `dead`, `execute` or `inspect`, `p.riftCD <= 0`): on a crossing turn `cam.yaw` by the same angle, set `cam.px`, `cam.pz` to the player, keep `p.lock`, set `p.iframe = max(p.iframe, RIFT.safe)`, `p.riftBonus = RIFT.bonusT`, `p.riftCD = RIFT.cd`, `SFX.cross()`, flash both ends. For each enemy not dead, not boss, not dummy, not in `fall`, with `(e.rest || 0) <= 0`: on a crossing set `e.route = null`, `e.rest = RIFT.rest`; its state is untouched. `e.rest` and `p.riftCD` count down in `riftsUpdate`.
- `riftShot(pr, ox, oz) -> void`: called in `projUpdate` right after a shot moves and before the `sticky` and wall checks. Skips shots whose `src` is a boss (`pr.src && pr.src.def && pr.src.def.boss`). On a crossing (`r = 0`, no `resolve`, but if the exit point has `fieldAt < 0.12` the shot ends there with sparks): an `own: "e"` shot becomes the player's as a parried one does (`own = "p"`, `c = MAGENTA`, `life = max(life, 1.2)`, keeping its `dmg` and giving it a `post` like the parry's).
- The trait in `hitEnemy`: when `G.player.riftBonus > 0` and the hit comes from the player (every `hitEnemy` call is the player's), `dmg *= 1 + RIFT.bonus` and `riftBonus = 0`. `riftBonus` counts down in `riftsUpdate`.

- [ ] **Step 1: Write the failing tests** in `tests/t21.mjs`. Helper in the step body: two ends opened with `openRift` at `at(t, -5)` and `at(t, 5)`, each with `yaw` facing the tunnel's middle, so `A` faces `+t.yaw` and `B` faces `-t.yaw`.
  - `"a body crossing either face comes out of the other, turned"`: a plain object `{ x, z, vx, vz, yaw }` stepped across `A` from its front with a lateral offset of 0.5; `riftMove` returns `true`, the object is on the side of `B` and moving the way the formula predicts (compare with numbers worked out in the step from `B.yaw`), its offset from `B` along `B`'s line is 0.5 in size, `fieldAt >= 0.55`. Repeat from `A`'s back.
  - `"the player crosses, the camera turns, the lock stays"`: lock an enemy, walk the player into `A` with `keys[BIND.fwd]` for up to 2 s; pass when the player ended near `B`, `angDiff(cam.yaw, yaw0 + a)` is under 0.05, `p.lock` is the same enemy, `p.iframe > 0` right after, and `p.riftBonus > 0`.
  - `"a pack is carried once, then comes on foot"`: player between `A` and `B` at the middle; a husk put 3 m beyond `A`'s front side, `aware`, `chase`; `DF.sim(4, ...)` counting crossings (watch `e.rest` jumping up); pass when it crossed exactly once in the first 3 s and came within 2 m of the player. A second husk put through `A` while the first is resting crosses too.
  - `"an enemy at the edge of the line comes out clear of rock"`: open `B` with its line ending 0.5 m from a wall (`openRift` succeeds only with room, so place it as close as it allows), push a husk through `A` at 0.85 m off-centre toward that side; pass when `fieldAt(e) >= e.r - 0.05`.
  - `"the boss and the dummy walk through the tear"`: the warden via `spawnAt`, moved across `A`'s line by hand; `riftBodies` leaves it on its side. Same for the dummy in `DF.enterHub()`.
  - `"a Spitter shot through a rift turns on a husk"`: a shot built with `DF.shoot(spitter, a, 13, 18)` aimed through `A`, a husk past `B` on the exit line; pass when the husk lost health, the shot's `own` became `"p"`, and the player's health is unchanged. Then a warden shot through `A`: pass when it kept `own === "e"` and was not moved.
  - `"the shard passes through"`: a `fire` of the shard spec through `A`; pass when it appears on `B`'s side.
  - `"the next hit after a crossing does more"`: `p.riftBonus = 2`, hit a held husk with `v1`; pass when the damage is about `1 + RIFT.bonus` times a plain `v1` hit and `p.riftBonus === 0` after.
  - `"unpaired ends do nothing"`: one end only; a husk walked through stays on its side.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke`
Expected: FAIL, `DF.riftMove is not a function`, and the crossing steps fail.

- [ ] **Step 3: Implement** `riftMove`, `riftBodies`, `riftShot`, the countdowns and the trait as in Interfaces. `DF` exports `riftMove`, `shoot`, `fire`.

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: every step passes in both.

- [ ] **Step 5: Commit**

```bash
git add src tests/t21.mjs
git commit -m "feat: bodies and shots pass through rifts"
```

---

### Task 4: Drop

**Files:**
- Modify: `src/06_game.js` (`useSpecial` at 2437, `enemyUpdate` at 3328, `hitEnemy`, `pickLock` at 2011, `aimYaw` at 2031, `aimRanged`, `nearestStaggered` at 1997, `explode` at 1586, `projUpdate`, `separate` at 4183, the player melee hit loop, `takeToken`, `resetRun`, `respawn`), `src/07_render.js`, `src/09_main.js`
- Test: `tests/t21.mjs`

**Interfaces:**
- Consumes: `G.rifts`, `riftPair` (Task 2), `stagger(e, k)` and `CAVEIN.stag` (the Sapper).
- Produces: `DROP = { fuse: 0.5, r: 2.2, g: 22, dmg: 4.5, impact: { r: 1.6, dmg: 14, post: 20 } }` (`dmg` is per metre fallen).
- `G.holes`: `{ x, z, t, lx, lz }`, where `(lx, lz)` is where its enemies land, fixed when the hole opens: the point under the end of an open pair that is further from the hole, otherwise the hole's centre.
- `startDrop(x, z) -> hole`. The `drop` ability aims as the Sapper's cave-in branch does (lock target in range, else `cam.yaw` 9 m, short of walls) and calls it.
- `holesUpdate(dt)`: after `DROP.fuse`, every enemy not dead, not boss, not dummy, not already in `fall`, whose body is within `DROP.r + e.r` of the hole's centre goes to `dropEnemy(e, lx, lz, i, n)`; then the hole is removed. Called in `update` after `riftsUpdate`.
- `dropEnemy(e, lx, lz, i, n, kill)`: picks the `i`th of `n` spots round `(lx, lz)` (ring of radius `0.9 * (n > 1)` plus `e.r`, each moved by `resolve` until the field there is at least `e.r`), sets `e.x, e.z` there, `e.y = G.world.ceilAt(x, z) - 0.6`, `e.vy = 0`, `e.fallH = e.y`, `e.state = "fall"`, `e.token = false`, `e.route = null`, drops `G.player.lock` if it is `e`. `kill` marks an execution fall.
- The `fall` case in `enemyUpdate`: `vy -= DROP.g * dt`, `y += vy * dt`; at `y <= 0` call `landEnemy(e)`.
- `landEnemy(e)`: `y = 0`; set the state to `idle` with `aware` as it was (then `alertE` if it was aware), `hitEnemy(e, DROP.dmg * e.fallH, 30, { heavy: true, src: "drop" })`; if still alive, `stagger(e, CAVEIN.stag[e.type] || 1)`; an `explode`-like hit of `DROP.impact` on other enemies within its radius that does not touch the player; `SFX.thud(true)`, dust sparks, shake. For an execution fall (Task 5) the body is already dead and only the landing blast runs.
- Out of the fight while `e.state === "fall"`: `hitEnemy` returns at once, `pickLock`, `aimYaw`, `aimRanged`, `nearestStaggered`, `explode`, the melee hit loop, the enemy loop in `projUpdate`, `separate` and `takeToken` all skip it; `riftBodies` skips it.
- `resetRun` and `respawn`: `G.holes = []`, and every enemy in `fall` is put down at its spot (`y = 0`, state `idle`) before the arrays are rebuilt.
- Drawing: a dark disc with a glowing rim for a hole over its fuse, a small tear in the ceiling over each landing spot as the fall starts.

- [ ] **Step 1: Write the failing tests** in `tests/t21.mjs`:
  - `"Drop over a pair lands the pack at the far end, staggered"`: a pair at `at(t, -5)`, `at(t, 5)`; a husk and a brute put round `at(t, -9)` (nearer `A`); `DF.startDrop(at(t,-9))`; `DF.sim(DROP.fuse + 0.05)`; pass when both are in `fall` near `B`; then sim until neither is in `fall` (at most 2 s); pass when both are within 3 m of `B`, both lost health, the husk's `dur` is 3.0 and the brute's 2.25 if alive, and the player's health is unchanged.
  - `"Drop with no pair lands them on the spot"`: no ends; pass when the husk lands within 2 m of the hole's centre.
  - `"falling enemies cannot be hit, locked or aimed at"`: during a fall, `DF.hitEnemy(e, 50, 50)` changes nothing, `DF.pickLock()` does not return it, an `explode` on it does nothing, a lock on it was dropped when the fall started.
  - `"the boss and the dummy stay"`: a hole under the warden, then under the dummy in the hall; pass when neither enters `fall`.
  - `"a reset mid-fall puts everyone down"`: start a fall, `DF.respawn()` with a checkpoint; pass when no enemy is in `fall` and `G.holes` is empty.
  - `"a landing on a pack hurts it"`: drop a husk onto a held husk at `B`; pass when the held one lost health.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke`
Expected: FAIL, `DF.startDrop is not a function`.

- [ ] **Step 3: Implement** as in Interfaces. `DF` exports `DROP`, `startDrop`, `hitEnemy`, `pickLock` (if not already), `explode`.

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t21.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: every step passes in all three. Screenshot a Drop mid-fall and look at it.

- [ ] **Step 5: Commit**

```bash
git add src tests/t21.mjs
git commit -m "feat: the Riftwalker drops a pack from the ceiling"
```

---

### Task 5: The execution

**Files:**
- Modify: `src/06_game.js` (the `execute` case of `playerUpdate` at 3038, the `dead` case of `enemyUpdate`)
- Test: `tests/t6.mjs`

**Interfaces:**
- Consumes: `dropEnemy`, `landEnemy` (Task 4), `riftPair` (Task 2).
- Produces: a `riftwalker` branch beside the Sapper's. A regular enemy is killed as today (`kill(e)`, so kill counts and drops run at once), then `dropEnemy(e, lx, lz, 0, 1, true)` with `(lx, lz)` chosen as Drop chooses for a hole at the enemy. The dead body falls in the `dead` case (the same `vy`/`y` update when `e.fallH` is set and `y > 0`), and on landing a `G.pending`-style blast of `{ r: 3.2, dmg: 45, post: 45 }` goes off where it lands. The boss takes the existing 120 in place with a tear effect; the dummy stands back up as today.

- [ ] **Step 1: Write the failing tests** in `tests/t6.mjs`:
  - `"riftwalker execution drops the body and the landing hurts the next one"`: a staggered husk next to the player, another husk 1.5 m from the landing spot (no pair, so the same spot), held idle; `K('light')`, `DF.sim(1.6)`; pass when the first is dead, it was above 1 m at some step, and the second lost health.
  - `"riftwalker execution on the boss and the dummy"`: the warden staggered loses about 120 and stays in place; in the hall the dummy is not dead and not moved.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: FAIL on both new steps.

- [ ] **Step 3: Implement** the branch as in Interfaces.

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every step passes.

- [ ] **Step 5: Commit**

```bash
git add src tests/t6.mjs
git commit -m "feat: the Riftwalker's execution"
```

---

### Task 6: The plaque takes a code

**Files:**
- Modify: `src/03b_hub.js` (`hubPlaques`, the `["riftwalker", null, -3]` row), `src/06_game.js` (`PLAQUE_TEXT.riftwalker`, `SHIPPED_CODES`)
- Test: `tests/t18.mjs`; local only: `tests/codes.local.json`

**Interfaces:**
- Produces: `PLAQUE_TEXT.riftwalker`, an epithet in the style of the other two. `SHIPPED_CODES.riftwalker = { hash, len }`.

- [ ] **Step 1: Write the failing tests** in `tests/t18.mjs`:
  - `"the Riftwalker plaque takes its code"`: as the Sapper's step, with `riftwalker`.
  - Change `"held keys, sealed and already open plaques take nothing"` so it seals a plaque itself: save `G.world.plaques[2].cls`, set it to `null` for the step, and restore it before returning.

- [ ] **Step 2: Run to verify the new step fails**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: FAIL on the Riftwalker step only.

- [ ] **Step 3: Implement.** Pick the code at random under the spec's rules (10 symbols, at least 5 different, no symbol three times running, no four-symbol opening or ending shared with either existing code). Compute its hash in node from `codeHash`'s own source, as for the Sapper. Put `{ hash, len }` in `SHIPPED_CODES`, the plain code in `tests/codes.local.json`, and run `SCRIPT=$PWD/tests/codes-print.mjs node test.mjs title` to refresh `tests/codes.local.md`. Write nothing of the plain code anywhere else.

- [ ] **Step 4: Run to verify it passes**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub && node tests/touch-all.mjs tests/t19.mjs hub`
Expected: every step passes, including "the real codes" with all three local codes, on every device.

- [ ] **Step 5: Leak check, then commit.** `git diff --cached` and `git log -p` searched for the plain code (in a way that does not print it) find nothing.

```bash
git add src tests/t18.mjs
git commit -m "feat: the Riftwalker plaque takes a code"
```

---

### Task 7: Docs and the full run

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Update `CLAUDE.md`**: "Where the project stands" (no plaque is sealed); a Riftwalker entry under "Hidden classes and codes" (ends, `riftMove` and its turn, `riftBodies` and `riftShot` and where they are called, the rest timer, shots changing owner and the boss's not, Drop and the `fall` state and every place that skips it, the execution, clean up); the dummy's list of places it is honoured (it never crosses or drops); the move recipe gains `reach`; testing notes for `t21`; Known problems (the Riftwalker is untested by hand); backlog item 8 (all three plaque classes are built).
- [ ] **Step 2: Update `README.md`**: a `t21` row in the test table.
- [ ] **Step 3: Full run**

Run each and read the result: `t21`, `t6`, `t20`, `t5`, `t10`, `t12` (smoke); `t8`, `t18` (hub); `t16` (smoke); `node tests/touch-all.mjs tests/t19.mjs hub`.
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: the Riftwalker"
```
