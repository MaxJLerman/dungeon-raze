# Enemy Pursuit, Sight and Pathfinding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regular enemies chase only what they can see, search where they last saw the player, give up at a leash from their post or when the player enters the boss chamber, and walk home along a real route.

**Architecture:** `fieldFns` gains `route`, a grid search over the same field that drives collision, so the cave and the hall both get it. `enemyUpdate` gains sight memory, a `search` state and one `giveUp` path, with every tunable in a `PURSUIT` table. The boss keeps its own limits and only gains routing round rock.

**Tech Stack:** Plain JavaScript (ES2020), WebGL 2, Playwright with headless Chromium for tests.

**Spec:** `docs/superpowers/specs/2026-11-16-enemy-pursuit-design.md`. Read it and `CLAUDE.md` before starting.

## Global Constraints

- All `src/*.js` files share one function scope. No imports or exports. Declare each name once across `src/`.
- No dependencies and nothing loaded at run time.
- Run `node build.mjs` after every source change. `dist/` is not committed.
- `genHub()` must return every field `genWorld()` returns.
- `world.path` is the list of chamber ids from the start to the boss and stays as it is. The new function is `world.route`.
- The `dummy` flag keeps its early return at the top of `enemyUpdate`.
- `aware` keeps meaning "this enemy is hunting the player": true in `chase` and `search`, false in `idle` and `return`.
- Starting numbers, exactly: `seeMul` 1.5, `lostT` 0.35 s, guess 8 m and 2.5 s, `look` 2.5 s, `leash` 32 m, `edge` 4 m, `provoke` 4 s, `bossPad` 3 m.
- The boss's 38 m and 30 m limits and its heal on return do not change.
- Regular enemies keep their damage when they give up.
- How an idle enemy first notices the player does not change, except inside the boss chamber rule.
- Existing scripts `tests/t1.mjs` to `tests/t11.mjs` are not edited. `t5`, `t6`, `t8` and `t10` must still pass.
- Commits follow `CLAUDE.md`: no `Co-Authored-By` or session trailers.

## Review Focus

Conditions the spec implies but its own test list does not exercise. Each is pinned by a test in the task named.

1. **A route that cannot exist.** A goal off the map, inside rock, or a `NaN` coordinate must return `null` quickly, and an enemy given `null` must still move. Task 1, step "no route is null"; Task 2, step "an unreachable post does not freeze the walk".
2. **A whole pack losing sight on the same step.** Every member must still end at its post and no single `update` may hitch. Task 3, step "a pack loses sight together".
3. **A shot from hiding.** An enemy that is searching and is hit from out of view must head for where the shot came from, not carry on with its old search. Task 3, step "a hit redirects the search".
4. **The player dying mid-hunt.** Chasing and searching enemies must go home. Task 3, step "the player dying sends hunters home".
5. **Leaving the cave mid-hunt.** Returning to the hall while enemies hold routes and the player stands in the boss chamber must leave no state behind. Task 5, step "leaving for the hall clears the chamber flag".

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/03_world.js` | Modify | `route` in `fieldFns`, returned by `genWorld`; tunnel posts kept out of the boss chamber |
| `src/03b_hub.js` | Modify | `route` returned by `genHub` |
| `src/06_game.js` | Modify | `PURSUIT`, enemy fields, route following, sight memory, `search`, `giveUp`, leash, provoke, boss chamber flag |
| `src/09_main.js` | Modify | `PURSUIT`, `alertE` on `DF` |
| `index.tpl.html` | Modify | One How to play tip |
| `tests/t12.mjs` | Create | All tests for this plan |
| `README.md`, `CLAUDE.md` | Modify | Behaviour, `world.route`, `search` state, test table, known problems |

## Test conventions

`tests/t12.mjs` runs in `smoke` mode: `SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`. Every step returns `{ pass, ... }` with the checked values included so a failure is readable. Build every step with this helper:

```js
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; DF.newRun(99); DF.show("play");
  const w = G.world, p = G.player, P = DF.PURSUIT || {}, D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const put = (o, x, z) => { o.x = x; o.z = z; };
  // e stands at (x, z) and that spot is also its post
  const post = (e, x, z) => { put(e, x, z); e.hx = x; e.hz = z; };
  const only = (...es) => { G.enemies = es; };
  const hunt = (e) => { e.aware = true; e.state = "chase"; };
  const home = (e) => e.state === "idle" && !e.aware && Math.hypot(e.x - e.hx, e.z - e.hz) < 0.6;
  const safe = () => { p.hp = p.maxHp; if (p.state === "dead") p.state = "free"; };
  // every sim step keeps the player alive unless the body says otherwise
  const sim = (sec, each) => DF.sim(sec, (i) => { safe(); return each ? each(i) : undefined; });
  const rooms = w.nodes.filter((n) => n.kind === "room");
  // two joined rooms whose centres are at least min apart with no line of sight
  const pair = (min) => { for (const a of rooms) for (const j of a.adj) { const b = w.nodes[j]; if (b.kind === "room" && D(a, b) >= min && !w.los(a.x, a.z, b.x, b.z)) return [a, b]; } return null; };
  const type = (t) => G.enemies.find((q) => q.type === t);
  ${body} })()`,
});
```

