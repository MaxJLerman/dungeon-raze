# D Enemies, Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Behaviour hooks for enemy types, and the rat, the drowned and the brood mother, filling the sewer's brood rooms and tunnel posts.

**Architecture:** A table of per-type behaviour hooks (`EBEH`) in a new file, called from fixed points in `enemyUpdate`, `hitEnemy`, `kill`, `eStep` and `update`; a type with no entry runs exactly as now. The new bodies and their poses live in their own file (`EFIG`, `EPOSE`), dispatched from `makeEnemyFig` and `poseEnemy`. `genSewer`'s spawn step places the new types by room kind, with all its draws still last.

**Tech Stack:** Plain JavaScript concatenated into one scope by `build.mjs`, the game's own WebGL renderer, headless Chromium tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-19-d-enemies-design.md` (batch 1 only; read `CLAUDE.md` first).

## Global Constraints

- All `src/*.js` files are concatenated in sorted filename order into one function scope: declare each name once across `src/`, no imports, no dependencies, nothing loaded from other sites.
- `node build.mjs` after every source change; the page that runs is `dist/index.html` (not committed).
- Water is read only through `world.waterAt` and `world.bodyAt`; never test whether the world is the sewer.
- Every new way of moving an enemy goes through `eStep`. All damage to enemies goes through `hitEnemy`, all damage to the player through `hurtPlayer`.
- E plays exactly as before: no change to how a husk, brute, spitter, Warden or the dummy moves, hits or decides; `t22`'s `genWorld` hashes do not move; `t5`, `t6`, `t12`, `t20`, `t21` pass unchanged.
- `genSewer`'s mesh, materials, water, pieces and dressing hashes in `t22` do not move. Only its spawns hash changes, on purpose, and the commit says so.
- D stays out of `LIVE_GRADES`. Tests make D live with `DF.LIVE_GRADES.add("D")`.
- Commit messages: no `Co-Authored-By` or `Claude-Session` trailers. Never commit `new-names.txt` or `tests/codes.local.*`.
- Numbers below are starting values from the spec, to be tuned later; use them as given.

## Review Focus

1. A brood mother's rats when the player dies and respawns: every rat she sent out is gone and her timer starts over (Task 4 test).
2. A brood mother that is staggered, falling, dead or out of the hunt because the player is in the boss cavern sends out nothing (Task 4 test).
3. The Enforcer's shotgun from the front: every pellet is stopped by the drowned's cover, not only the first (Task 3 test).
4. A rat at a gutter's shore, where `waterAt` sits between 0 and 1: it may attack at 0.5 and below and not above (Task 2 test).
5. A rat sent out by a brood mother goes home with her: its post is hers, so it does not walk back to where it was born (Task 4 test).

---

### Task 1: Behaviour hooks and footing

**Files:**
- Create: `src/06b_ebeh.js` (the `EBEH` table, `footOk`, `keepFooting`)
- Create: `src/05b_dbodies.js` (empty `EFIG` and `EPOSE` tables for now)
- Modify: `src/06_game.js` (`makeEnemy`, `eStep`, `enemyUpdate`, `hitEnemy`, `kill`, `hurtPlayer`, `projUpdate`, `update`)
- Modify: `src/05_figures.js` (`makeEnemyFig`), `src/07_render.js` (`poseEnemy`), `src/09_main.js` (`window.DF`)
- Test: `tests/t23.mjs` (new)

**Interfaces:**
- Produces, in `06b_ebeh.js`: `const EBEH = {}` keyed by enemy type (`e.type`). Every hook is optional:
  - `step(e, dt, c) -> boolean`: each awake step, after the shared senses and knockback, before the state switch. `true` skips the switch this step.
  - `chase(e, dt, c) -> boolean`: in the `chase` case after the give-up and search checks, before the shared steering. `true` means it handled the step.
  - `canAttack(e, c) -> boolean`: `false` keeps the chase case from starting an attack this step (no token is taken; `e.plan` is kept).
  - `wind(e, c) -> void`: once, when `wind` turns to `act`, for an `atk.kind` the shared code does not know (not `shot`, `volley`, `slam`, `charge`).
  - `act(e, dt, c) -> void`: each `act` step for such a kind. The shared end of `act` (`k >= 1` goes to `rec`) still runs unless the hook changed `e.state`.
  - `hit(e, dmg, post, o) -> null | { dmg, post, blocked }`: in `hitEnemy`, right after the Riftwalker bonus is applied, before the ambush multiplier.
  - `death(e) -> void`: at the end of `kill`.
  - `foot(e, x, z) -> boolean`: whether `e` may stand at `(x, z)`.
  - `c` is `{ p, w, dx, dz, dist, toP, alive }`, the values `enemyUpdate` already computes.
