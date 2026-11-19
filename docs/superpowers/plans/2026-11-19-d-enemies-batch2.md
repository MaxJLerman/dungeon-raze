# D Enemies, Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The water and wall enemies of the D gate (siren, eel, bloater, drain grabber), the `held` player state they share, and the shared support water-bound and wall-bound types need, filling pool rooms, gutters and grates so no E type spawns in D.

**Architecture:** Batch 1's hooks (`EBEH` in `06b_ebeh.js`) carry each type's behaviour. One flag on `EDEF`, `bound`, marks types that may not leave their footing, and one predicate, `bound(e)`, replaces hand-written boss and dummy checks in the class tools. Being grabbed is one player state with one entry point (`grabPlayer`), and the new effects (poison clouds, a shocked pool) get their own update and drawing.

**Tech Stack:** Plain JavaScript concatenated into one scope by `build.mjs`, the game's own WebGL renderer, headless Chromium tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-19-d-enemies-design.md` (batch 2, including its "Notes for batch 2 from batch 1's review"; read `CLAUDE.md` first, especially "Enemy behaviours").

## Global Constraints

- All `src/*.js` files are concatenated in sorted filename order into one function scope: declare each name once across `src/`, no imports, no dependencies, nothing loaded from other sites.
- `node build.mjs` after every source change; the page that runs is `dist/index.html` (not committed).
- Water is read only through `world.waterAt` and `world.bodyAt`; never test whether the world is the sewer.
- Every new way of moving an enemy goes through `eStep`. All damage to enemies goes through `hitEnemy`, all damage to the player through `hurtPlayer`.
- Every new way of hitting or targeting an enemy skips a falling enemy and respects the dummy, as `CLAUDE.md` lists; from Task 1 on it also skips an enemy with `e.hidden` set.
- E plays exactly as before: no change to how a husk, brute, spitter, Warden or the dummy moves, hits or decides, including `Math.random` consumption; `t22`'s `genWorld` hashes do not move; `t5`, `t6`, `t12`, `t20`, `t21` pass unchanged. Batch 1's types (rat, drowned, brood) behave as before.
- `genSewer`'s mesh, materials, water, pieces and dressing hashes in `t22` do not move. Only its spawns hash changes, in Task 7, on purpose, and the commit says so.
- D stays out of `LIVE_GRADES` (it opens when the crocodile lands, project 3). Tests make D live with `DF.LIVE_GRADES.add("D")`.
- No change to the classes, controls or touch layout. Being grabbed uses the dodge input every device already has (`hit("dodge")`, which reads keys, `T:dodge` and the pad).
- Commit messages: no `Co-Authored-By` or `Claude-Session` trailers. Never commit `new-names.txt`, `tests/codes.local.*` or `shots/`.
- Numbers below are starting values from the spec, to be tuned later; use them as given.

## Review Focus

1. The player dies while held: the hold ends, and after a respawn the player is free, with no holder left in `hold` (Task 2 test).
2. A grab tried during a dodge's invulnerability, or during the grace after a release, is refused, and two enemies never hold at once (Task 2 test).
3. A bloater in a tunnel gutter, about a metre of water against a wall, chases a player along the tunnel for 10 s without leaving its footing, freezing or jittering (Task 3 test).
4. A Sapper cave-in dropped across a pool with a siren in it: afterwards the siren stands on water outside the rubble, not inside it and not on dry floor (Task 1 test, with a test type).
5. Touch: tapping the Dodge button (`T:dodge`) cuts a hold short exactly as the key does (Task 2 test).

---

### Task 1: Shared support for bound types

**Files:**
- Modify: `src/06b_ebeh.js` (`bound`, `waterFoot`, `keepFooting`)
- Modify: `src/06_game.js`:
  - the class tools: `grappleLight`, the `execute` case's Sapper and Riftwalker branches, `riftBodies`, `holesUpdate`;
  - the targeting and hit code: `separate`, `setRoute`, `hitEnemy`, `pickLock`, `aimYaw`, `aimRanged`, `kill`'s relock;
  - the `chase` case of `enemyUpdate` (the `goal` hook);
  - the pack code: `seeingMate`, `callPack`.