If seed 99 has no `pair` for a step, change the seed inside that step and say so in a comment. A step that cannot build its scene returns `pass: false` with `pre: false`, never a silent pass.

"Hunting" below means `e.aware` is true and `e.state` is none of `idle`, `return`, `dead`.

---

### Task 1: `world.route`

**Files:**
- Create: `tests/t12.mjs`
- Modify: `src/03_world.js` (`fieldFns`, the object `genWorld` returns), `src/03b_hub.js` (the `fieldFns` destructure and the object `genHub` returns)

**Interfaces:**
- Produces: `world.route(ax, az, bx, bz, rad)` returning `Array<{ x, z }> | null`. The list is the points to walk to in order. It does not include the start. Its last entry is `(bx, bz)` when `fieldAt(bx, bz) >= rad`, otherwise the usable grid point nearest the goal.

- [ ] **Step 1: Branch and commit the design and plan**

```bash
git checkout -b feat/enemy-pursuit
git add docs/superpowers/specs/2026-11-16-enemy-pursuit-design.md docs/superpowers/plans/2026-11-16-enemy-pursuit.md
git commit -m "docs: design and plan for enemy pursuit"
```

- [ ] **Step 2: Write the failing tests in `tests/t12.mjs`**

`clear(R, from, rad)` is a local helper in these steps: walk the legs of `[from, ...R]`, sample every 0.5 m, return the lowest `w.fieldAt` seen.

| Step name | Setup | Passes when |
| --- | --- | --- |
| route exists | none | `typeof w.route === "function"`; `typeof DF.genHub().route === "function"`; `Array.isArray(w.path)` still true |
| start to boss on ten seeds | for `s` 1 to 10: `DF.newRun(s * 7919)`, time `G.world.route(spawn.x, spawn.z, boss.x, boss.z, 0.6)` | every route is non-null, ends within 0.01 of the boss centre, `clear(R, spawn, 0.6) >= 0.6`, and the slowest call is under 30 ms |
| every post is reachable at its own size | same ten seeds; for each spawn `sp`, `route(spawn.x, spawn.z, sp.x, sp.z, DF.EDEF[sp.type].r)` | none is null and each keeps `clear >= EDEF[sp.type].r` |
| a route is direct in the open | `n = rooms[0]`; `route(n.x - 3, n.z, n.x + 3, n.z, 0.5)` | exactly one waypoint, at `(n.x + 3, n.z)` |
| a wide body avoids a narrow gap | none | for some pair of rooms, `route(..., 0.5)` and `route(..., 1.35)` are both non-null and the second keeps `clear >= 1.35` |
| no route is null | goals `(w.minX - 50, w.minZ - 50)`, `(NaN, 0)`, and a point where `w.fieldAt < -1`, all from the spawn | first two return `null`; the third returns a route ending at a point with `fieldAt >= 0.6`; no call throws; each takes under 30 ms |
| the hall routes round a pillar | `h = DF.genHub()`; `h.route(-12, -12, -12, -6, 0.5)` (a pillar stands at `(-12, -9)`) | non-null, more than one waypoint, `clear >= 0.5` using `h.fieldAt` |