- Produces: `footOk(e, x, z) -> boolean` (true when the type has no `foot`), and `keepFooting(e) -> void`: if `footOk` at its position, store it in `e.okx, e.okz`, else move it back there. `makeEnemy` sets `okx, okz` to the spawn point.
- Produces, in `05b_dbodies.js`: `const EFIG = {}` (type to a function returning a finished figure) and `const EPOSE = {}` (type to `{ pose(e) }`, which replaces `poseEnemy`'s body, or `{ after(e) }`, called at the end of `poseEnemy` before `setEm`).
- Produces: `hurtPlayer` reads `atk.kb` as the knockback speed when set (`atk.kb || (atk.unb ? 11 : 7)`).
- Produces: `projUpdate` passes `sx: pr.x - pr.vx * 0.05, sz: pr.z - pr.vz * 0.05` in the options of its `hitEnemy` call; only hit hooks read them.
- Produces on `window.DF`: `EBEH`, `EFIG`, `EPOSE`, `makeEnemy`, `separate`, `spawnEnemies`, `footOk`.

- [ ] **Step 1: Write the failing tests** in `tests/t23.mjs`

Use t22's `step` helper and add an arena on cave 99:

```js
// D enemies. Run with: SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke
const step = (name, body) => ({ name, eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} })()` });
// cave 99, every enemy gone, one of the type 4 m in front of the player and facing them
const arena = (name, type, body) => step(name, `DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world;
  G.enemies = []; const e = DF.makeEnemy({ type: "${type}", x: p.x, z: p.z + 4, yaw: Math.PI, node: -1 }); w.resolve(e, e.r); G.enemies.push(e);
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  ${body}`);
```

If `(p.x, p.z + 4)` is not open floor at cave 99's start, choose an offset that is; every arena step asserts `w.fieldAt(e.x, e.z) >= 1`.

Steps, using the husk as the body under test (`e.type` is set to a test key after `makeEnemy`, so the husk's figure and numbers stay):
- "a type with no hooks runs as before": `DF.EBEH.husk === undefined`, and the step passes when `t5`, `t12` and `t22`'s `genWorld` step still pass (record that in the report; no assertion here beyond the lookup).
- "step, chase and death hooks are called": register `DF.EBEH.__t = { step() { n.s++; return false; }, chase() { n.c++; return false; }, death() { n.d++; } }`, set `e.type = "__t"`, `DF.alertE(e, true)`, `DF.sim(1, keep)`, then `DF.kill(e)`. Pass when `n.s > 30 && n.c > 0 && n.d === 1`. Delete `DF.EBEH.__t` before returning.
- "step returning true skips the state switch": a `step` hook returning `true`; alert the enemy, `DF.sim(2, keep)`. Pass when `e.state` never became `wind` and `e.x, e.z` moved less than 0.05 m.
- "canAttack false starts no attack and takes no token": hook `canAttack: () => false`; alert, put the enemy 1.5 m from the player facing them, `DF.sim(3, keep)` recording states. Pass when no `wind` was seen and `e.token === false`. Then remove the hook and `DF.sim(3, keep)`: a `wind` is seen.
- "wind and act hooks run for an unknown kind": `DF.EDEF.__k = { ...DF.EDEF.husk, atks: { zap: { style: "cast", kind: "zap", wind: 0.2, act: 0.3, rec: 0.2, trig: 10 } } }`, enemy made with type `__k`, hooks `wind() { n.w++; }, act() { n.a++; }`. After `DF.sim(3, keep)`: `n.w >= 1`, `n.a >= 15 * n.w` and a `rec` was seen. Delete both test keys.
- "a hit hook can refuse a hit": hook `hit: () => ({ dmg: 0, post: 0, blocked: true })`; `DF.hitEnemy(e, 30, 10, { src: "melee" })` leaves `e.hp === e.def.hp`; without the hook the same call lowers it.
- "a foot hook keeps a body on its footing": with `X = e.x + 1` and `foot: (q, x) => x < X`: `DF.eStep(e, 1, 0, 4, 1)` leaves `e.x < X`; `e.kx = 40; DF.sim(0.3, keep)` leaves `e.x < X`; a second husk placed at `(X + 0.1, e.z)` overlapping it, then `DF.separate()`, leaves `e.x < X`. `DF.footOk(e, X + 1, e.z) === false`.
- "hurtPlayer uses an attack's kb": `DF.hurtPlayer(5, e, { dmg: 5, kb: 20 })` with the player unguarded and `p.iframe = 0` gives `Math.hypot(p.kx, p.kz)` within 0.01 of 20.

- [ ] **Step 2: Run them to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke`
Expected: FAIL, with `DF.EBEH` and `DF.makeEnemy` undefined.