- Modify: `src/07_render.js` (where `e.vis` is set), `src/09_main.js` (`DF.bound`, `DF.waterFoot`, `DF.keepFooting`)
- Test: `tests/t24.mjs` (new; copy `t23`'s `step` and `arena` helpers)

**Interfaces:**
- Produces, in `06b_ebeh.js`:
  - `bound(e) -> boolean`: true when `e.def.bound` is set. `bound` is `"water"` or `"wall"`.
  - `waterFoot(e, x, z) -> boolean`: the foot rule every water-bound type uses. It is true when `waterAt(x, z) >= 0.5`, `fieldAt(x, z) >= e.r`, and `bodyAt(x, z)` is either `e.body` or -1. `e.body` is set on first use from `bodyAt(e.x, e.z)`.
  - `wallFoot(e, x, z) -> boolean`: true only within 0.01 m of `(e.hx, e.hz)`.
  - `waterGoal(e, c) -> { x, z }`: the point of `e`'s footing nearest the player, from the spec's "Water-bound enemies out of reach". It samples a 0.5 m lattice within 12 m of `e`, keeps the points where `footOk` holds, and picks the one nearest `c.p`. The result is cached on `e.goal` and refreshed every 0.5 s. With no point found it returns `e`'s own position.
- Adds a new hook, `goal(e, c) -> { x, z } | null`, to the `chase` case, read after `mayAtk`. Add it to the hook list in the header of `06b_ebeh.js`. When it returns a point, the steering changes in three ways:
  - `ux, uz` point at that point instead of at the player (zero within 0.3 m of it), while `face` still turns the enemy to the player;
  - the not-`want` branch steps toward the point and does not circle;
  - the attack choice (`plan`, token, `trig`, angle, `wind`) runs unchanged.
  With no `goal` hook the case runs exactly as now.
- Changes `keepFooting(e)`. When neither the current position nor `(e.okx, e.okz)` satisfies `footOk`, it moves the body to the nearest point that does. It searches rings 0.25 m apart out to 4 m, 16 points per ring, and leaves the body where it is if none is found.
- Changes `separate`:
  - A bound enemy is weighted like the boss: it is not moved by other enemies.
  - It pushes the player with weight 1.
  - It is skipped entirely while `e.hidden`.
- Changes `setRoute`: for a type with a `foot` hook the route is the single point `[{ x, z }]`, a straight walk along which `eStep` slides on its footing.
- `e.hidden` (set by hooks) means not drawn (`e.vis` false), no tag, never locked or aimed at, skipped by `separate`, and refused by `hitEnemy`.
- `e.safe` means `hitEnemy` refuses the hit quietly (no sparks, sound or alert), while the enemy can still be seen and locked.
- `EDEF` entries with `ambush: true` are left out of `seeingMate` and `callPack`, in both directions.
- Class tools treat `bound(e)` like the boss:
  - `grappleLight` is false for it, so the player is pulled to it.
  - The Sapper's execution kick is not applied and the charge goes off on it.
  - The Riftwalker's execution does not drop it (sparks in place, as for the boss).
  - `riftBodies` and `holesUpdate` skip it.

- [ ] **Step 1: Write the failing tests** in `tests/t24.mjs`. Use a test type registered in the test: `DF.EDEF.__w = { ...DF.EDEF.rat, bound: "water" }` and `DF.EBEH.__w = { foot: DF.waterFoot }`. Run them in a real sewer pool: `DF.LIVE_GRADES.add("D"); DF.newRun(5, "D")`, take a pool room's largest body, and place the enemy on one of its points with `waterAt === 1`.
  - "a water-bound body stays in its own pool":
    - `DF.eStep` 10 m toward the nearest dry floor leaves `waterFoot` true.
    - So does `e.kx = 40` followed by `DF.sim(0.3)`.
    - So does pushing a second enemy into it, then `DF.separate()` and one `DF.sim(1/60)`.
    - It is not moved by a husk overlapping it (its position changes by less than 0.01 m in `separate`).
  - "a cave-in across its pool leaves it on water outside the rubble": `DF.startCaveIn` aimed through the enemy, then `DF.sim(2)`. Pass when `waterFoot(e, e.x, e.z)` holds and `w.fieldAt(e.x, e.z) >= e.r`.
  - "bound types are immune to the class tools that move enemies". With `bound` set:
    - an Enforcer grapple puts the player in state `grapple` (they are pulled), and `e.yank` stays null;
    - a Riftwalker execution of a staggered one leaves it not in `fall`;
    - a Drop hole under it leaves it not in `fall`;
    - a rift pair across it leaves it on its side;
    - a Sapper execution sets no `e.kick`.
    Use the class switching and tool calls t6 and t21 use.
  - "a water-bound type waits at the edge nearest the player": with `DF.EBEH.__w.goal = DF.waterGoal`, the player stands on dry floor 3 m from the pool's shore and the enemy is alerted. Within 6 s the enemy is within 1 m of the footing point nearest the player, is facing the player within 0.3 rad, and has moved less than 0.2 m over the last second (it waits rather than jittering).
  - "a footed type walks routes straight": `DF.EBEH.__w` set, `setRoute` result has length 1. Without the hook, a husk's route is as before (more than one point across a corner in cave 99, as t12 does).
  - "hidden enemies cannot be hit, locked, aimed at or drawn": with `e.hidden = true`, `DF.hitEnemy(e, 30, 10, { src: "melee" })` leaves hp, `DF.pickLock()` does not return it, and `e.vis` is false after one drawn frame (wait two animation frames as t10 does). With `e.safe = true` (not hidden), `hitEnemy` leaves hp and the enemy can still be locked.
  - "ambush types take no part in packs": with `DF.EDEF.__a = { ...DF.EDEF.rat, ambush: true }` alerted next to an idle rat that cannot see the player, the rat stays idle after `DF.sim(1)`. An alerted rat beside an idle `__a` leaves it idle.
  - Every step deletes the test keys it added.

- [ ] **Step 2: Run them to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke`
Expected: FAIL, with `DF.waterFoot` undefined.

- [ ] **Step 3: Implement** the interfaces above. Keep E's arithmetic exactly: in `separate`, the weight stays `a.def.boss ? 0 : b.def.boss ? 1 : 0.5` for unbound pairs. Build each new condition so that it reduces to the old one when `bound`, `hidden`, `safe` and `ambush` are all unset.

- [ ] **Step 4: Run t24, t23 and the E suites**

Run: `node build.mjs && for t in t24 t23 t5 t6 t12 t20 t21 t22; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`
Expected: no `FAIL` lines.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/06_game.js src/07_render.js src/09_main.js tests/t24.mjs
git commit -m "feat: shared rules for enemies bound to water or walls"
```

---

### Task 2: Being held

**Files:**
- Modify: `src/06_game.js` (`HOLD`, `grabPlayer`, `heldUpdate`, `releaseHold`, `playerUpdate`, `hurtPlayer`, `playerDie`, `resetRun`, `respawn`)
- Modify: `src/07_render.js` (`posePlayer`: a `held` pose), `src/08_hud.js` (the prompt), `src/09_main.js` (DF names)
- Test: `tests/t24.mjs`

**Interfaces:**
- Produces:
  - `HOLD = { max: 2, mash: 0.35, safe: 0.4, grace: 1.5, tick: 0.5 }`.
  - `grabPlayer(e, o) -> boolean`. `o` is `{ dps, tx, tz, speed }`: damage per second, where the player is moved to, and how fast. It refuses (returns false) when any of these hold:
    - the player's state is `dead`, `execute`, `blink`, `inspect`, `grapple` or `held`;
    - `p.iframe > 0`;
    - `G.grabGrace > 0`;
    - `G.state !== "play"`.
  - When it succeeds it sets `p.state = "held"` and `p.hold = { by: e, t: 0, tick: 0, dps, tx, tz, speed }`, clears `p.buf` and `p.lock`, and plays `SFX.hurt()` and `PAD.rumble("hurt")`.
- `heldUpdate(dt)` runs from `playerUpdate` in place of the rest of it, right after the inspect check:
  - `t += dt`, and each `hit("dodge")` adds `HOLD.mash` to `t` (no stamina, no dodge).
  - It moves the player toward `(tx, tz)` at `speed`, through `w.resolve`.
  - Every `HOLD.tick` it applies `hurtPlayer(dps * HOLD.tick, by, { dmg: …, dot: true })`.
  - It calls `releaseHold()` when `t >= HOLD.max`, when `by.dead`, or when `by.state !== "hold"`.
- `releaseHold()`:
  - sets `p.state = "free"`;
  - sets `p.iframe` to at least `HOLD.safe`;
  - sets `G.grabGrace = HOLD.grace`, which `update` counts down;
  - sets `p.hold = null` and `p.buf = null`;
  - drops a dodge tap still in `taps`, so the last mash does not dodge.
- `hurtPlayer` with `atk.dot`:
  - goes round guard and parry;
  - gives no perfect dodge (it returns `"none"` during iframes);
  - gives no knockback and no change of state;
  - still flashes and can kill.
  With the player `held`, any hit's damage lands, the state stays `held`, and there is no knockback.
- The holder's side is the holder's business: an enemy that grabs sets its own `e.state = "hold"`. The shared switch has no `hold` case, so its hook drives it.
- `playerDie`, `resetRun` and `respawn` clear `p.hold` and `G.grabGrace`, and an enemy in `hold` goes to `rec`.
- Pausing does not end a hold. The simulation stops, and the hold carries on after resume, so pausing cannot be used to escape. The spec's "ends on leaving play" is read as leaving the run, which goes through `resetRun`.
- The HUD prompt, shown while `p.state === "held"`, reads `<kbd>{dodge}</kbd> Break free`. `{dodge}` is `actKey("dodge")` on a pad, `DODGE` under touch, and `keyName(BIND.dodge)` otherwise, matching the Execute prompt's pattern.
- DF gets `grabPlayer`, `releaseHold` and `HOLD`.

- [ ] **Step 1: Write the failing tests** (arena with a husk set to `state = "hold"` as the holder; set `e.state = "hold"` before `grabPlayer`)
  - "a hold lasts HOLD.max and lets go": `DF.grabPlayer(e, { dps: 5, tx: p.x, tz: p.z, speed: 0 })` returns true. After `DF.sim(1.9)` the player is still `held`. By 2.1 s they are `free`, with `p.iframe > 0` and `G.grabGrace > 0`.
  - "each dodge press cuts the hold by HOLD.mash": four presses, one every 0.1 s from the start (`DF.taps[DF.BIND.dodge] = true` on those steps), free before 0.8 s. The player never entered `dodge` and stamina is unchanged.
  - "the Dodge touch button cuts it too": the same with `DF.taps["T:dodge"] = true`.
  - "a hold drags the player": `tx` 3 m away, `speed: 4`. After 1 s the player is within 0.3 m of the target.
  - "held damage ticks through hurtPlayer and ignores guard": `dps: 10` over the full hold costs 20 hp within 1. With `p.state` forced to `guard` before the grab, it costs the same.
  - "the holder's death or stagger frees the player": `DF.kill(e)` mid-hold frees on the next step. `DF.stagger(e)` mid-hold frees on the next step.
  - "no grab during a dodge or the grace, and one holder at a time":
    - `p.iframe = 0.3` makes `grabPlayer` false.
    - Right after a release, a second `grabPlayer` is false until `G.grabGrace` runs out.
    - While held, a second enemy's `grabPlayer` is false.
  - "other hits land on a held player but do not free them": `DF.hurtPlayer(15, other, { dmg: 15 })` lowers hp by 15. The state stays `held`, with no knockback.
  - "dying while held ends the hold": with hp at 3 and `dps: 10`, the player dies. `p.hold` is null and the holder is in `rec`. After `DF.respawn()` the player is `free`.
  - "the prompt names the dodge input": while held, the HUD prompt element (the one the Execute prompt uses) contains `Break free`. Wait two animation frames, as t10 does.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke` gives FAIL, with `DF.grabPlayer` undefined.
- [ ] **Step 3: Implement** the interfaces above, and a `held` pose in `posePlayer`: arms up and struggling, body twisting, with a jolt on each mash.
- [ ] **Step 4: Run t24, t6, t16 (pad, `smoke`) and t18 (`hub`)**: `node build.mjs && for t in t24 t6 t16; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done; SCRIPT=$PWD/tests/t18.mjs node test.mjs hub || echo FAIL t18`, expecting no `FAIL`. Then run `node tests/touch-all.mjs tests/t14.mjs`, expecting every device to pass.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/07_render.js src/08_hud.js src/09_main.js tests/t24.mjs
git commit -m "feat: a held player state, broken by mashing dodge"
```

---

### Task 3: The bloater and its poison cloud

**Files:**
- Modify: `src/06_game.js` (`EDEF.bloater`, `CLOUD`, `G.clouds`, `cloudsUpdate`, `resetRun`, `respawn`, `update`), `src/06b_ebeh.js` (`EBEH.bloater`), `src/05b_dbodies.js` (`EFIG.bloater`, `EPOSE.bloater`)
- Create: `src/07b_dfx.js` (`drawClouds()`, called where `07_render.js` draws other effects)
- Test: `tests/t24.mjs`

**Interfaces:**
- Consumes: `bound`, `waterFoot` (Task 1); `hurtPlayer` with `atk.dot` (Task 2).
- `EDEF.bloater`:
  - name `"Bloater"`, threat 0, hp 20, posture 20, speed 1.2, wade 1.0, turn 3, r 0.4, sight 12, cd 1.4, poise 0, top 1.0, `bound: "water"`;
  - `bump`: style `"thrust"`, wind 0.5, act 0.15, rec 0.6, dmg 5, reach 1.4, arc 2.0, lunge 0.6, trig 1.4.
- `EBEH.bloater` has `foot: waterFoot`, `goal: waterGoal` and a `death(e)` that pushes `{ x, z, r: CLOUD.r, t: 0, tick: 0 }` to `G.clouds`.
- `CLOUD = { r: 1.5, life: 3, tick: 0.5, dmg: 4 }`.
- `cloudsUpdate(dt)` runs every `CLOUD.tick` and hurts everything inside `r`:
  - the player, through `hurtPlayer(CLOUD.dmg, null, { dmg: CLOUD.dmg, dot: true, px: x, pz: z })`;
  - every enemy that is not dead, not in `fall` and not hidden, through `hitEnemy(o, CLOUD.dmg, 0, { src: "aoe", fx: x, fz: z })`.
  It drops a cloud past `CLOUD.life`. `resetRun` and `respawn` clear `G.clouds`.
- The body is a floating swollen sac (a sphere scaled wider than tall, pale green-grey with dark veins and small stub limbs), bobbing on the water and pulsing faster as its hp falls. `drawClouds` draws each cloud as drifting green additive sprites that fade over its life.

- [ ] **Step 1: Write the failing tests** (in a sewer pool room's water, as in Task 1, and in a tunnel gutter: find a body with `room === -1` in `w.bodies`)
  - "a bloater stays in water": the same three push checks as Task 1, with the real type.
  - "a bloater in a gutter follows the player along the tunnel without leaving it": the player walks 6 m along the tunnel beside the gutter over 10 s (set the position each step). Every step has `waterFoot` true. The bloater moved at least 2 m in total, and no step-to-step jump was over 0.5 m.
  - "its burst leaves a cloud that hurts everyone in it": after `DF.kill(b)`, `G.clouds.length === 1`. With the player 1 m away and a rat 1 m away, `DF.sim(3)` lowers both by about `CLOUD.dmg * 6`, within one tick. The player's state was never `hit`. After 3.2 s, `G.clouds.length === 0`.
  - "the cloud ignores guard": with the player guarding and facing the cloud, the damage is the same.
  - "it can be hit from the bank": with the player on dry floor at a pool's shore and the bloater alerted, within 10 s it comes within the Fighter's light-attack range of the player, and a `hitEnemy` call then lowers its hp.
  - "a cloud can burst another bloater": a second bloater 1 m from the first dies within 3 s, and a second cloud appears.
  - Shot `t24-bloater`: one on sewer pool water, 3 m from the camera, at `wait: 400`. Shot `t24-cloud`: the cloud a moment after a burst.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke` gives FAIL, with `EDEF.bloater` undefined.
- [ ] **Step 3: Implement** the bloater, the clouds and their drawing.
- [ ] **Step 4: Run t24 and t23, and look at both shots**: `node build.mjs && for t in t24 t23; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`, expecting no `FAIL`. The bloater reads as a swollen sac floating on the water, and the cloud as green gas.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js src/07b_dfx.js src/07_render.js tests/t24.mjs
git commit -m "feat: the bloater, which bursts into a poison cloud"
```

---

### Task 4: The eel

**Files:**
- Modify: `src/06_game.js` (`EDEF.eel`, `EEL`, `G.shocks`, `resetRun`, `respawn`), `src/06b_ebeh.js` (`EBEH.eel`), `src/05b_dbodies.js` (`EFIG.eel`, `EPOSE.eel`), `src/07b_dfx.js` (`drawShocks()`)
- Test: `tests/t24.mjs`

**Interfaces:**
- Consumes: `bound`, `waterFoot`, `e.safe` (Task 1); the bloater (Task 3), for the chain test.
- `EDEF.eel`:
  - name `"Eel"`, threat 1, hp 70, posture 60, speed 2.5, wade 2.0, turn 6, r 0.45, sight 14, cd 1.6, poise 1, top 1.0, `bound: "water"`;
  - `bite`: style `"thrust"`, wind 0.45, act 0.12, rec 0.6, dmg 12, reach 2.2, arc 1.4, lunge 0.6, trig 2.2.
- `EEL = { every: 8, glow: 1.2, dmg: 22, post: 20, lit: 0.4 }`.
- `EBEH.eel.step`:
  - While `e.aware && !G.inBoss` and the eel is not staggered, `e.shockT` grows by `dt`.
  - At `every` it starts glowing (`e.glowT = EEL.glow`, `SFX.tele(true)`).
  - When the glow runs out it shocks and sets `e.shockT = 0`:
    - the player, through `hurtPlayer(EEL.dmg, e, { dmg: EEL.dmg, unb: true })`, if `waterAt(p) > 0.5` and `bodyAt(p) === e.body`;
    - every other living, unhidden enemy that is not an eel and stands in that body, through `hitEnemy(o, EEL.dmg, EEL.post, { src: "aoe", fx: e.x, fz: e.z })`.
  - It pushes `{ body: e.body, room: the eel's room node or null, t: 0, dur: EEL.lit }` to `G.shocks`.
  - An eel that stops hunting resets `shockT` to 0, so an idle eel never shocks.
  - `e.safe` is true while it is under: in none of `wind`, `act`, `rec`, `hit`, `recoil` or `stagger`, and not glowing. So it can be hit only while it bites, recovers, flinches or glows.
  - It has `foot: waterFoot` and `goal: waterGoal`.
- `drawShocks()` lights the shocked body for `dur`. It samples a 1 m lattice over the body's room rectangle (`n.x ± n.hw`, `n.z ± n.hd`, or 12 m round the body's centre when it has no room), and draws bright blue-white additive sprites with crackling streaks at every point where `bodyAt` is the body's id. Other bodies stay dark.
- The body is a long, low segmented eel (six to eight tapering segments, dark olive with a pale belly and glowing spots along its flanks). Under, it is drawn mostly submerged (lowered about 0.35 m more), and it rises to bite. The spots brighten through the glow.

- [ ] **Step 1: Write the failing tests** (a sewer pool room with at least two bodies; the eel in body A)
  - "the eel's shock hurts only those in its pool":
    - the player standing in A loses `EEL.dmg`;
    - the player in body B, or on dry floor, loses nothing;
    - a rat in A takes damage, and a rat in B does not.
    Force the shock with `e.aware = true; e.shockT = DF.EEL.every - 0.01` and run past the glow.
  - "it warns first": 1 s into the glow no damage has landed and `e.glowT > 0`.
  - "an idle eel never shocks": `e.aware = false` for 20 s gives no shock and leaves `e.shockT === 0`.
  - "a shock sets off a bloater": a bloater in A dies from one shock and leaves a cloud.
  - "it can be hit only while surfaced": under, `hitEnemy` leaves hp. While glowing it lowers hp, and in `wind` it lowers hp.
  - "it can be hit from the bank": the player on dry floor at A's shore, 1.5 m from water. With the eel alerted, within 10 s the eel comes within the Fighter's light-attack range (`DF.MOVES` chain move `range`, plus both radii) of the player while surfaced.
  - "it stays in its pool", as in Task 1.
  - Shots: `t24-eel` (surfaced, biting at a shore) and `t24-eel-shock` (the shocked pool lit while another is dark), at `wait: 400`.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke` gives FAIL, with `EDEF.eel` undefined.
- [ ] **Step 3: Implement** the eel, the shock and its drawing.
- [ ] **Step 4: Run t24 and t23, and look at both shots**: `node build.mjs && for t in t24 t23; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`, expecting no `FAIL`. The lit pool must be plainly that one pool.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js src/07b_dfx.js tests/t24.mjs
git commit -m "feat: the eel, which shocks the whole pool it is in"
```

---

### Task 5: The siren

**Files:**
- Modify: `src/06_game.js` (`EDEF.siren`, `SIREN`), `src/06b_ebeh.js` (`EBEH.siren`), `src/05b_dbodies.js` (`EFIG.siren`, `EPOSE.siren`), `src/07b_dfx.js` (the song's drawing)
- Test: `tests/t24.mjs`

**Interfaces:**
- Consumes: `bound`, `waterFoot` (Task 1); `grabPlayer`, `HOLD`, `p.hold` and the holder's `hold` state (Task 2).
- `EDEF.siren`:
  - name `"Siren"`, threat 2, hp 150, posture 110, speed 3.2, wade 1.8, turn 5, r 0.6, sight 18, cd 2.0, poise 1, top 1.4, `bound: "water"`;
  - `lunge`: kind `"grab"`, style `"thrust"`, wind 0.7, act 0.35, rec 0.9, dmg 6, reach 4, arc 1.2, trig 5, unb true;
  - `song`: kind `"song"`, style `"cast"`, wind 0.9, act 2.0, rec 0.8, dmg 0, trig 12, minTrig 3.
- `SIREN = { drag: 2, grabCD: 6, pull: 2.6, dps: 8, dragSpeed: 5 }`.
- `EBEH.siren`:
  - **The grab.**
    - `wind(e, c)` for `grab`: nothing (the shared red warning plays).
    - `act(e, dt, c)` for `grab`: once, if the player is within `reach + 0.6` (the player's radius) and inside `arc / 2` of her facing, `hurtPlayer(dmg, e, atk)`. If that does not return `"none"`, it then calls `grabPlayer(e, { dps: SIREN.dps, tx, tz, speed: SIREN.dragSpeed })`, where `(tx, tz)` is her position moved `SIREN.drag` m further from the player and walked back until `waterFoot` holds. On success she sets `e.state = "hold"`.
    - `step(e, dt, c)`: while `e.state === "hold"`, she turns to the player and returns `true`. When `p.hold` is no longer hers, she sets `e.state = "rec"` with `e.atk = d.atks.lunge`, and sets `e.grabCD = SIREN.grabCD`.
  - **The song.** `act` for `song` pulls the player toward her at `SIREN.pull` m/s through `w.resolve`, while she has line of sight and the player is not in `dodge`. A `dodge` ends the song (`e.state = "rec"`). It does nothing while the player is `held`.
  - **The cooldown.** `canAttack` is false while `e.grabCD > 0` (counted down in `step`). While it is above 0, `chase` walks her toward her post and returns `true`.
  - She has `foot: waterFoot` and `goal: waterGoal`.
- `SIREN.pull` is about half a class's walk speed (4.8 to 5.6), not the full walking pace the spec mentions: a pull equal to the walk would cancel walking away, and the spec says the player can move against it. Even wading (walk times 0.6, about 3 m/s) still beats the pull.
- The body:
  - a human upper body (pale grey-green skin, long dark hair as hanging boxes) over a scaled tail that trails behind and sways;
  - drawn low in the water, so only the chest and head show above it when idle;
  - she rises to the waist on the lunge and the song.
  - `07b_dfx.js` draws the song as pale rings travelling from her to the player while it pulls.

- [ ] **Step 1: Write the failing tests** (a sewer pool room. Put the siren in a body with dry floor beside it, and the player on that floor.)
  - "her lunge reaches 4 m onto the bank and drags the player in": the player 3.5 m from her on dry floor, facing her, not guarding. Alert her and force the lunge (`e.atk = DF.EDEF.siren.atks.lunge; e.state = "wind"; e.t = 0`), then `DF.sim(3)`. The player was `held`, and once free they stand in her body's water, about `SIREN.drag` m in from the shore (within 1 m).
  - "out of reach, the lunge misses": the same at 5 m. The player is never `held`.
  - "she cannot grab again for SIREN.grabCD": after a hold ends, no `wind` within `SIREN.grabCD - 0.5` s.
  - "the song pulls and a dodge breaks it": force the song with the player 8 m away. After 1 s they are at least 2 m closer. In a second run, a dodge 0.3 s into the song ends it (her state is `rec` within 0.1 s), and the player stops being pulled.
  - "the player can walk against the song": holding `fwd` away from her for 2 s of song leaves them further away than where they started.
  - "she stays in her pool", as in Task 1, including during the lunge and the drag.
  - "she can be hit from dry floor when she comes to the edge": with her alerted and the player on the bank, within 10 s she comes within the Fighter's light-attack range of the player, and a `hitEnemy` call then lowers her hp.
  - Shots: `t24-siren` (idle, low in the water, 4 m from the camera), `t24-siren-lunge` (half way through the lunge's wind) and `t24-siren-hold` (the player held in her pool), at `wait: 400`.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke` gives FAIL, with `EDEF.siren` undefined.
- [ ] **Step 3: Implement** the siren, her song and her drawing.
- [ ] **Step 4: Run t24, t23 and t6, and look at the three shots**: `node build.mjs && for t in t24 t23 t6; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`, expecting no `FAIL`. She reads as a figure in the water with a tail, plainly not a husk.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js src/07b_dfx.js tests/t24.mjs
git commit -m "feat: the siren, who drags the player into her pool"
```

---

### Task 6: The drain grabber

**Files:**
- Modify: `src/06_game.js` (`EDEF.grabber`, `GRAB`), `src/06b_ebeh.js` (`EBEH.grabber`), `src/05b_dbodies.js` (`EFIG.grabber`, `EPOSE.grabber`)
- Test: `tests/t24.mjs`

**Interfaces:**
- Consumes: `bound`, `wallFoot`, `e.hidden`, `ambush` (Task 1); `grabPlayer` and the holder's `hold` state (Task 2).
- `EDEF.grabber`:
  - name `"Drain Grabber"`, threat 1, hp 45, posture 40, speed 0, turn 0, r 0.35, sight 3, cd 4, poise 1, top 1.3, `bound: "wall"`, `ambush: true`;
  - `grab`: kind `"grab"`, style `"thrust"`, wind 0.45, act 0.25, rec 0.8, dmg 6, reach 2.6, trig 2.5, arc 2.4, unb true.
- `GRAB = { r: 2.5, arc: 1.2, show: 2.5, back: 15, rearm: 4, dps: 6, speed: 4 }`.
- Its post is its grate:
  - It is placed 0.4 m out from the grate along the grate's `yaw` (which faces into the tunnel), facing that way.
  - It has `foot: wallFoot`.
  - Its `chase` hook always returns `true` and does nothing.
- `EBEH.grabber.step` runs its whole cycle:
  - **Hidden** (`e.hidden = true`, the start). When `e.rearmT` is 0, the player is not `held`, `G.grabGrace` is 0, and the player is within `GRAB.r` and inside `GRAB.arc` of its facing with line of sight, it strikes. It sets `e.hidden = false` and `e.dmgSince = 0`, and goes to the shared `wind` with `e.atk = d.atks.grab`. Its `act` hook does the grab like the siren's, with `tx, tz` at its own position and speed `GRAB.speed`, then sets `e.state = "hold"`.
  - **After a strike or a hold.** Whether the grab hit or missed, and after a hold ends, it stays visible for `GRAB.show` s, then hides and sets `e.rearmT = GRAB.rearm`.
  - **Driven back by damage.** Damage taken while visible (recorded by a `hit` hook that returns `null` and adds to `e.dmgSince`) of `GRAB.back` or more makes it hide at once. That ends any hold (its state leaves `hold`) and sets `e.rearmT`.
  - While hidden or in its own cycle it returns `true`. In `hit`, `recoil` and `stagger` it returns `false`, so the shared timers run, and it hides when they end.
  - It never takes an attack token.
- The body is a long jointed arm of three segments, grey-blue and slimy, with a clawed hand. It reaches out of the grate along its facing over the wind and act, holds out while visible, and draws back into the grate as it hides. It is not drawn while hidden.

- [ ] **Step 1: Write the failing tests** (a sewer seed with a grate; the grabber made at it as placement will, the player in the tunnel)
  - "hidden until it strikes": with the player 6 m away, it is hidden after 3 s: `e.vis` false, no HUD tag, and `pickLock` never returns it. `hitEnemy` leaves hp, and so does an `explode` on it.
  - "it strikes a player passing in front": the player walked to 1.5 m in front gets `wind` within 0.2 s, and `held` once the act lands if not dodging.
  - "it does not strike from behind its wall's line or past GRAB.r": the player 1.5 m to the side, outside `GRAB.arc`, or 3.5 m in front, gives no strike in 3 s.
  - "enough damage drives it back and frees the player": while it holds, `DF.hitEnemy(e, 16, 5, { src: "melee" })` frees the player on the next step and hides it.
  - "it re-arms after GRAB.rearm": after it hides, with the player in front again (and the grace over), no strike before `GRAB.rearm - 0.2` s, and a strike by `GRAB.rearm + 0.5` s.
  - "it never moves and never joins a pack": its position is unchanged after a fight's worth of `DF.sim(10)` with knockback forced. A rat that sees the player does not wake it.
  - Shots: `t24-grabber` (reaching out of a grate at the player, during act) and `t24-grabber-hold`, at `wait: 400`.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke` gives FAIL, with `EDEF.grabber` undefined.
- [ ] **Step 3: Implement** the grabber and its arm.
- [ ] **Step 4: Run t24, t23 and t10 (HUD), and look at both shots**: `node build.mjs && for t in t24 t23 t10; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done`, expecting no `FAIL`. The arm plainly comes out of the grate.
- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/05b_dbodies.js tests/t24.mjs
git commit -m "feat: the drain grabber, an arm in a tunnel grate"
```

---

### Task 7: Placement, and the docs

**Files:**
- Modify: `src/03c_sewer.js` (the spawn block of `genSewer`, plus a draw-free `crossingOf(n)` beside it)
- Modify: `tests/t22.mjs` (the spawns value of the `genSewer` hashes only), `tests/t23.mjs` (its pool-room stand-in step now expects D types), `tests/t24.mjs`
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: types `"siren"`, `"eel"`, `"bloater"`, `"grabber"`, and batch 1's `"rat"`.
- `crossingOf(n) -> { x, z, a, b } | null`:
  - It looks at the pair of the room's bodies (from `bodies` with `room === n.id`) whose nearest grid points are closest, when that gap is at most `SEWER.pool.cross + 2`.
  - `x, z` is the midpoint of those two points, and `a, b` are the two body ids.
  - It uses `bodyIds` and makes no draws. Store the result on the node as `n.cross`.

**Placement** (all draws from `Rn`, in the spawn block, which stays the last consumer of `Rn`):
- **Pool room.** With `Rn() < 0.5` it is a siren room, else an eel room.
  - **Siren room.** One `siren`, at the water point of `cross.a` or `cross.b` (whichever is larger) nearest the crossing, at least 1 m in from its shore (every point within 1 m has `waterAt` 1). Fall back to an eel room when there is no crossing or no such point.
  - **Eel room.** `1 + (Rn() < 0.4 ? 1 : 0)` eels, each in a different body, preferring bodies that are not `cross.a` or `cross.b`. Each eel stands at a water point at least 1 m in from the shore.
  - **Either kind.** `2 + floor(Rn() * 2)` rats on dry floor as now, and `1 + (Rn() < 0.5 ? 1 : 0)` bloaters on water points that satisfy `waterFoot` for `r` 0.4.
- **Gutters.** Each body with `room === -1` gets, with `Rn() < 0.35`, one `bloater` at its point with the largest `fieldAt` among those with `waterAt === 1`, recording `kind: "tunnel"`.
- **Grates.** Each entry of `grates` gets, with `Rn() < 1 / 3`, one `grabber`, 0.4 m out along its `yaw`, with yaw equal to the grate's, recording `kind: "tunnel"`.
- **Every water-bound spawn** is on a point where `waterFoot` holds for its type's `r`, which is the "Notes for batch 2" anchor precondition. Every other type spawns on dry floor as now.
- **No E type spawns in D**, except the Warden.

- [ ] **Step 1: Write the failing tests** in `t24`, over seeds 1 to 12 with `DF.genSewer(s)`:
  - "no E types in D but the Warden": no spawn of type `husk`, `brute` or `spit`.
  - "pool rooms hold sirens or eels, never both, and never a brood mother": every pool room has exactly one siren or 1 to 2 eels, never both kinds, plus 2 to 3 rats and 1 to 2 bloaters. Brood rooms have no siren and no eel.
  - "the siren guards the crossing": each siren is within 4 m of its room's `cross` point.
  - "eels are in different bodies": within a room, no two eels share a body.
  - "water-bound spawns stand on their footing": for every siren, eel and bloater spawn, `waterAt >= 0.5` and `fieldAt >= r`. After `DF.newRun(s, "D")`, `DF.footOk(e, e.x, e.z)` for each.
  - "grabbers sit at grates": each grabber is within 0.5 m of a grate point, facing its `yaw`.
  - "some gutters hold a bloater": over the 12 seeds at least one gutter does, and none is on dry floor.
  - Update `t23`'s pool-room step, which expects `PACK.pool`'s E types, to expect the new mix, or delete it in favour of the t24 step. Say which in the commit.
  - Shots: `t24-fight-pool-siren` (a siren room from its entry, enemies awake) and `t24-fight-pool-eel` (an eel room), at `wait: 500`.

- [ ] **Step 2: Run to see them fail**: `node build.mjs && SCRIPT=$PWD/tests/t24.mjs node test.mjs smoke` gives FAIL on "no E types in D".
- [ ] **Step 3: Implement `crossingOf` and the placement.**
- [ ] **Step 4: Update t22's spawns hash.** Only the fifth value of each seed may differ. If any other value moves, a draw moved: fix the code, not the hash. Update the comment above it.
- [ ] **Step 5: Run every suite.** Run `node build.mjs && for t in t24 t23 t22 t5 t6 t10 t12 t16 t20 t21; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo FAIL $t; done; for t in t8 t18; do SCRIPT=$PWD/tests/$t.mjs node test.mjs hub || echo FAIL $t; done`, expecting no `FAIL`. Look at both fight shots and every earlier t24 shot.
- [ ] **Step 6: Update the docs.**
  - **`CLAUDE.md`:**
    - `bound`, `waterFoot`, `wallFoot` and the class-tool rule.
    - `e.hidden` and `e.safe`, and `ambush`. Add them to the list of things a new way of hitting or targeting must respect.
    - The `held` state, `HOLD`, `grabPlayer` and `releaseHold`, and `atk.dot`.
    - The four types and their tables (`CLOUD`, `EEL`, `SIREN`, `GRAB`).
    - `07b_dfx.js`, the placement, the `t24` entry, and the known problems (untested by hand; the song pull and drag numbers).
    - Every remaining mention of E stand-ins in D now says only the Warden remains, until project 3.
  - **`README.md`:** the D enemies, and that D is still sealed.
- [ ] **Step 7: Commit**

```bash
git add src/03c_sewer.js tests/t22.mjs tests/t23.mjs tests/t24.mjs CLAUDE.md README.md
git commit -m "feat: pool rooms, gutters and grates get their D enemies

genSewer's spawns hash in t22 changes on purpose: pool rooms now place
sirens or eels with rats and bloaters, gutters bloaters and grates drain
grabbers. Its mesh, water, pieces and dressing hashes are unchanged."
```