- [ ] **Step 3: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: every step prints `FAIL`, most with `threw` because `w.route` does not exist, and the last line is `7 failed`. `DF.PURSUIT` arrives in Task 2, which is why the helper reads `DF.PURSUIT || {}`.

- [ ] **Step 4: Implement `route(ax, az, bx, bz, rad)` in `fieldFns`**

- A* over the grid points of `F`, eight directions, step costs 1 and √2, octile distance as the estimate.
- A grid point is usable when `F[k] >= rad + 0.25`.
- A diagonal step is allowed only when both grid points it passes between are usable.
- Each end snaps to the nearest usable grid point within 4 cells. No such point, or a non-finite input, returns `null`.
- More than 60000 points taken off the open list returns `null`.
- Thinning: drop a waypoint when the straight line between its neighbours keeps `fieldAt >= rad + 0.1` sampled every 0.5 m. The first neighbour for this purpose is `(ax, az)`.
- Search buffers are allocated once per `fieldFns` call and reused, so a search does not allocate in proportion to the grid.

Return it beside `fieldAt`, `resolve` and `los`, and add `route` to the objects returned by `genWorld` and `genHub`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: `all passed`.
Run: `SCRIPT=$PWD/tests/t5.mjs node test.mjs smoke` and `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`
Expected: `all passed` for both, with `nbad: 0` from `t5`.

- [ ] **Step 6: Commit**

```bash
git add src/03_world.js src/03b_hub.js tests/t12.mjs
git commit -m "feat: world.route finds a walkable route on the collision grid"
```

---

### Task 2: Following a route, going home, the boss round rock

**Files:**
- Modify: `src/06_game.js` (new `PURSUIT` next to `EDEF`, `makeEnemy`, `update`, `resetRun`, `enemyUpdate`: the 75 m skip, `return`, the boss part of `chase`), `src/09_main.js` (`window.DF`), `tests/t12.mjs`

**Interfaces:**
- Consumes: `world.route` from Task 1.
- Produces: `const PURSUIT = { seeMul: 1.5, lostT: 0.35, guessDist: 8, guessT: 2.5, look: 2.5, leash: 32, edge: 4, provoke: 4, bossPad: 3 }`, exposed as `DF.PURSUIT`.
- Produces: enemy fields `route` (`Array<{ x, z }> | null`), `ri` (index of the next waypoint), `fails` (routes abandoned since the state began).
- Produces: `setRoute(e, x, z)` returning `boolean`. It asks `world.route` at `e.r` and stores the result in `e.route` with `e.ri = 0`. When `world.route` returns `null` it stores `[{ x, z }]`, which is today's straight walk. It returns `false` and leaves `e.route` alone when two routes have already been found in this `update`; the caller tries again next step. The count is `G.routeN`, zeroed at the top of `update` and in `resetRun`.
- Produces: `walkRoute(e, spd, dt)` returning `boolean`, true once the last waypoint is within 0.6 m. Otherwise it turns toward waypoint `e.ri` at `e.def.turn`, steps with `eStep`, and moves to the next waypoint within 0.6 m. When the distance to the current waypoint has not fallen by 0.2 m in 1.5 s it sets `e.route = null` and adds 1 to `e.fails`.

- [ ] **Step 1: Write the failing tests**