- [ ] **Step 3: Implement the hooks**

- `06b_ebeh.js`: `EBEH`, `footOk`, `keepFooting`, with a comment saying what each hook is for and where it is called.
- `eStep`: compute the new position. If `footOk` refuses it, try moving along x only, then along z only, then stay. `e.speed` and `e.walk` reflect the step taken. For a type with no `foot`, the arithmetic is exactly today's.
- `enemyUpdate`: build `c` once after `dist` and `toP`. Call `step` after the sight-memory block and before `switch`. Call `chase` and `canAttack` in `chase`. `canAttack` gates the melee `want` and the ranged shot start. Call `wind` and `act` for unknown kinds. Look the entry up once per call: `const b = EBEH[e.type]`.
- `hitEnemy`: when the hook returns `blocked`, apply only the returned posture (unless staggered), `e.postT = 0`, the alert and provoke and last-seen updates that a hit does today, a small white spark burst at the body, `SFX.block()`, and a stagger if posture is full. No health loss, no knockback, no flinch, no hitstop, no focus. Otherwise use the returned `dmg` and `post`.
- `kill`: call `death` last.
- `update`: after `separate()`, call `keepFooting(e)` for every living enemy whose type has a `foot` hook.
- `makeEnemyFig`: `if (EFIG[type]) return EFIG[type]();` first. `poseEnemy`: `pose` replaces it (dummy first, as now), and `after` runs just before `setEm`.
- Add the `DF` names.

- [ ] **Step 4: Run t23 and the E suites**