| Step name | Setup | Passes when |
| --- | --- | --- |
| a returning enemy rounds the bend home | `[a, b] = pair(30)`; `e = type("husk")`; `only(e)`; `e.hx = a.x; e.hz = a.z; put(e, b.x, b.z)`; `e.aware = false; e.state = "return"`; player at `w.spawn`; `sim(60, () => !home(e))` | `home(e)` |
| far return | as above, but choose `a` and `b` both more than 80 m from `w.spawn` (try seeds until one has such a pair, report the seed) | `home(e)` and the player was more than 75 m from `e` on every step |
| an unreachable post does not freeze the walk | `e` in `rooms[0]` at its centre; `e.hx = w.minX - 50; e.hz = e.z`; `e.state = "return"`; `sim(2)` | `e` moved more than 3 m, no position is `NaN`, no throw |
| route budget | four husks placed in `b` with posts in `a`, all `return`; one `DF.update(1 / 60)` | exactly two have a non-null `route`; after a second `update`, all four |
| the boss walks round rock | `e = type("warden")`; `only(e)`; `hunt(e)`; `R = w.route(e.x, e.z, prev.x, prev.z, 0.6)` where `prev = w.nodes[w.path[w.path.length - 2]]`; put the player at the first point along `R` (stepping 1 m) that has no `w.los` to the boss and is under 28 m from it; `d0 = D(e, p)`; `sim(3)` | `pre` (such a point exists; try seeds if not), `e.aware` true on every step, `e.state` never `return`, and `D(e, p) < d0 - 2` |

- [ ] **Step 2: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: the five new steps print `FAIL`. Task 1's steps pass.

- [ ] **Step 3: Add `PURSUIT`, the enemy fields, `setRoute` and `walkRoute`**

As the Interfaces block says. Put the two functions next to `eStep`. Add `PURSUIT` to `window.DF`.

- [ ] **Step 4: Route the `return` state and lift the 75 m skip**

- `return`: when `e.route` is null call `setRoute(e, e.hx, e.hz)`; then `walkRoute(e, d.speed * 0.8, dt)`. Arrival is decided by the existing `hd < 0.6` check against the post, with everything it does today (idle, `hyaw`, the boss heal and phase reset) unchanged. A route cleared by `walkRoute` is asked for again on the next step; the 1.5 s stuck timer spaces the retries and stands in for the spec's 2 s.
- The skip becomes `if (dist > 75 && !e.aware && e.state !== "return") return;`.

- [ ] **Step 5: Route the boss when rock is in the way**

In `chase`, for `d.boss` only: when `w.los(e.x, e.z, p.x, p.z)` is false, the unit vector `ux, uz` used for every step toward the player points at the next waypoint of a route to the player's position. Ask for that route when there is none and again once 0.5 s has passed since the last one. With line of sight, clear the route and behave as today.

- [ ] **Step 6: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: `all passed`.
Run: `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: `all passed`.

- [ ] **Step 7: Commit**

```bash
git add src/06_game.js src/09_main.js tests/t12.mjs
git commit -m "feat: enemies walk home along a route and the boss rounds rock"
```

---

### Task 3: Sight, memory and the `search` state

The 46 m rule stays in this task. Task 4 replaces it.

**Files:**
- Modify: `src/06_game.js` (`makeEnemy`, `alertE`, `hitEnemy`, `enemyUpdate`), `src/09_main.js` (`window.DF`), `tests/t12.mjs`

**Interfaces:**
- Consumes: `PURSUIT`, `setRoute`, `walkRoute`, `e.fails` from Task 2.
- Produces: enemy fields `lsx`, `lsz` (last-seen position), `lvx`, `lvz` (the player's velocity then), `lost` (seconds since last seen), `sub` (`"go" | "guess" | "look"`), `gd` (metres walked in the guess), `alertBy` (the enemy whose `alertE` set this one's `alertIn`).
- Produces: `canSee(e)` returning `boolean`: the player is alive, within `e.def.sight * PURSUIT.seeMul` of `e`, and `G.world.los` between them is clear.
- Produces: `alertE(e, quiet, by)`. `by` is the waking enemy or undefined. Exposed as `DF.alertE`.
- Produces: `toSearch(e)` and `giveUp(e)`. `giveUp` sets `aware = false`, `state = "return"`, `token = false`, `plan = null`, `route = null`, `fails = 0`. `toSearch` sets `state = "search"`, `sub = "go"`, `t = 0`, `gd = 0`, and the same token, plan, route and fails resets.

- [ ] **Step 1: Write the failing tests**

`scene()` is a local helper for these steps: `[a, b] = pair(24)`; `e = type("husk")`; `only(e)`; `post(e, a.x, a.z + 3)`; `e.yaw = Math.PI`; player at `(a.x, a.z - 3)`; `hunt(e)`; `sim(0.3)`; `seen = { x: p.x, z: p.z }`. `hide()` then puts the player at `(b.x, b.z)` with `p.vx = p.vz = 0` and returns `!w.los(e.x, e.z, p.x, p.z)` as `pre`.

| Step name | Setup | Passes when |
| --- | --- | --- |
| a chasing enemy remembers where it saw the player | `scene()` | `e.lost === 0`, `(e.lsx, e.lsz)` within 0.3 m of the player |
| lost sight | `scene()`; `hide()`; `sim(40, () => !home(e))`, recording each state, the least `D(e, seen)` and the greatest `D(e, seen)` | `pre`; `search` was entered within 0.5 s; least `D(e, seen) < 1.5`; from first coming within 1.5 m of `seen` until it leaves `search`, it never goes more than 2.5 m from `seen` (a still player gives no guess); `home(e)`; `e.hp` unchanged; no `NaN` |
| the guess carries on the way the player went | `scene()`; `hide()`; then `e.lvx = 0; e.lvz = -5`; sim until `home(e)`, recording `sub` values and the greatest `seen.z - e.z` | `sub` took the values `go`, `guess`, `look` in that order; the enemy got more than 3 m and at most 8.5 m south of `seen` |
| seen again | `scene()`; `hide()`; sim until `e.state === "search"`; put the player back at `seen`; `sim(1.5)` | `e.aware`, `e.state` is not `search` or `return`, `e.lost === 0` |
| a hit redirects the search | `scene()`; `hide()`; sim until `e.sub === "look"`; `put(p, e.x + 2, e.z)` then `DF.hitEnemy(e, 1, 0, { src: "bolt" })`; move the player back to `b`; read `e.lsx, e.lsz` | they are within 0.01 of `(e.x + 2, e.z)` as read at the hit, and after `sim(0.6)` `e.state === "search"` with `e.sub === "go"` or `"look"` |
| a woken neighbour gets the same last-seen spot | `scene()` with a second husk `m`, unaware and idle, 6 m east of `e`, facing away, `only(e, m)`; `e.aware = false; e.state = "idle"`; `DF.alertE(e)`; `hide()`; `sim(1)` | `m.aware`, and `(m.lsx, m.lsz)` equals `(e.lsx, e.lsz)` as they were when `e` was alerted |
| a pack loses sight together | `scene()` with three more husks posted 1.5 m apart beside `e`, all `hunt`; `hide()`; sim until all are home, timing each `DF.update(1 / 60)` with `performance.now()` | all four `home`; the slowest step is under 16 ms |
| the player dying sends hunters home | `scene()` with a second husk posted 2 m east of `e` and also `hunt`; `hide()`; sim until both are in `search`; put the player back at `seen` and sim until one is in `chase` and the other still in `search` or also `chase`; then set `p.state = "dead"` and step with `DF.sim(0.1)`, not the `sim` helper, so `safe` does not revive the player | both reach `return` within 0.1 s and neither is `aware` |
| a spitter out of sight searches too | `scene()` with `type("spit")` in place of the husk; `hide()` | `search` entered, then `home(e)` |

- [ ] **Step 2: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: the nine new steps print `FAIL`. Earlier steps pass.

- [ ] **Step 3: Record sight every step**

In `enemyUpdate`, after the `alertIn` block, for an enemy that is aware and not a boss, in any state: if `canSee(e)` store the player's `x, z, vx, vz` in `lsx, lsz, lvx, lvz` and set `lost = 0`; otherwise add `dt` to `lost`.

- [ ] **Step 4: Seed last seen in `alertE` and `hitEnemy`**

- `alertE(e, quiet, by)`: after setting `aware`, copy `lsx, lsz, lvx, lvz` from `by` when given, otherwise from the player. Set `lost = 0`. Where it sets `o.alertIn` for neighbours, also set `o.alertBy = e`. The `alertIn` timer in `enemyUpdate` calls `alertE(e, true, e.alertBy)`.
- `hitEnemy`: after its `alertE` call, for a non-boss enemy set `lsx, lsz` to the player's position, `lvx = lvz = 0`, and if `e.state === "search"` set `sub = "go"`, `route = null`, `fails = 0`.

- [ ] **Step 5: Hand `chase` on to `search`, and add the `search` case**

- `chase`, first thing for a non-boss: `if (e.lost > PURSUIT.lostT) { toSearch(e); break; }`. The existing give-up test in `chase` calls `giveUp(e)`.
- `search`, first thing: `!alive` calls `giveUp`; `e.lost === 0` sets `state = "chase"`.
- `go`: `setRoute(e, e.lsx, e.lsz)` when there is no route, then `walkRoute(e, d.speed, dt)`. On arrival go to `guess` if `hypot(lvx, lvz) > 0.5`, else `look`. `e.fails >= 2` calls `giveUp`.
- `guess`: step along the unit vector of `(lvx, lvz)` at `d.speed * 0.6`, facing it, adding the distance to `gd`. End at `gd >= PURSUIT.guessDist`, after `PURSUIT.guessT`, or when the enemy has moved less than 0.3 m in 0.5 s. Then `look`.
- `look`: stand still and sweep `yaw` about 1.1 rad each side of where it faced. After `PURSUIT.look` call `giveUp`.

No pose is needed in `src/07_render.js`: states without a case there use the walk cycle from `e.speed`.

- [ ] **Step 6: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: `all passed`.
Run: `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t2.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: `all passed` for each.