Run: `node build.mjs && for t in t23 t5 t6 t12 t20 t21 t22; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`
Expected: no `FAIL` lines. `t22` is unchanged, since no spawns change yet.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/05b_dbodies.js src/06_game.js src/05_figures.js src/07_render.js src/09_main.js tests/t23.mjs
git commit -m "feat: per-type behaviour hooks for enemies"
```

---

### Task 2: The rat

**Files:**
- Modify: `src/06_game.js` (`EDEF.rat`), `src/06b_ebeh.js` (`EBEH.rat`), `src/05b_dbodies.js` (`EFIG.rat`, `EPOSE.rat`)
- Test: `tests/t23.mjs`

**Interfaces:**
- Consumes: `EBEH.canAttack`, `EFIG`, `EPOSE.pose` (Task 1).
- Produces: enemy type `"rat"`, which Task 4 sends out and Task 5 places.

`EDEF.rat`:
- name `"Rat"`, threat 0, hp 18, posture 20, speed 5.2, turn 8, r 0.35, sight 14, cd 1.1, poise 0, hunch 0, top 0.9, wade 1.6.
- `bite`: style `"thrust"`, wind 0.4, act 0.12, rec 0.45, dmg 7, reach 1.6, arc 1.6, lunge 0.8, trig 1.7.
- `pounce`: style `"thrust"`, wind 0.55, act 0.22, rec 0.6, dmg 10, reach 1.6, arc 1.2, lunge 3.6, trig 4.4, minTrig 2.4.

`EBEH.rat.canAttack` is `waterAt(e.x, e.z) <= 0.5`.

**The body.**
- It's built on `makeFigure`'s skeleton. The chest is pitched forward so the torso lies flat, with the arms as forelegs and the legs as short hind legs. The head sits forward with a pointed snout, and a thin tail cone trails behind. Colours are a grey-brown body with pale feet.
- Its own pose covers: running on all fours; the wind-up, rearing upright on its hind legs with the forelegs up, which is the opening the spec names; the bite or pounce thrown forward from that; flinch, stagger and death.
- When `waterAt` is above 0.5 it swims flat, legs paddling, and holds no rear.
- It faces +Z and sets `f.rim` and `f.eye`. `sinkInWater` is still called.

- [ ] **Step 1: Write the failing tests**
  - "a rat cannot attack while swimming": arena with `"rat"`, `w.waterAt = () => 1`, alert, rat 1.2 m from the player facing them, `DF.sim(4, keep)` recording states. Pass when no `wind` was seen. Then `w.waterAt = () => 0` and `DF.sim(4, keep)`: a `wind` is seen.
  - "a rat attacks at a shore reading of 0.5, not above": the same with `w.waterAt = () => 0.5` (a `wind` is seen) and `() => 0.51` (none).
  - "a rat outpaces the player in water": `DF.EDEF.rat.speed * DF.wadeOf(DF.EDEF.rat)` is greater than the fastest class's `run * DF.WATER.slow` (over `DF.CLASSES`).
  - "the rat's body": `DF.EFIG.rat` exists, the figure has `rim` and `eye`, and `DF.poseEnemy(e)` runs without throwing in each of `idle`, `chase`, `wind`, `act`, `hit`, `stagger` and `dead`, dry and with `waterAt` 1.
  - Shots, each with the rat alone 3 m in front of the camera in cave 99, at `wait: 400`: `t23-rat` (running), `t23-rat-rear` (half way through `wind`), `t23-rat-swim` (`w.waterAt = () => 1`).

- [ ] **Step 2: Run to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke`
Expected: FAIL, `EDEF.rat` undefined.

- [ ] **Step 3: Implement `EDEF.rat`, `EBEH.rat`, `EFIG.rat` and `EPOSE.rat`** with the values above.

- [ ] **Step 4: Run t23 and look at the three shots**