- [ ] **Step 7: Commit**

```bash
git add src/06_game.js src/09_main.js tests/t12.mjs
git commit -m "feat: enemies lose the player when sight breaks and search where they last saw them"
```

---

### Task 4: Leash, territory and provoke

**Files:**
- Modify: `src/06_game.js` (`makeEnemy`, `hitEnemy`, `enemyUpdate`), `tests/t12.mjs`

**Interfaces:**
- Consumes: `giveUp`, `alertE(e, quiet, by)`, `alertBy`, `PURSUIT` from Tasks 2 and 3.
- Produces: enemy field `prov` (seconds of provoke left, 0 when not provoked).
- Produces: `leashOf(e)` returning `e.def.leash || PURSUIT.leash`.
- Produces: `inTerritory(e)` returning `boolean`: the player is within `leashOf(e) - PURSUIT.edge` of `(e.hx, e.hz)`.

- [ ] **Step 1: Write the failing tests**

`away()` is a local helper: `[a, b] = pair(38)`; `e = type("husk")`, `m` a second husk; `only(e, m)`; `put(e, a.x, a.z + 3)`, `put(m, a.x + 2, a.z + 3)`; both posts at `(b.x, b.z)` and `(b.x + 2, b.z)`; both `aware = false`, `state = "return"`; player at `(a.x, a.z - 3)`. Both enemies are then more than 32 m from their posts and the player is outside both territories.

| Step name | Setup | Passes when |
| --- | --- | --- |
| leash | `[a, b] = pair(40)`; `e = type("husk")`; `only(e)`; `post(e, a.x, a.z)`; `R = w.route(a.x, a.z, b.x, b.z, 0.6)`; `hunt(e)`; each step, move the player forward along `R` until 7 m from `e`; sim until `e.state === "return"` or 40 s, recording the greatest `D(e, post)`; then `sim(40, () => !home(e))` | the greatest distance from the post was over 28 and under 34; on the step before `e` gave up, `w.los` between it and the player was clear and they were under 22.5 m apart; `home(e)` |
| an enemy's own leash wins | same with `e.def = { ...e.def, leash: 12 }` | greatest distance from the post under 14 |
| a returning enemy ignores a player outside its territory | `away()`; `sim(1.5)` | both still `return` and not `aware` |
| provoked | `away()`; `DF.hitEnemy(e, 1, 0, { src: "melee" })`; `sim(1)`; read; then `sim(6)` with the player left where they are | after 1 s both `e` and `m` are hunting and `m.prov > 0`; after the further 6 s both are `return` or `idle` and not `aware` |
| a returning enemy notices inside its territory | `[a] = pair(24)`; `e` posted at `(a.x, a.z)`, placed at `(a.x, a.z + 6)`, `yaw = Math.PI`, `state = "return"`, unaware; player at `(a.x, a.z - 4)`; `sim(1)` | `e` is hunting |