Run: `node build.mjs && SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke`
Expected: PASS. In `shots/t23-rat*.png`, a rat on all fours, rearing up, and flat in the water. Fix the body until it reads that way.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js tests/t23.mjs
git commit -m "feat: the rat, which cannot attack while swimming"
```

---

### Task 3: The drowned

**Files:**
- Modify: `src/06_game.js` (`EDEF.drowned`), `src/06b_ebeh.js` (`EBEH.drowned`), `src/05b_dbodies.js` (`EFIG.drowned`, `EPOSE.drowned`)
- Test: `tests/t23.mjs`

**Interfaces:**
- Consumes: `EBEH.hit`, the `sx, sz` shot origin, `atk.kb`, `EPOSE.after` (Task 1).
- Produces: enemy type `"drowned"`, for Task 5.

`EDEF.drowned`:
- name `"Drowned"`, threat 1, hp 90, posture 80, speed 2.4, turn 2.2, r 0.55, sight 14, cd 1.5, poise 1, hunch 0.25, top 2.0.
- `guard: 1.05` (half-angle of the cover, in radians) and `guardLight: 0.25` (share of a light hit's posture kept through the cover).
- `bash`: style `"thrust"`, wind 0.6, act 0.15, rec 0.6, dmg 12, reach 2.0, arc 1.6, lunge 1.0, trig 2.0, kb 14.
- `edge`: style `"over"`, wind 0.8, act 0.16, rec 0.8, dmg 22, reach 2.4, arc 1.3, lunge 1.2, trig 2.3.

**`EBEH.drowned.hit(e, dmg, post, o)`.**
- The hit's origin is `o.sx, o.sz` if set, else `o.fx, o.fz` if set, else the player.
- A hit is from the front when the angle between `e.yaw` and the direction to the origin is under `guard`.
- It blocks a front hit whose `src` is not `"aoe"` and not `"exec"`, while `e.state` is not `stagger`. The block returns `{ dmg: 0, post: o.heavy ? post : post * guardLight, blocked: true }`.
- Every other hit returns `null`.

**The body.**
- `makeFigure`, waterlogged: grey-green skin, ragged dark cloth.
- A round manhole cover (a flat cylinder with a raised rim, iron grey) on the left hand, held in front of the chest.
- `EPOSE.drowned.after` keeps the left arm raised so the cover faces forward in every state but `stagger` and `dead`, and lowers it then.

- [ ] **Step 1: Write the failing tests** (arena with `"drowned"`, facing the player)
  - "front hits do nothing to the drowned": `DF.hitEnemy(e, 20, 10, { src: "melee" })`: `e.hp === 90` and posture rose by 2.5 within 1e-6.
  - "a front heavy deals its full posture": the same with `heavy: true` gives `e.hp === 90` and posture up by 10.
  - "front heavies break it into a stagger": repeated front heavy hits of posture 20 stagger it within 4 hits, with `e.hp === 90` until then.
  - "side and back hits land": with the player moved to 3 m behind it (`e.yaw` kept), `DF.hitEnemy(e, 20, 10, { src: "melee" })` lowers `e.hp`. The same from 90 degrees to its side lowers it.
  - "every pellet from the front is stopped": `const pz = { sx: e.x + Math.sin(e.yaw) * 1, sz: e.z + Math.cos(e.yaw) * 1 };` then five `DF.hitEnemy(e, 8, 4, { src: "pellet", ...pz })` calls leave `e.hp === 90`.
  - "blasts and executions go round the cover": a front `{ src: "aoe", fx: …, fz: … }` lowers hp. After `DF.stagger(e)`, a front `{ src: "exec", heavy: true }` lowers hp.
  - "the bash shoves the player": after `DF.hurtPlayer(12, e, DF.EDEF.drowned.atks.bash)` on an unguarded player, the knockback length is within 0.01 of 14.
  - "the drowned's body" pose check, as for the rat.
  - Shot `t23-drowned`, front three-quarter view, at `wait: 400`.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke` gives FAIL, `EDEF.drowned` undefined.