- [ ] **Step 2: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: "leash", "an enemy's own leash wins", "a returning enemy ignores a player outside its territory" and "provoked" print `FAIL`. "a returning enemy notices inside its territory" passes already and must keep passing.

- [ ] **Step 3: Replace the 46 m rule with the leash**

In `enemyUpdate`: count `e.prov` down to 0 each step. For a non-boss, the give-up test in `chase` and in `search` is: the player is dead, or `e.prov <= 0` and the enemy is further than `leashOf(e)` from its post. The `dist > 46` test goes. The boss keeps `dist > 38` and its 30 m test exactly as they are.

- [ ] **Step 4: Territory and provoke**

- The sight check that wakes an unaware enemy gains one condition for a non-boss in `return`: `inTerritory(e)`.
- The `alertIn` timer, for a non-boss in `return`: wake it only when `inTerritory(e)` or `e.alertBy.prov > 0`. In the second case set `e.prov = e.alertBy.prov` before calling `alertE`.
- `hitEnemy`: for a non-boss, non-dummy enemy set `e.prov = PURSUIT.provoke` before its `alertE` call.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: `all passed`.
Run: `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke` and `SCRIPT=$PWD/tests/t2.mjs node test.mjs smoke`
Expected: `all passed` for both.

- [ ] **Step 6: Commit**

```bash
git add src/06_game.js tests/t12.mjs
git commit -m "feat: enemies give up at a leash from their post and a hit provokes them past it"
```

---

### Task 5: The boss chamber, tunnel posts and the docs

**Files:**
- Modify: `src/06_game.js` (`G`, `resetRun`, `update`, `alertE`, `enemyUpdate`), `src/03_world.js` (the tunnel spawn loop in `genWorld`), `index.tpl.html` (`#scr-howto`), `README.md`, `CLAUDE.md`, `tests/t12.mjs`

**Interfaces:**
- Consumes: `giveUp`, `PURSUIT.bossPad` from earlier tasks.
- Produces: `G.inBoss` (`boolean`). False when `G.world.boss` is null. Set at the top of `update`, after the transition check and before `playerUpdate`: it turns true when the player is within `boss.r` of `(boss.x, boss.z)` and turns false when they are beyond `boss.r + PURSUIT.bossPad`. `resetRun` sets it false.

- [ ] **Step 1: Write the failing tests**

`mouth()` is a local helper: `B = w.boss`; `prev = w.nodes[w.path[w.path.length - 2]]`; `R = w.route(B.x, B.z, prev.x, prev.z, 0.6)`; `at(k)` is the first point along `R` (stepping 0.5 m) that is `B.r + k` from the boss centre; `h = type("husk")`, `s = type("spit")`; `only(h, s)`; `h` posted at the point `at(6)` and `s` at `at(9)` with `post`; both `hunt`; player at `at(14)`; `sim(0.5)`. `inside()` then puts the player at `at(-4)`.

| Step name | Setup | Passes when |
| --- | --- | --- |
| the chamber flag | player at `at(-4)`, `DF.update(1 / 60)`, read; at `at(1.5)`, update, read; at `at(4)`, update, read | `true`, `true`, `false` |
| stepping into the chamber sheds the pack | `mouth()`; `inside()`; `sim(14)`, recording after the fifth second whether any projectile in `G.projs` has `own === "e"` and a non-boss `src`, and whether `h` or `s` is within `B.r` of the boss centre | both `home`; no such projectile; neither inside `B.r` after the fifth second |
| the pack cannot notice a player in the chamber | continue from the scene above once both are home: face both at the player; `sim(3)` | both still `idle` and not `aware` |
| a hit from inside the chamber does not start a hunt | same scene; `hp0 = h.hp`; `DF.hitEnemy(h, 5, 0, { src: "bolt" })`; `sim(1)` | `h.hp < hp0`; `h` not `aware`; `s` not `aware` |
| the boss still fights in its chamber | `e = type("warden")`; `only(e)`; player at `at(-4)`; `sim(2)` | `e.aware` and `e.state` is not `idle` or `return` |
| no post in the boss chamber | for `s` 1 to 40: `DF.newRun(s * 7919)`; for each spawn that is not the warden, its distance from `G.world.boss` | every distance is at least `boss.r + P.bossPad`; every such spawn has `fieldAt >= 0.45` |
| leaving for the hall clears the chamber flag | `mouth()`; `inside()`; `DF.update(1 / 60)`; `DF.enterHub()`; `sim(1)` | `G.inBoss === false`, `G.zone === "hub"`, the dummy is `idle` |