- [ ] **Step 3: Implement `EDEF.drowned`, `EBEH.drowned`, `EFIG.drowned`, `EPOSE.drowned`.**
- [ ] **Step 4: Run t23 and t6, and look at the shot.** Run `node build.mjs && for t in t23 t6; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`, expecting no `FAIL`. The shot shows the cover held forward and plainly round.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js tests/t23.mjs
git commit -m "feat: the drowned, whose manhole cover stops hits from the front"
```

---

### Task 4: The brood mother

**Files:**
- Modify: `src/06_game.js` (`EDEF.brood`, `kill`, `BROOD`), `src/06b_ebeh.js` (`EBEH.brood`), `src/05b_dbodies.js` (`EFIG.brood`, `EPOSE.brood`), `src/09_main.js` (`DF.BROOD`)
- Test: `tests/t23.mjs`

**Interfaces:**
- Consumes: `EBEH.step`, `EBEH.chase` (Task 1); type `"rat"` (Task 2).
- Produces: type `"brood"`; a sent-out rat carries `e.mom` (its mother) and `e.born = true`.

**`BROOD`** is `{ every: 6, first: 3, cap: 4, keep: 7, close: 3, focus: 2 }`.

**`EDEF.brood`.**
- name `"Brood Mother"`, threat 1, hp 110, posture 90, speed 2.6, turn 3, r 0.8, sight 15, cd 1.8, poise 1, hunch 0, top 1.5.
- `bite`: style `"thrust"`, wind 0.75, act 0.18, rec 0.8, dmg 18, reach 2.4, arc 1.6, lunge 0.8, trig 2.4.

**`EBEH.brood.step`.**
- `e.birthT` starts at `every - first`, so the first rat comes 3 s into a hunt. It grows by `dt` only while all of these hold:
  - `e.aware`;
  - `!G.inBoss`;
  - the state is `chase`, `search`, `wind`, `act` or `rec`.
- At `every`, while fewer than `cap` living enemies have `mom === e`, it sends out a rat and resets to 0. The rat:
  - is made with `makeEnemy` 1.4 m behind her (away from the player), resolved;
  - has `node` equal to hers, and `hx, hz, hyaw` equal to her post;
  - has `mom = e` and `born = true`;
  - is pushed to `G.enemies` and alerted with `alertE(rat, true)`.
- She plays `SFX.tele(false)` and a small spark burst at the spot.
- It returns `false`.

**`EBEH.brood.chase`.** While `close < dist < keep`, she backs away from the player at `speed * 0.6`, strafing as the shared code does and facing the player, and returns `true`. Otherwise it returns `false`, so the shared code walks her in or bites when the player reaches her.

**`kill`.** A killed enemy with `born` adds `BROOD.focus` to focus instead of 6, and skips the tool-charge roll. The `Math.random()` roll still happens for every enemy without `born`, so E's draws are unchanged.

**The body.** A bigger, swollen rat: a `sc` about 1.6 rat body with a pale bloated belly sac that pulses (emissive) when a rat is sent out. `EPOSE.brood` may reuse the rat's pose function with the sac added.

- [ ] **Step 1: Write the failing tests** (arena with `"brood"`, player 9 m from her and in sight, `DF.alertE(e, true)`)
  - "she sends out rats, at most four at once": `DF.sim(40, () => { keep(); n = G.enemies.filter((o) => o.mom === e && !o.dead).length; max = Math.max(max, n); })`. Pass when `max === 4` and no step had more.
  - "she stops when she dies": after the step above, `DF.kill(e)`, record how many enemies have `mom === e`, `DF.sim(12, keep)`, and the number is the same.
  - "her rats give no tool charge and less focus": kill 40 rats with `born` (made directly with `mom` and `born` set) with `p.tool = 0, p.focus = 0` before each kill. `p.tool` stays 0, and `p.focus` after one kill is `DF.BROOD.focus`. Killing 40 placed rats raises `p.tool` at least once.
  - "she keeps her distance": the player walks toward her from 9 m to 5 m over 2 s (set `p.x, p.z` each step). Her distance to the player at the end is more than `DF.BROOD.close`, and she has not started a `wind`.
  - "she sends nothing while staggered, falling or in the boss rule": with `e.birthT = DF.BROOD.every - 0.1`, each of `DF.stagger(e)`, `e.state = "fall"; e.vy = 0; e.y = 6` and `G.inBoss = true` followed by `DF.sim(1, keep)` sends no rat.
  - "a respawn clears her rats": let her send out two, then `DF.respawn()` after setting a checkpoint as t6 does. No enemy has `born`, and a fresh brood mother's `birthT` is back at `every - first`.
  - "her rats share her post": a sent-out rat's `hx, hz` equal hers, and after `DF.G.player` moves 80 m away and `DF.sim(20)`, the rat is within 3 m of her post.
  - "the brood mother's body" pose check, and shot `t23-brood` of her with two rats beside her.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke` gives FAIL, `EDEF.brood` undefined.