- [ ] **Step 2: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: "the boss still fights in its chamber" passes. The other six print `FAIL`. "no post in the boss chamber" should list at least one seed. About one cave in seven has such a post, so if these forty happen to have none, widen the sweep to 200 seeds for this run to see it fail, then put it back to forty.

- [ ] **Step 3: Add `G.inBoss` and apply it**

- Add the flag as the Interfaces block says.
- `alertE`: `if (G.inBoss && !e.def.boss) return;` straight after the existing first line. This covers sight, `alertIn` and hits.
- The give-up test for a non-boss in `chase` and `search` gains `G.inBoss`, checked before provoke so provoke never overrides it. An enemy in `wind`, `act` or `rec` finishes and gives up when it falls back to `chase`.

- [ ] **Step 4: Move tunnel posts out of the chamber in `genWorld`**

In the loop that posts a Husk at the midpoint of an edge: if that point is within `boss.r + PURSUIT.bossPad` of the boss, walk the index along `e.pts` away from the boss end, one point at a time, until the point is outside, and post it there. If no point on the edge qualifies, skip the spawn. Do not call `Rn()` for this.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`
Expected: `all passed`.

- [ ] **Step 6: Update the docs and the How to play tip**

- `index.tpl.html`, `#scr-howto`: one new `<li>` in the tips list: "Enemies chase what they can see. Break their line of sight and they search where they last saw you, then go back to their post. They will not follow you into the boss chamber."
- `README.md`: a **Pursuit** bullet under "What is in the game" saying the same in two or three sentences with the 32 m leash, and a `tests/t12.mjs` row in the script table: "Routes, lost sight and searching, leash, provoke, boss chamber".
- `CLAUDE.md`:
  - World section: `world.route(ax, az, bx, bz, rad)` and that `world.path` is the chamber list.
  - Enemies section: add `search` to the state list; replace "Enemies steer straight at the player and slide along walls. There is no pathfinding." with the sight, search, leash, provoke and boss chamber rules, the `PURSUIT` table, and the helpers `canSee`, `giveUp`, `toSearch`, `setRoute`, `walkRoute`, `inTerritory`, `leashOf`.
  - Zones section: `G.inBoss` is cleared by `resetRun`.
  - Testing section: run `tests/t12.mjs` after any change to enemy movement, sight or `fieldFns`.
  - Known problems: remove the snagging line. Add: ranged hit-and-hide is not prevented; an enemy hit from inside the boss chamber does not respond.
  - "Add an enemy" recipe: an optional `leash` on the `EDEF` entry.

- [ ] **Step 7: Run every script and look at the result**

```bash
node build.mjs
for t in 2 3 5 6 10 12; do SCRIPT=$PWD/tests/t$t.mjs node test.mjs smoke | tail -1; done
SCRIPT=$PWD/tests/t8.mjs node test.mjs hub | tail -1
SCRIPT=$PWD/tests/t11.mjs node test.mjs smoke | tail -1
```

Expected: `all passed` on every line. Open `shots/` from `t11` and check the How to play screen still fits with the extra tip.

- [ ] **Step 8: Commit**

```bash
git add src/06_game.js src/03_world.js index.tpl.html README.md CLAUDE.md tests/t12.mjs
git commit -m "feat: regular enemies leave the player alone in the boss chamber"
```