- [ ] **Step 3: Implement `BROOD`, `EDEF.brood`, `EBEH.brood`, the `kill` change, `EFIG.brood` and `EPOSE.brood`.**
- [ ] **Step 4: Run t23, t6 and t12, and look at the shot.** Run `node build.mjs && for t in t23 t6 t12; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`, expecting no `FAIL`.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js src/09_main.js tests/t23.mjs
git commit -m "feat: the brood mother, which sends out rats until killed"
```

---

### Task 5: Placement in the sewer, and the docs

**Files:**
- Modify: `src/03c_sewer.js` (the `---- spawns ----` block of `genSewer`)
- Modify: `tests/t22.mjs` (the spawns entry of the `genSewer` hashes only), `tests/t23.mjs`
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: types `"rat"`, `"drowned"`, `"brood"` (Tasks 2 to 4).
- Produces: sewer spawns where brood rooms and tunnel posts hold only D types. Pool rooms keep `PACK.pool` (the E stand-ins) until batch 2.

**Placement** (all draws from `Rn`, still after everything else in `genSewer`):
- **Brood room:**
  - One `brood`, at the farthest of 12 dry candidate spots from the room's entry. The entry is the end of `pts` nearest the room, on the edge joining it to its neighbour of lowest depth.
  - `2 + floor(Rn() * 3)` rats, on dry spots as now.
  - With `Rn() < 0.4`, one `drowned`.
- **Pool room:** unchanged, the same draws as today.
- **Tunnel post** (the 50% of edges that get one today, same checks):
  - With `Rn() < 0.4`, a `drowned` at the post.
  - Otherwise a pack of 3 rats: the post plus two points 1.2 m either way along the tunnel, each resolved and kept only if dry and open.
  - Each records `kind: "tunnel"`.

- [ ] **Step 1: Write the failing tests** in `t23`, over seeds 1 to 12 with `DF.genSewer(s)`:
  - "brood rooms hold one brood mother and only D types": every brood node has exactly one `brood` spawn. Every spawn of kind `brood` or `tunnel` has a type in `["rat", "drowned", "brood"]`.
  - "brood rooms hold 2 to 4 rats": a rat count per brood node between 2 and 4.
  - "tunnel rat packs are three or fewer and together": the rats at each tunnel post number at most 3, within 3 m of each other.
  - "pool rooms are unchanged": the pool-room spawns equal what `main` produced for those seeds. Record `JSON.stringify` of the pool-kind spawns for seeds 1, 5 and 9 from the current build before changing `genSewer`, and paste them into the test as the expected value.
  - Shots: `t23-fight-brood` (a brood room from its entry with the enemies awake and the player 8 m in) and `t23-fight-tunnel` (a drowned in a tunnel, player 5 m off), at `wait: 500`.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke` gives FAIL on the brood-room step.
- [ ] **Step 3: Implement the placement in `genSewer`.**
- [ ] **Step 4: Update t22's spawns hash.**
  - Run t22. Only the fifth value (spawns) of each seed in "genSewer is unchanged by moving code" should differ. Copy the new values in.
  - Update the comment above it to say it was last set when brood rooms and tunnels got their D enemies.
  - If any other value moved, the placement drew from `Rn` before something else did: fix that, not the hash.
- [ ] **Step 5: Run every suite.** Run `node build.mjs && for t in t23 t22 t5 t6 t8 t12 t20 t21; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done` (t8 uses `hub`: run it as `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`), expecting no `FAIL`. Look at both fight shots and the earlier t23 shots.
- [ ] **Step 6: Update the docs.**
  - **`CLAUDE.md`:**
    - A new "Enemy behaviours" part under Enemies: `EBEH` and its hooks, `footOk` and `keepFooting`, `EFIG` and `EPOSE`, `atk.kb`, and the `sx, sz` shot origin that only hit hooks read.
    - The rat, drowned and brood mother, and `BROOD`.
    - The "Add an enemy" recipe gains the hook, figure and pose tables.
    - Every line saying D joins `LIVE_GRADES` when project 2 lands now says when project 3 (the crocodile) lands.
    - The `t23` testing entry.
    - A known problem: the three are untested by hand.
  - **`README.md`:** the D enemies that exist so far, and that D is still sealed.
- [ ] **Step 7: Commit**

```bash
git add src/03c_sewer.js tests/t22.mjs tests/t23.mjs CLAUDE.md README.md
git commit -m "feat: brood rooms and sewer tunnels get their D enemies

genSewer's spawns hash in t22 changes on purpose: brood rooms and tunnel
posts now place rats, drowned and brood mothers. Its mesh, water, pieces
and dressing hashes are unchanged."
```
